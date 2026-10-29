import type { HttpAgentFetchFn } from "@ag-ui/client";
import { Hono } from "hono";
import type { Identify, User } from "./auth/identify.ts";
import { type Database, ping } from "./db/index.ts";
import { memoryRoutes } from "./memory/routes.ts";
import { type BuiltinAgents, threadRoutes } from "./threads/routes.ts";

export interface AppDependencies {
  db: Database;
  identify: Identify;
  /** How the server reaches AG-UI bots; the global fetch unless a test replaces it. */
  agentFetch?: HttpAgentFetchFn;
  builtinAgents?: BuiltinAgents;
  /** Sign-in and sign-out routes, mounted at /auth outside the signed-in API. */
  auth?: Hono;
}

export function createApp({ db, identify, agentFetch, builtinAgents, auth }: AppDependencies) {
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
  api.route("/threads", threadRoutes(db, { agentFetch, builtinAgents }));
  api.route("/memories", memoryRoutes(db));
  app.route("/api", api);

  return app;
}
