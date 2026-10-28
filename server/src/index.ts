import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createAssistant } from "./assistant/agent.ts";
import { createBotStore } from "./bots/store.ts";
import { loadConfig } from "./config.ts";
import { connectDatabase } from "./db/index.ts";

const config = loadConfig(process.env);
const { db } = await connectDatabase(config.databaseUrl);

// The SDK finds its own credentials (ANTHROPIC_API_KEY or an `ant auth login` profile);
// without any, the assistant answers each run with an error and everything else keeps working.
const anthropic = new Anthropic();
await createBotStore(db).ensure({ id: "assistant", name: "Asistente", url: "builtin:assistant" });
const builtinAgents = { assistant: () => createAssistant({ client: anthropic, model: config.assistantModel }) };

// Sign-in arrives with T7; until then the API admits nobody rather than everybody.
const identify = async () => null;
serve({ fetch: createApp({ db, identify, builtinAgents }).fetch, port: config.port }, ({ port }) => {
  console.log(`personalBot server listening on http://localhost:${port}`);
});
