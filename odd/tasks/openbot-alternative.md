# personalBot — alternativa a openbot sin lock-in

Plataforma de agentes para equipos, construida desde cero y ligera, como alternativa a
[CopilotKit/openbot](https://github.com/CopilotKit/openbot). Los bots hablan el protocolo abierto
AG-UI. Los hilos, la memoria y la auditoría viven en el PostgreSQL del usuario y ningún servicio
comercial es obligatorio para arrancar.

- Stack: TypeScript sobre Node 26, npm workspaces, Hono, Drizzle + PostgreSQL (Docker Compose), React + Vite, Vitest.
  Los tests usan PGlite (Postgres en proceso) con el mismo esquema y las mismas migraciones.
- Branch: `leviathan-name-meaning`, worktree `leviathan`.
- Engram mirror `odd/openbot-alternative/tasks`: **pendiente** (Engram no está instalado en esta máquina).

## Specs

**S1 — Cero lock-in: arranca sin servicios comerciales.**
Cita: «depende de Lock-in con CopilotKit Intelligence. Es lo más importante. El servidor se niega a
arrancar sin INTELLIGENCE_API_URL, INTELLIGENCE_GATEWAY_WS_URL e INTELLIGENCE_API_KEY».
- El servidor arranca con solo `DATABASE_URL` (más la clave del proveedor del modelo para el bot integrado).
- Ninguna dependencia de `@copilotkit/*` ni de ningún servicio alojado que guarde estado.
- Check: test de configuración que arranca la app solo con `DATABASE_URL`; `grep -r copilotkit` vacío en el código.

**S2 — Hilos propios y persistentes.**
Cita: «es ahí donde viven los hilos y la memoria».
- Los hilos y sus mensajes se guardan en nuestro Postgres; tras reiniciar el servidor el historial sigue ahí.
- Cada hilo pertenece a un usuario y nadie más puede leerlo.
- Solo una ejecución activa por hilo a la vez (bloqueo en Postgres); la segunda recibe 409.
- Check: tests de store (crear, listar, añadir, historial) y test de aislamiento entre usuarios.

**S3 — Memoria propia.**
- Cada usuario tiene memorias (hechos) en Postgres: crear, listar, borrar y buscar (full-text).
- El bot integrado puede `remember` y `recall`; las memorias relevantes se inyectan en el contexto.
- Check: tests de store y de herramientas.

**S4 — Bots por AG-UI, sin atarse a un framework.**
- Un bot es un endpoint HTTP AG-UI registrado por URL (LangGraph, Mastra, CrewAI, Pydantic AI o hecho a mano).
- El servidor reenvía el turno al bot con el historial de nuestro Postgres, retransmite los eventos AG-UI al navegador por SSE y persiste el resultado.
- Incluye un bot integrado (asistente general) que habla AG-UI y usa un modelo configurable.
- Check: test de relay contra un bot AG-UI falso; test del bot integrado con el modelo simulado.

**S5 — Equipo/empresa.**
Respuesta del usuario: «Equipo/empresa».
- Varios usuarios con inicio de sesión (OIDC genérico: Google, Microsoft Entra, Keycloak…), roles `admin` y `member`.
- Un modo de desarrollo de usuario único (`SINGLE_USER=true`) que se niega a arrancar si `NODE_ENV=production`.
- Check: tests de autenticación y de autorización por rol.

**S6 — Gateway de herramientas con política y auditoría.**
- Toda llamada a herramienta del bot integrado pasa por un gateway que decide (allow/deny por regla) y registra una fila de auditoría antes de actuar.
- Check: test de que una regla deny bloquea la herramienta y deja auditoría.

**S7 — Instalación de producción real, no un preview.**
Cita: «La alternativa local es una preview para macOS con Docker Desktop, no una instalación de producción, con licencia de 30 días renovable».
- `docker compose up` levanta Postgres + servidor + app en cualquier host Linux/macOS, sin licencias ni caducidad.
- Check: `docker compose config` válido y arranque verificado cuando Docker esté disponible.

**S8 — Todo el código abierto, sin embudo de ventas.**
Cita: «El código es MIT, pero una pieza crítica es comercial. Y el README lleva varios CTAs de "lo montamos por ti". Es un embudo de ventas bien hecho.»
- Licencia MIT en todo el repositorio, sin piezas críticas cerradas.
- README sin CTAs comerciales.
- Check: revisión del README y de `LICENSE`.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S7 | inline | [x] Andamiaje: workspaces, TS, Vitest, Docker Compose de Postgres, esquema Drizzle + migraciones, config que solo exige `DATABASE_URL` | 415b90e |
| T2 | S2 | inline | [x] Store de hilos/mensajes con aislamiento por usuario y bloqueo por hilo | ver L6 |
| T3 | S4, S2 | inline | [ ] Relay AG-UI: `POST /api/threads/:id/runs` → bot por URL, SSE al navegador, persistencia | |
| T4 | S4 | inline | [ ] Bot integrado AG-UI con modelo configurable | |
| T5 | S3 | inline | [ ] Memoria: store, herramientas `remember`/`recall`, inyección en contexto | |
| T6 | S6 | inline | [ ] Gateway de herramientas: política + auditoría | |
| T7 | S5 | inline | [ ] Autenticación OIDC, roles, modo usuario único solo en desarrollo | |
| T8 | S2, S4 | inline | [ ] App web: lista de hilos, chat con streaming, memorias | |
| T9 | S7, S8 | inline | [ ] Dockerfile + compose completo, README honesto, LICENSE MIT | |

## Log

**L1** (petición original, literal):
> crear una alternativa a https://github.com/CopilotKit/openbot porque depende de Lock-in con CopilotKit Intelligence. Es lo más importante. El servidor se niega a arrancar sin INTELLIGENCE_API_URL, INTELLIGENCE_GATEWAY_WS_URL e INTELLIGENCE_API_KEY, y es ahí donde viven los hilos y la memoria. La alternativa local es una preview para macOS con Docker Desktop, no una instalación de producción, con licencia de 30 días renovable. El código es MIT, pero una pieza crítica es comercial. Y el README lleva varios CTAs de "lo montamos por ti". Es un embudo de ventas bien hecho.

**L2** Decisiones del usuario: enfoque «Desde cero, ligero»; alcance «Equipo/empresa»; entorno «Node + Postgres en Docker»; metodología «debes usar metodolpogia ODD» → https://github.com/Gentleman-Programming/gentle-ai

**L3** Exploración de openbot (commit clonado en el scratchpad): `server/src/copilot.ts` monta `@copilotkit/runtime/v2` siempre en modo Intelligence («There is no SSE branch»). Intelligence guarda el historial de hilos (`getThreadMessages`), el bloqueo de hilos (`toolkit/src/copilotkit/thread-lock.ts`), el WebSocket del runner y la memoria/Learning (`server/src/memory/intelligence.ts`, `server/src/learning/*`). Unos 30 archivos dependen de ello.

**L4** Supuestos (reversibles): Docker no está instalado todavía en esta Mac, así que los tests usan PGlite y el arranque con Docker se verifica cuando esté disponible. El bot integrado usa Claude por defecto mediante el SDK de Anthropic; otros proveedores llegan como bots AG-UI.

**L5** T1: RED observado (`tests/config.test.ts` y `tests/health.test.ts` fallaban porque faltaban los módulos). GREEN: `npx vitest run` → 2 archivos y 4 tests pasan; `npx tsc --noEmit` → exit 0; `grep -rli copilotkit` fuera de `odd/` → sin coincidencias. Node 26 ejecuta TS directamente (sin `tsx`). Pendiente de S7: `docker compose up` no se ha verificado porque Docker no está instalado.

**L6** T2: RED observado (faltaba `src/threads/store.ts`). Primer GREEN con un fallo real: el orden de `list` empataba porque PGlite solo tiene precisión de milisegundos (comprobado: `now()` repite `22:27:24.594`). Solución: el store usa un único reloj inyectable para `created_at`/`updated_at`, y el test le pasa un reloj que avanza. `npx vitest run` → 10/10 tests en 3 ejecuciones seguidas; `tsc` → exit 0. Specs cubiertas: S2 (persistencia tras una nueva instancia, upsert por id, aislamiento entre usuarios, un solo run por hilo y recuperación de bloqueos abandonados).
