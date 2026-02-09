import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import Home from "@/pages/Home";
import SessionPage from "@/pages/SessionPage";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
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
          <Route
            path="/projects/:projectId/sessions/:sessionId"
            element={<SessionPage />}
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
