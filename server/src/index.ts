import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { connectDatabase } from "./db/index.ts";

const config = loadConfig(process.env);
const { db } = await connectDatabase(config.databaseUrl);
serve({ fetch: createApp({ db }).fetch, port: config.port }, ({ port }) => {
  console.log(`personalBot server listening on http://localhost:${port}`);
});
