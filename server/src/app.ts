import { Hono } from "hono";
import { type Database, ping } from "./db/index.ts";

export interface AppDependencies {
  db: Database;
}

export function createApp({ db }: AppDependencies) {
  const app = new Hono();

  app.get("/health", async (c) => {
    await ping(db);
    return c.json({ status: "ok" });
  });

  return app;
}
