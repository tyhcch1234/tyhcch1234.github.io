import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getTools } from "../catalog";
import { catalogCors } from "../catalogCors";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", async (_req, res) => {
    try {
      const tools = await getTools();
      res.status(tools.length ? 200 : 503).json({ status: tools.length ? "ok" : "initializing", toolCount: tools.length });
    } catch {
      res.status(503).json({ status: "catalog_unavailable" });
    }
  });
  app.use("/api/tools", catalogCors);
  app.get("/api/tools", async (_req, res) => {
    try {
      const tools = await getTools();
      if (!tools.length) return res.status(503).json({ error: "工具資料尚未準備好，請稍後重試。" });
      res.set("Cache-Control", "public, max-age=60").json({ tools, verifiedDate: "2026-11-09" });
    } catch (error) {
      console.error("Catalog read failed:", error instanceof Error ? error.message : "Database error");
      res.status(503).json({ error: "暫時未能讀取工具資料，請重試。" });
    }
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });
