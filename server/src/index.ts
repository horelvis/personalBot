import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createOpenIdProvider } from "./auth/oidc-client.ts";
import { authRoutes } from "./auth/routes.ts";
import { chooseIdentify } from "./auth/choose-identify.ts";
import { createSessionStore } from "./auth/sessions.ts";
import type { BuiltinAgents } from "./threads/routes.ts";
import { createAssistant } from "./assistant/agent.ts";
import { memoryTools } from "./assistant/memory-tools.ts";
import { createBotStore } from "./bots/store.ts";
import { loadConfig } from "./config.ts";
import { connectDatabase } from "./db/index.ts";
import { createMemoryStore } from "./memory/store.ts";
import { createToolGateway } from "./tool-gateway/gateway.ts";

const config = loadConfig(process.env);
const { db } = await connectDatabase(config.databaseUrl);

// The SDK finds its own credentials (ANTHROPIC_API_KEY or an `ant auth login` profile);
// without any, the assistant answers each run with an error and everything else keeps working.
const anthropic = new Anthropic();
await createBotStore(db).ensure({ id: "assistant", name: "Asistente", url: "builtin:assistant" });
const memories = createMemoryStore(db);
const toolGateway = createToolGateway(db);
const builtinAgents: BuiltinAgents = {
  assistant: ({ user }) =>
    createAssistant({
      client: anthropic,
      model: config.assistantModel,
      tools: memoryTools(memories, user.id),
      authorize: (call) => toolGateway.authorize({ ...call, userId: user.id }),
      context: async () => {
        const facts = await memories.list(user.id, 50);
        return facts.length ? `What you know about this person:\n${facts.map((fact) => `- ${fact.content}`).join("\n")}` : "";
      },
    }),
};

const sessions = createSessionStore(db);
const identify = chooseIdentify(config, { db, sessions });
for (const warning of config.warnings) console.warn(warning);
if (config.singleUser) console.warn("SINGLE_USER=true: every request is the local person. Development only.");
else if (!config.oidc) console.warn("No sign-in configured: set OIDC_ISSUER (or SINGLE_USER=true in development). The API admits nobody.");
const auth = authRoutes({
  sessions,
  secureCookies: config.production,
  ...(config.oidc ? { oidc: createOpenIdProvider(config.oidc), db, access: config.oidc } : {}),
});
serve({ fetch: createApp({ db, identify, builtinAgents, auth, staticDir: config.staticDir }).fetch, port: config.port }, ({ port }) => {
  console.log(`personalBot server listening on http://localhost:${port}`);
});
