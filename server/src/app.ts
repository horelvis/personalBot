import type { HttpAgentFetchFn } from "@ag-ui/client";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Identify, User } from "./auth/identify.ts";
import { botRoutes } from "./bots/routes.ts";
import { type Database, ping } from "./db/index.ts";
import { memoryRoutes } from "./memory/routes.ts";
import { type BuiltinAgents, threadRoutes } from "./threads/routes.ts";

export interface AppDependencies {
  db: Database;
  identify: Identify;
  /** How the server reaches AG-UI bots; the global fetch unless a test replaces it. */
  agentFetch?: HttpAgentFetchFn;
  builtinAgents?: BuiltinAgents;
  /** The built web app; when set, it is served next to the API, so one container is enough. */
  staticDir?: string;
  /** Sign-in and sign-out routes, mounted at /auth outside the signed-in API. */
  auth?: Hono;
}

export function createApp({ db, identify, agentFetch, builtinAgents, auth, staticDir }: AppDependencies) {
  const app = new Hono();

  app.get("/health", async (c) => {
    await ping(db);
    return c.json({ status: "ok" });
  });

  if (auth) app.route("/auth", auth);

  const api = new Hono<{ Variables: { user: User } }>();
  api.use(async (c, next) => {
    const user = await identify(c);
    if (!user) return c.json({ error: "Sign in required" }, 401);
    c.set("user", user);
    await next();
  });
  api.get("/me", (c) => {
    const { id, email, name, role } = c.var.user;
    return c.json({ id, email, name, role });
  });
  api.route("/bots", botRoutes(db));
  api.route("/threads", threadRoutes(db, { agentFetch, builtinAgents }));
  api.route("/memories", memoryRoutes(db));
  // Unknown API paths stay 404 even when the web app's index.html fallback is mounted below.
  api.all("*", (c) => c.notFound());
  app.route("/api", api);

  if (staticDir) {
    app.use("*", serveStatic({ root: staticDir }));
    // Client-side routes such as /threads/:id load the app; unknown /auth paths stay 404.
    app.get("*", async (c, next) => (c.req.path.startsWith("/auth/") ? next() : serveStatic({ path: join(staticDir, "index.html") })(c, next)));
  }

  return app;
}
