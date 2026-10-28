import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { connectDatabase } from "./db/index.ts";

const config = loadConfig(process.env);
const { db } = await connectDatabase(config.databaseUrl);
// Sign-in arrives with T7; until then the API admits nobody rather than everybody.
const identify = async () => null;
serve({ fetch: createApp({ db, identify }).fetch, port: config.port }, ({ port }) => {
  console.log(`personalBot server listening on http://localhost:${port}`);
});
