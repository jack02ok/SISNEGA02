import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Fonnte WA Gateway Proxy
  app.post("/api/fonnte/send", async (req, res) => {
    try {
      const { target, message, token } = req.body;
      if (!target || !message) {
        return res.status(400).json({ status: false, message: "Target and message are required" });
      }

      const fonnteToken = token || process.env.FONNTE_TOKEN;
      if (!fonnteToken) {
        return res.status(400).json({ status: false, message: "Fonnte API Token is not configured" });
      }

      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": fonnteToken,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          target: target,
          message: message,
        }).toString(),
      });

      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error("Fonnte API Proxy Error:", error);
      return res.status(500).json({ status: false, message: error.message || "Failed to send WA message" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Sistem Informasi SD Terpadu" });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SISFO SD Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
