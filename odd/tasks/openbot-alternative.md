# personalBot — alternativa a openbot sin lock-in

Plataforma de agentes para equipos, construida desde cero y ligera, como alternativa a
[CopilotKit/openbot](https://github.com/CopilotKit/openbot). Los bots hablan el protocolo abierto
AG-UI. Los hilos, la memoria y la auditoría viven en el PostgreSQL del usuario y ningún servicio
comercial es obligatorio para arrancar.

- Stack: TypeScript sobre Node 26, npm workspaces, Hono, Drizzle + PostgreSQL (Docker Compose), React + Vite, Vitest.
  Los tests usan PGlite (Postgres en proceso) con el mismo esquema y las mismas migraciones.
- Branch: `leviathan-name-meaning`, worktree `leviathan`.
- Engram mirror: topic `odd/openbot-alternative/tasks`, proyecto `personalBot`.

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
- Supuestos (no pedidos explícitamente; decididos en T7, ver L12):
  - La identidad es `issuer + sub` del ID token; el email solo se usa para mostrar y para las listas de acceso.
  - Por defecto no entra nadie: `OIDC_ALLOWED_DOMAINS` lista los dominios de email admitidos (`*` admite cualquier identidad del issuer). Así, un issuer público como Google no abre el servidor a cualquier cuenta.
  - `ADMIN_EMAILS` define quién es `admin` al iniciar sesión; el resto es `member`. Un email de `ADMIN_EMAILS` puede entrar aunque su dominio no esté en `OIDC_ALLOWED_DOMAINS`.
  - Solo entra un email con `email_verified: true`. Para proveedores que no envían el claim (Microsoft Entra), `OIDC_TRUST_UNVERIFIED_EMAIL=true` lo acepta. Decisión del usuario en L15.
  - El rol se recalcula en cada petición a partir de `ADMIN_EMAILS`, así que quien sale de la lista pierde el rol de admin al momento, aunque tenga una sesión abierta.
  - `SINGLE_USER=true` exige `NODE_ENV=development` explícito; con cualquier otro valor, o sin `NODE_ENV`, el servidor no arranca.
  - Si el proveedor falla durante la callback, se responde 502; un error de protocolo (state, code o nonce) sigue dando 400.
  - Riesgo aceptado: `POST /api/bots` admite cualquier URL http(s), también de red privada o loopback. Solo los admins pueden registrar bots.
  - Una cuenta creada antes del login (sin identidad OIDC) se enlaza una sola vez a la primera identidad que llega con su email. Una cuenta que ya tiene identidad nunca se reasigna, y un cambio de email que choca con otra cuenta se rechaza con 403.
  - Las sesiones viven en Postgres (cookie opaca `HttpOnly`, `SameSite=Lax` y `Secure` en producción; en la base solo se guarda el hash del token), así que se pueden revocar y no hace falta un secreto de firma.
  - Autorización por rol: `GET /api/bots` para cualquier miembro y `POST /api/bots` (registrar un bot AG-UI por URL) solo para `admin`.

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
| T2 | S2 | inline | [x] Store de hilos/mensajes con aislamiento por usuario y bloqueo por hilo | 5b2cf20 |
| T3 | S4, S2 | inline | [x] Relay AG-UI: `POST /api/threads/:id/runs` → bot por URL, SSE al navegador, persistencia | 5fcf544 |
| T4 | S4 | inline | [x] Bot integrado AG-UI con modelo configurable | eb2b7e1 |
| T5 | S3 | inline | [x] Memoria: store, herramientas `remember`/`recall`, inyección en contexto | ffca3fc |
| T6 | S6 | inline | [x] Gateway de herramientas: política + auditoría | 11a3e05 |
| T7 | S5 | inline | [x] Autenticación OIDC, roles, modo usuario único solo en desarrollo. Commits: (a) sesiones + `SINGLE_USER`, (b) OIDC, (c) roles + `/api/bots`, arreglo de colisión de email | 71fbca3, 3de4e13, 8d13cf6, 50bc212 |
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

**L7** T3: RED observado (faltaba `src/bots/store.ts`). GREEN: 18/18 tests y `tsc` exit 0. El relay usa el `HttpAgent` real de `@ag-ui/client` contra un bot AG-UI falso hecho con Hono (`tests/helpers/fake-bot.ts`), así que se ejercita el parseo SSE real. Cubre: 401 sin identidad, aislamiento (404), 409 con el hilo ocupado, historial enviado desde nuestro Postgres, RUN_ERROR ante un bot que falla (el mensaje del usuario se conserva y el hilo se libera). Seguridad: `@ag-ui/*` fija zod 3.25.76 (GHSA-mrhx-c7xc-m3w5, severidad alta, sin parche en 3.x); override de npm a `zod ^4.6.7` → `npm audit --omit=dev` = 0 vulnerabilidades tras una instalación limpia, y los tests siguen en verde. Hasta T7 `index.ts` usa un `identify` que no admite a nadie.

**L8** T4: RED observado (faltaba `src/assistant/agent.ts`, y el test de `ASSISTANT_MODEL` fallaba). GREEN: 23/23 tests y `tsc` exit 0. El asistente es un `AbstractAgent` de AG-UI que se ejecuta en el propio servidor (URL `builtin:assistant`), para no exponer la clave del modelo detrás de una URL pública. Usa `@anthropic-ai/sdk` 1.3.0 con `claude-opus-5-5` por defecto (configurable con `ASSISTANT_MODEL`), streaming, `effort: medium` y `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Una negativa del modelo (`refusal`) se informa como RUN_ERROR. Los tests reproducen el stream SSE real de la Messages API con un `fetch` inyectado. `new Anthropic()` sin credenciales se construye sin error (comprobado), así que S1 se mantiene: el servidor arranca sin clave. rxjs fijado a 7.8.1 (la versión exacta que exige `@ag-ui/client`) para tener una sola copia.

**L9** T5: RED observado (faltaban `src/memory/store.ts` y `src/assistant/memory-tools.ts`; `/api/memories` daba 404). GREEN: 33/33 tests y `tsc` exit 0. Memoria por persona en Postgres, con búsqueda full-text `to_tsvector('simple', …)` (sin stemming dependiente del idioma) e índice GIN. Rutas `GET/POST/DELETE /api/memories` aisladas por usuario. El asistente tiene un bucle de herramientas manual (máximo 10 llamadas al modelo por run) con `eager_input_streaming` y validación zod de cada entrada; una entrada inválida devuelve un `tool_result` con `is_error` y la herramienta no se ejecuta. Las llamadas a herramientas se emiten como eventos TOOL_CALL_* de AG-UI y se guardan en el hilo; en el siguiente run se reconstruyen como `tool_use`/`tool_result`. El prompt de sistema (base + hechos) se calcula una vez por run y no cambia dentro de él (regla de preserved thinking de Opus 5.5: reconstruirlo invalida el thinking anterior). Durante la sesión apareció un fallo aparte: un `:id` que no es UUID daba 500. Se corrigió con su test en el commit 63671d6.

**L10** Pausa en un punto estable: el usuario sale del agente para recargar la configuración (acaba de instalar gentle-ai y Engram). T1–T5 están completas y con commit; árbol limpio; 33/33 tests; `tsc` exit 0; `npm audit --omit=dev` = 0. **Siguiente: T6** (gateway de herramientas con política y auditoría), que debe envolver `runTool` en `server/src/assistant/agent.ts`. Sigue pendiente de S7 verificar `docker compose up` (Docker no estaba instalado). Para retomar: leer este documento hasta `## Log` y ejecutar `cd server && npx vitest run`.

**L11** T6: RED observado (no existía `src/tool-gateway/gateway.ts`). GREEN: 38/38 tests y `tsc` exit 0. Tablas `tool_rules` (herramienta o `*`, allow/deny) y `tool_audit` (migración 0004). Una llamada se permite salvo que una regla que coincide la deniegue; deny gana. El gateway escribe la fila de auditoría antes de devolver la decisión. `agent.ts` consulta `authorize` antes de cada llamada, también para herramientas desconocidas. Una llamada denegada devuelve `tool_result` con `is_error` y la herramienta no se ejecuta. Si el gateway falla, el run termina en `RUN_ERROR` y la herramienta no se ejecuta (fail closed). Risk: item 2 (seguridad). Verificador independiente: S6 pass, sin blockers. Revisión RDD (lentes risk y reliability): aprobada, con acknowledgement hecho. Avisos no bloqueantes para trabajo posterior: (a) `effect` y `decision` no tienen CHECK en la base de datos, así que una regla escrita a mano con un valor como `Deny` se ignora y la llamada se permite; (b) `input ?? null` choca con `input NOT NULL`; (c) `audit()` no tiene criterio de desempate al ordenar; (d) falta un test de aislamiento entre usuarios en `audit()`; (e) `authorize` es opcional en `createAssistant`; (f) `tool_audit.user_id` usa `onDelete: cascade`, así que borrar un usuario borra su historial de auditoría. No hay rutas para administrar reglas (S6 no las pide). Mirror de Engram pendiente: `mem_current_project` no está disponible en esta sesión. **Siguiente: T7.**

**L12** Arreglos tras T6: `98e9d6b` añade CHECK en Postgres a `tool_rules.effect` y `tool_audit.decision`, y deja `tool_audit.input` nullable. RED 3/3 → GREEN 41/41. RDD: `medium`, `under_budget` (queda pendiente en el tramo). El usuario pidió seguir en modo autónomo hasta que haga falta su intervención. T7: no hay ningún writer delegado (falta un motivo según el Writer trigger); se hace inline en tres commits. Risk: item 2 (auth) y 5 (dependencia nueva `openid-client` 6.8.8, de panva, con `jose` y `oauth4webapi`), así que habrá verificador independiente. Diseño hexagonal: un puerto `OidcProvider` con un adaptador sobre `openid-client` y un IdP falso en los tests. Supuestos de S5 anotados arriba.

**L13** T7: RED observado en cada unidad (faltaban los módulos; un test de 502 y otro de colisión de email fallaron antes de su arreglo). GREEN: 66/66 tests, `tsc` exit 0, `npm audit --omit=dev` = 0. Sesiones en Postgres con hash SHA-256 del token y cookie `HttpOnly`, `SameSite=Lax` y `Secure` en producción. `SINGLE_USER=true` se rechaza con `NODE_ENV=production`. OIDC con `openid-client` (PKCE S256, state y nonce en una cookie `HttpOnly` de 10 minutos con path `/auth`); el proveedor caído devuelve 502. La callback se reconstruye sobre `redirectUri`. Los tests usan un IdP falso con `jose` que firma RS256 y comprueba PKCE. `POST /api/bots` es solo para admin y solo acepta URLs http(s); `GET /api/bots` oculta la URL a los miembros. Risk: item 2 (auth) y 5 (dependencia nueva). Verificador independiente: S5 y S1 pass, sin blockers. De sus avisos se arregló la colisión de email (devolvía 500); el resto quedó documentado como supuestos en S5. Queda pendiente: borrar las sesiones caducadas (las filas no se eliminan); `NODE_ENV` se compara exactamente con `production`. Sin servidor real de Postgres (no hay Docker) no se probó el arranque de punta a punta. **Siguiente:** revisión RDD del tramo `11a3e05..HEAD`, y después T8.

**L14** Revisión RDD del tramo `11a3e05..cafc5f7` (lentes risk, resilience y reliability): aprobada, con acknowledgement hecho, y 16 avisos no bloqueantes. Arreglados en `ee2db8a` con RED → GREEN (73/73 tests, `tsc` exit 0):
- el modo de usuario único ya no deja en caché un fallo de la base;
- el insert de cuenta no falla ante el conflicto, por si dos primeros inicios de sesión llegan a la vez;
- el email se busca con `lower()`;
- `PUBLIC_URL` se valida, se respeta su prefijo de ruta y la cookie de login usa la ruta de la callback;
- `OIDC_ALLOWED_DOMAINS` no puede quedar vacío;
- las sesiones caducadas de la persona se borran al crear una nueva;
- tests nuevos de enlace de cuenta previa, de admin fuera de los dominios admitidos y de degradación.

Pendiente de decisión del usuario:
- (a) aceptar un email sin el claim `email_verified` (riesgo de la clase nOAuth frente a la compatibilidad con Entra);
- (b) un admin retirado de `ADMIN_EMAILS` conserva el rol hasta que vuelve a iniciar sesión (las sesiones duran 30 días);
- (c) `SINGLE_USER` solo se rechaza si `NODE_ENV` es exactamente `production`;
- (d) un fallo de red en la callback responde 400 en vez de 5xx;
- (e) `POST /api/bots` admite URLs de red privada o loopback (SSRF limitado a admins).

**L15** Decisión del usuario sobre los puntos (a) a (e) de L14: «Aplicar las 5 (Recomendado)». Implementado en `8bb0c2a` con RED (6 tests) → GREEN (77/77), `tsc` exit 0:
- (a) se exige `email_verified: true`, salvo con `OIDC_TRUST_UNVERIFIED_EMAIL=true`;
- (b) el rol se recalcula en cada petición;
- (c) `SINGLE_USER` necesita `NODE_ENV=development`. Esto endurece lo que pedía S5 («se niega a arrancar si `NODE_ENV=production`»): ahora también se niega con cualquier otro valor;
- (d) se responde 502 cuando el proveedor falla en la callback. Un `TypeError` de red se distingue de los errores OAuth de openid-client;
- (e) se acepta como riesgo y queda documentado en S5.

**L16** Revisión RDD de `e161ebd..fb50b0c`: aprobada, con acknowledgement hecho. Su aviso principal era que un proveedor caído que responde con un 5xx en HTML o con `server_error`/`temporarily_unavailable` seguía dando 400. Arreglado en `94fb30f`: RED 3/3 → GREEN 81/81; un `code` rechazado por el proveedor sigue dando 400.

**L17** Revisión RDD del arreglo de caídas: aprobada, con acknowledgement hecho. Avisos menores que quedan como seguimiento:
- falta un test de `error=server_error` en la propia redirección de la callback;
- falta un test de un 400 con `server_error`;
- `OAUTH_RESPONSE_IS_NOT_CONFORM` también convierte en 502 un 200 que no es conforme;
- los tests de caída no comprueban que no se crea sesión.

T7 queda cerrada. **Siguiente: T8** (app web).
