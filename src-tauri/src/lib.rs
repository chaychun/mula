use rand::Rng;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const OAUTH_FILE: &str = ".oauth_token";
const API_KEY_FILE: &str = ".api_key";

// Sidecar state shared across commands
struct SidecarState {
    port: u16,
    auth_token: String,
    running: bool,
    child: Option<CommandChild>,
}

struct AppState {
    sidecar: Mutex<SidecarState>,
}

#[derive(Serialize)]
struct SidecarInfo {
    port: u16,
    auth_token: String,
}

#[derive(Serialize)]
struct SidecarStatus {
    running: bool,
    port: u16,
}

#[derive(Serialize)]
struct CredentialStatus {
    /// "local_cli" | "oauth" | "api_key" | null
    active_kind: Option<String>,
    /// "stored" | "env" | "keychain" | null
    active_source: Option<String>,
    has_oauth_stored: bool,
    has_api_key_stored: bool,
    has_oauth_env: bool,
    has_api_key_env: bool,
    /// `claude` CLI binary is present on the system.
    local_cli_installed: bool,
    /// `claude` CLI has stored credentials (keychain on macOS, config file elsewhere).
    local_cli_authenticated: bool,
}

// Generate a random auth token
fn generate_auth_token() -> String {
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect()
}

// Find an available port
fn find_available_port() -> u16 {
    portpicker::pick_unused_port().unwrap_or(3456)
}

fn credential_path(app: &AppHandle, file: &str) -> Result<std::path::PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    Ok(data_dir.join(file))
}

fn write_credential(app: &AppHandle, file: &str, value: &str) -> Result<(), String> {
    let path = credential_path(app, file)?;
    std::fs::write(&path, value).map_err(|e| format!("Failed to write credential: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }
    Ok(())
}

fn read_credential(app: &AppHandle, file: &str) -> Option<String> {
    let path = app.path().app_data_dir().ok()?.join(file);
    std::fs::read_to_string(path).ok().and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn delete_credential(app: &AppHandle, file: &str) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(file);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete credential: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_sidecar_info(state: State<AppState>) -> Result<SidecarInfo, String> {
    let sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    Ok(SidecarInfo {
        port: sidecar.port,
        auth_token: sidecar.auth_token.clone(),
    })
}

#[tauri::command]
fn get_sidecar_status(state: State<AppState>) -> Result<SidecarStatus, String> {
    let sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    Ok(SidecarStatus {
        running: sidecar.running,
        port: sidecar.port,
    })
}

/// Store a credential. `kind` must be "oauth" or "api_key".
#[tauri::command]
fn store_credential(app: AppHandle, kind: String, value: String) -> Result<(), String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Credential value is empty".into());
    }
    let file = match kind.as_str() {
        "oauth" => OAUTH_FILE,
        "api_key" => API_KEY_FILE,
        _ => return Err(format!("Unknown credential kind: {}", kind)),
    };
    write_credential(&app, file, trimmed)
}

/// Clear a stored credential. `kind` must be "oauth" or "api_key".
#[tauri::command]
fn clear_credential(app: AppHandle, kind: String) -> Result<(), String> {
    let file = match kind.as_str() {
        "oauth" => OAUTH_FILE,
        "api_key" => API_KEY_FILE,
        _ => return Err(format!("Unknown credential kind: {}", kind)),
    };
    delete_credential(&app, file)
}

/// Check whether the `claude` CLI has stored credentials we'd inherit by
/// spawning it as a subprocess. On macOS the CLI uses the system Keychain
/// ("Claude Code-credentials"); on other platforms it falls back to a config
/// file under the user's config dir.
fn local_cli_has_credentials() -> bool {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("security")
            .args(["find-generic-password", "-s", "Claude Code-credentials"])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
        if let Ok(s) = status {
            if s.success() {
                return true;
            }
        }
        // Some installs store creds as a file instead of in Keychain
        if let Some(home) = std::env::var_os("HOME") {
            if std::path::PathBuf::from(home)
                .join(".claude/.credentials.json")
                .exists()
            {
                return true;
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let home = std::path::PathBuf::from(home);
            for candidate in [
                home.join(".claude/.credentials.json"),
                home.join(".config/claude/.credentials.json"),
            ] {
                if candidate.exists() {
                    return true;
                }
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            if std::path::PathBuf::from(appdata)
                .join("claude/.credentials.json")
                .exists()
            {
                return true;
            }
        }
    }
    false
}

#[tauri::command]
fn get_credential_status(app: AppHandle) -> Result<CredentialStatus, String> {
    let has_oauth_stored = read_credential(&app, OAUTH_FILE).is_some();
    let has_api_key_stored = read_credential(&app, API_KEY_FILE).is_some();
    let has_oauth_env = std::env::var("CLAUDE_CODE_OAUTH_TOKEN")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let has_api_key_env = std::env::var("ANTHROPIC_API_KEY")
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false);
    let local_cli_installed = !find_claude_path().is_empty();
    let local_cli_authenticated = local_cli_installed && local_cli_has_credentials();

    // Precedence: manually stored creds win (explicit override), then local CLI
    // (detected, zero-config), then env vars as a last fallback.
    let (active_kind, active_source) = if has_oauth_stored {
        (Some("oauth".into()), Some("stored".into()))
    } else if has_api_key_stored {
        (Some("api_key".into()), Some("stored".into()))
    } else if local_cli_authenticated {
        (Some("local_cli".into()), Some("keychain".into()))
    } else if has_oauth_env {
        (Some("oauth".into()), Some("env".into()))
    } else if has_api_key_env {
        (Some("api_key".into()), Some("env".into()))
    } else {
        (None, None)
    };

    Ok(CredentialStatus {
        active_kind,
        active_source,
        has_oauth_stored,
        has_api_key_stored,
        has_oauth_env,
        has_api_key_env,
        local_cli_installed,
        local_cli_authenticated,
    })
}

/// Kill the running sidecar (if any) and spawn a fresh one with current credentials.
#[tauri::command]
fn restart_sidecar(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let had_child = {
        let mut sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
        sidecar.running = false;
        if let Some(child) = sidecar.child.take() {
            let _ = child.kill();
            true
        } else {
            false
        }
    };
    // CommandChild::kill() is non-blocking. Give the OS a brief moment to release
    // the port and the SQLite file lock before the new sidecar opens them.
    if had_child {
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    spawn_sidecar(&app, &state)
}

/// Locate the `claude` CLI binary for the Agent SDK.
/// Checks well-known install paths first, then searches PATH.
fn find_claude_path() -> String {
    // Check well-known locations
    if let Some(home) = std::env::var_os("HOME") {
        let home = std::path::PathBuf::from(home);
        for candidate in [
            home.join(".local/bin/claude"),
            home.join(".claude/local/claude"),
        ] {
            if candidate.exists() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    // Search PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in path_var.split(':') {
            let candidate = std::path::PathBuf::from(dir).join("claude");
            if candidate.exists() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    // Fallback — let the SDK try to find it
    String::new()
}

/// Resolve the active credential to inject into the sidecar.
/// Returns (oauth_token, api_key) — only one non-empty, or both empty when
/// the local Claude Code CLI is authenticated (the sidecar then lets the CLI
/// subprocess use its own keychain creds).
///
/// Precedence matches `get_credential_status`: stored creds > local CLI > env.
fn resolve_credentials(app: &AppHandle) -> (String, String) {
    if let Some(token) = read_credential(app, OAUTH_FILE) {
        return (token, String::new());
    }
    if let Some(key) = read_credential(app, API_KEY_FILE) {
        return (String::new(), key);
    }
    if local_cli_has_credentials() && !find_claude_path().is_empty() {
        return (String::new(), String::new());
    }
    if let Ok(token) = std::env::var("CLAUDE_CODE_OAUTH_TOKEN") {
        if !token.trim().is_empty() {
            return (token, String::new());
        }
    }
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.trim().is_empty() {
            return (String::new(), key);
        }
    }
    (String::new(), String::new())
}

fn spawn_sidecar(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let port = find_available_port();
    let auth_token = generate_auth_token();

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    let db_path = data_dir.join("data.db");

    let (oauth_token, api_key) = resolve_credentials(app);
    let claude_path = find_claude_path();

    let shell = app.shell();
    let sidecar_command = shell
        .sidecar("coding-tutor-sidecar")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("PORT", port.to_string())
        .env("AUTH_TOKEN", auth_token.clone())
        .env("DATABASE_PATH", db_path.to_string_lossy().to_string())
        .env("ANTHROPIC_API_KEY", api_key)
        .env("CLAUDE_CODE_OAUTH_TOKEN", oauth_token)
        .env("CLAUDE_PATH", claude_path);

    let (_rx, child) = match sidecar_command.spawn() {
        Ok(pair) => pair,
        Err(e) => {
            // Ensure state reflects the failure so a subsequent restart_sidecar
            // doesn't think a previous child is still alive.
            if let Ok(mut sidecar) = state.sidecar.lock() {
                sidecar.running = false;
                sidecar.child = None;
            }
            return Err(format!("Failed to spawn sidecar: {}", e));
        }
    };

    let mut sidecar = state.sidecar.lock().map_err(|e| e.to_string())?;
    sidecar.port = port;
    sidecar.auth_token = auth_token;
    sidecar.running = true;
    sidecar.child = Some(child);

    log::info!("Sidecar spawned on port {}", port);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env so CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY are available as fallback
    dotenvy::dotenv().ok();

    let app_state = AppState {
        sidecar: Mutex::new(SidecarState {
            port: 0,
            auth_token: String::new(),
            running: false,
            child: None,
        }),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_sidecar_info,
            get_sidecar_status,
            get_credential_status,
            store_credential,
            clear_credential,
            restart_sidecar,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let state = handle.state::<AppState>();
            if let Err(e) = spawn_sidecar(&handle, &state) {
                log::error!("Failed to spawn sidecar: {}", e);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
