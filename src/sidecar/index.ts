import express from "express";
import cors from "cors";
import { initDatabase, closeDatabase } from "./database";
import { router } from "./routes";
import { handleChat } from "./chatRoute";

// Read configuration from environment (injected by Rust shell)
const PORT = parseInt(process.env.PORT || "3001", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const DATABASE_PATH = process.env.DATABASE_PATH || "./data.db";

// Initialize database
console.log(`[sidecar] Initializing database at ${DATABASE_PATH}`);
initDatabase(DATABASE_PATH);

// Create Express app
const app = express();

// CORS — allow requests from the Tauri webview
app.use(
  cors({
    origin: true, // Allow all origins (localhost with varying ports)
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));

// Auth middleware — verify bearer token on every request
if (AUTH_TOKEN) {
  app.use((req, res, next) => {
    // Skip auth for health check
    if (req.path === "/health") {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use(router);

// Chat endpoint (SSE streaming)
app.post("/api/chat", handleChat);

// Start server
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`[sidecar] Server listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log("[sidecar] Shutting down...");
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
