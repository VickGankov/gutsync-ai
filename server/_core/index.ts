import "dotenv/config";
import { registerStripeRoutes } from "../stripe";
import { registerSeoRoutes } from "../seo/routes";
import { registerReportRoute } from "../report/service";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { MEDIA_ROUTE, isValidMediaKey, presignedGetUrl, storageMode } from "../storage";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startReminderScheduler } from "../reminders";
import { registerGoogleAuthRoutes } from "../googleAuth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  registerStripeRoutes(app); // raw body, so it goes before express.json
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback (disabled for email-only auth)
  // registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);
  registerReportRoute(app);
  registerSeoRoutes(app); // public landing + blog as real HTML, before the SPA fallthrough
  // Meal photos stored in a private bucket: redirect to a short-lived signed URL.
  app.get(`${MEDIA_ROUTE}/*`, async (req, res) => {
    const key = decodeURIComponent(req.path.slice(MEDIA_ROUTE.length + 1));
    if (storageMode() !== "s3" || !isValidMediaKey(key)) {
      res.status(404).end();
      return;
    }
    try {
      res.set("Cache-Control", "private, max-age=3000");
      res.redirect(302, await presignedGetUrl(key));
    } catch (error) {
      console.error("[Media] Failed to sign URL", error);
      res.status(500).end();
    }
  });
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

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startReminderScheduler();
  });
}

startServer().catch(console.error);
