import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { DevBranchTag } from "@/components/DevBranchTag";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CredentialProvider } from "@/hooks/useCredentialStatus";
import { initSidecar, retrySidecarConnection } from "@/lib/sidecar";
import Home from "@/pages/Home";
import SessionPage from "@/pages/SessionPage";
import "@/app/globals.css";

// Mark Tauri mode on <html> so CSS can add traffic-light inset
if (window.__TAURI_INTERNALS__) {
  document.documentElement.dataset.tauri = "";

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "r") {
      e.preventDefault();
      window.location.reload();
    }
  });
}

function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <CredentialProvider>
          <DevBranchTag />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={
                  <SidebarProvider>
                    <Home />
                  </SidebarProvider>
                }
              />
              <Route path="/projects/:projectId/sessions/:sessionId" element={<SessionPage />} />
            </Routes>
          </BrowserRouter>
        </CredentialProvider>
      </ThemeProvider>
    </StrictMode>
  );
}

async function retrySidecar() {
  await retrySidecarConnection();
  renderApp();
}

function renderSidecarError(message: string) {
  createRoot(document.getElementById("root")!).render(
    <ThemeProvider>
      <div className="flex h-svh w-full items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-bold text-foreground">Failed to start backend</h1>
          <p className="text-sm text-muted-foreground">
            The local sidecar process didn't respond. This usually means the backend crashed on
            launch, or another instance is holding the port.
          </p>
          <pre className="text-left text-xs text-muted-foreground bg-muted px-3 py-2 overflow-auto">
            {message}
          </pre>
          <button
            type="button"
            onClick={() => {
              retrySidecar().catch((err: unknown) => {
                console.error("Retry failed:", err);
                renderSidecarError(err instanceof Error ? err.message : String(err));
              });
            }}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    </ThemeProvider>
  );
}

// Initialize sidecar connection before rendering.
// In Tauri, this fetches the port + auth token from the Rust core via invoke().
// In dev mode (no Tauri), it falls back to localhost:3001 defaults.
initSidecar()
  .then(renderApp)
  .catch((err: unknown) => {
    console.error("Sidecar initialization failed:", err);
    renderSidecarError(err instanceof Error ? err.message : String(err));
  });
