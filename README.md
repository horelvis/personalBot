# personalBot

A self-hosted agent platform for one person. Bots speak the open [AG-UI](https://docs.ag-ui.com) protocol, and threads, memory and the tool audit log live in your own PostgreSQL. No hosted service is required to start it, and nothing is held back as a paid component: everything here is MIT.

personalBot started as an alternative to [CopilotKit/openbot](https://github.com/CopilotKit/openbot), written from scratch. openbot needs CopilotKit Intelligence to start, and its threads and memory live there. personalBot keeps the same idea, a chat with AG-UI bots, but stores everything in your own database.

## What it does

- **Threads you own.** Every conversation is stored in your Postgres. Each thread belongs to one person, and only one run can be active in a thread at a time.
- **Any AG-UI bot.** Register a bot by URL (LangGraph, Mastra, CrewAI, Pydantic AI or your own). The server sends it the thread history from the database, streams its AG-UI events to the browser and stores the result.
- **A built-in assistant.** Claude, running in-process, with `remember` and `recall` tools backed by per-person memory.
- **A tool gateway.** Every tool call the built-in assistant makes is checked against allow/deny rules, and an audit row is written before the tool runs. If the gateway fails, the tool does not run.
- **One person per instance.** Each instance serves one person; someone else runs their own instance. That person signs in through any OpenID Connect provider (Google, Microsoft Entra, Keycloak, Authentik and others), and only the email in `OWNER_EMAIL` gets in. A single-user mode is available for local development.

## Run it

You need Docker with Compose v2.24 or newer.

```sh
cp .env.example .env   # then fill in the sign-in settings
docker compose up --build
```

Open http://localhost:3001. The image runs the database migrations on start.

## Develop

You need Node 26 and a Postgres. `docker compose up postgres` gives you one.

```sh
npm install
cp .env.example .env
# server, on :3001
NODE_ENV=development SINGLE_USER=true node --env-file=.env server/src/index.ts
# web app, on :5173, proxying /api and /auth to :3001
npm run dev --workspace web
```

Checks:

```sh
npm test            # server and web tests (the server uses PGlite, so no Postgres is needed)
npm run typecheck
```

## Configuration

Every setting is an environment variable; `.env.example` lists them all.

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `PORT` | no | Defaults to `3001`. |
| `ANTHROPIC_API_KEY` | for the built-in assistant | Without it, the assistant answers each run with an error. Everything else keeps working. |
| `ASSISTANT_MODEL` | no | Defaults to `claude-opus-5-5`. With a gateway, use its model name, such as `deepseek/deepseek-v4.1-flash` on OpenRouter. |
| `ANTHROPIC_BASE_URL` | no | Sends the assistant through a gateway that speaks the Anthropic Messages API, such as OpenRouter (`https://openrouter.ai/api`) or DeepSeek (`https://api.deepseek.com/anthropic`). Anthropic-only features (server-side fallbacks) are then left out. |
| `ANTHROPIC_AUTH_TOKEN` | with OpenRouter | The gateway key, sent as a bearer token. Leave `ANTHROPIC_API_KEY` empty. |
| `SINGLE_USER` | no | `true` signs every request in as one local person. Refused unless `NODE_ENV=development`. |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | for sign-in | Your OpenID provider. The secret is optional for public clients. |
| `PUBLIC_URL` | with OIDC | The address people open. Register `<PUBLIC_URL>/auth/callback` as the redirect URI. |
| `OWNER_EMAIL` | with OIDC | The email of the one person this instance serves. Anyone else the provider signs in gets 403. It is checked on every request, so changing it ends the previous owner's sessions at once. If the owner comes back under a new identity (another provider, or a recreated account), their account and its threads follow them, but only when the provider marks the email verified. |
| `OIDC_TRUST_UNVERIFIED_EMAIL` | no | `true` accepts emails the provider does not mark as verified. Needed for providers that never send `email_verified`, such as Microsoft Entra. |
| `STATIC_DIR` | no | Directory of the built web app to serve. The Docker image sets it. |

With neither OIDC nor `SINGLE_USER` set, the server still starts, but the API admits nobody.

`ADMIN_EMAILS` and `OIDC_ALLOWED_DOMAINS` belong to an earlier team version and have no effect. If either is set, the server warns at startup.

## API

All `/api` routes need a signed-in session.

- `GET /api/me` returns who is signed in.
- `GET /api/bots` lists bots. `POST /api/bots` registers one by URL; it accepts only http(s) URLs.
- `GET|POST /api/threads` lists or creates threads. `GET /api/threads/:id/messages` returns the history. `POST /api/threads/:id/runs` sends a message and streams the AG-UI events back as server-sent events.
- `GET|POST /api/memories` and `DELETE /api/memories/:id` manage the facts remembered about you.
- `GET /auth/login`, `GET /auth/callback` and `POST /auth/logout` handle sign-in.

## Known limits

- Tool rules can only be added in the database for now; there is no admin screen for them yet.
- Registered bot URLs can point anywhere, including private networks. Only the signed-in owner can register bots.
- Sessions last 30 days and are stored in Postgres; an expired session is removed when that person signs in again.

## License

MIT. See [LICENSE](LICENSE).
