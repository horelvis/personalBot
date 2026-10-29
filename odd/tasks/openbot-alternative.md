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

**S5 — Una persona por instancia** (reescrita en L22; antes «Equipo/empresa»).
Respuesta del usuario (2026-10-29): «una persona por instancia».
- Cada instancia sirve a una única persona; otra persona levanta su propia instancia.
- Nadie más que esa persona puede usar la API de la instancia.
- Autenticación (decisión del usuario en L23): «OIDC con un solo email». Se reutiliza el OIDC de T7 (PKCE, state y nonce, sesiones en Postgres, `email_verified` y `OIDC_TRUST_UNVERIFIED_EMAIL`). Con `OIDC_ISSUER` configurado, `OWNER_EMAIL` es obligatorio y solo entra ese email; cualquier otra identidad recibe 403.
- La comprobación se repite en cada petición: si `OWNER_EMAIL` cambia, las sesiones del email anterior dejan de valer.
- Desaparecen los roles (`admin`/`member`), `ADMIN_EMAILS` y `OIDC_ALLOWED_DOMAINS`. Quien inicia sesión es la dueña o el dueño y puede registrar bots.
- `SINGLE_USER=true` se mantiene para desarrollo, igual que antes (exige `NODE_ENV=development`).
- Check: tests de autenticación que prueban que solo entra `OWNER_EMAIL`, que se rechaza cualquier otro email y que, si cambia `OWNER_EMAIL`, las sesiones anteriores dejan de valer.

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
| T8 | S2, S4 | delegada (motivo: límite de contexto de la sesión padre) | [x] App web: lista de hilos, chat con streaming, memorias | 0dd8636 |
| T9 | S7, S8 | inline | [x] Dockerfile + compose completo, README honesto, LICENSE MIT | 7759cb7, 7152fac, eb0463f |
| T10 | S5 | delegada (motivo: límite de contexto de la sesión padre) | [x] Auth para una persona por instancia: OIDC con `OWNER_EMAIL`, sin roles | 6f5e159, 3c77d64 |

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

**L18** T8 (writer delegado): workspace `web/` con React 19.3.1 y Vite 8.3.5. El cliente API está separado de los contenedores y estos de los componentes presentacionales; CSS plano. RED 7/7 → GREEN 7/7, `tsc` exit 0, `vite build` correcto, servidor 81/81, `npm audit --omit=dev` = 0. El padre comprobó que el diff no sale de las rutas autorizadas, volvió a ejecutar los tests (7/7 y 81/81) y confirmó que no hay HTML sin escapar. Commit `0dd8636`. Huecos:
- el arranque en navegador contra un servidor real sigue sin probarse;
- el formulario de memorias se vacía aunque falle al guardar;
- `/api/me` no reintenta tras un error que no sea 401.

Risk: item 5 (dependencias nuevas y un workspace nuevo en el lockfile raíz). **Siguiente: T9.**

**L19** T9:
- `7759cb7`: el servidor sirve `STATIC_DIR`.
- `7152fac`: Dockerfile de una sola imagen, servicio `app` en el compose, LICENSE MIT, campo `license` en los `package.json` y README sin CTAs.

Verificador independiente de T8 y T9:
- S1, S2, S4 y S8 pass.
- S7 pass por lectura: `npm ci --workspace server --omit=dev` funciona en una copia aparte, y el arranque de producción sin Docker funciona contra `pglite-socket` (migraciones, `/health`, HTML, `/api/me` 401).
- `docker compose config` y el arranque con Docker siguen sin probarse, porque Docker no está instalado.
- Blocker: con `STATIC_DIR`, un GET con sesión a una ruta `/api` desconocida devolvía `index.html` con 200 en vez de 404. Arreglado en `eb0463f`: RED → GREEN (85/85), y la salida es idéntica a la de sin `STATIC_DIR`.

Del mismo verificador se aplicaron dos avisos: Postgres publicado solo en `127.0.0.1`, y `PORT` respetado en los puertos del compose y en el `HEALTHCHECK`. Pendiente: la contraseña de Postgres está fija en el compose.

Todas las tareas T1–T9 están completas. Pendiente del usuario: push y PR.

**L20** S7 verificado con Docker 29.9.2 y Compose v5.6.1:
- `docker compose config` es válido.
- `docker compose up --build` construye la imagen (392 MB, corre como el usuario `node`), Postgres pasa a healthy y la app también.
- `/health` 200, `/` y `/threads/abc` 200 HTML, `/api/me` y `/api/unknown` 401, `POST /auth/logout` 204, y se aplicaron las 8 migraciones.
- `SINGLE_USER=true` dentro de la imagen se niega a arrancar.
- Un dato insertado sobrevive a `docker compose restart`.

El stack de prueba (proyecto `personalbot-s7`) se desmontó con su volumen.

**L21** Idea aplazada por el usuario («vamos a dejarlo por ahora»): ejecutar Python para analizar datos. Opciones evaluadas:
1. La herramienta de ejecución de código de Anthropic (`code_execution_20260521`): no hay que montar nada y los ficheros llegan por la Files API, pero solo sirve para el asistente integrado y los datos se procesan en Anthropic.
2. Docker Sandboxes: la API y el SDK solo cubren los sandboxes en la nube, que son de pago; la versión local es gratis pero está pensada para la CLI de agentes (`sbx run`). Es la que peor encaja.
3. Un sandbox propio con Docker Engine: un contenedor efímero por ejecución, sin red, con el sistema de archivos de solo lectura, límites de CPU, memoria y tiempo, y gVisor como opción. Es la más coherente con S1, pero exige proteger el acceso del servidor al Docker del host.

Recomendación: un puerto `CodeSandbox` con el adaptador 3 por defecto y el 1 como opcional, ambos detrás del gateway de T6 (política + auditoría). Sin implementar.

**L22** Cambio de requisito del usuario (2026-10-29), literal: «tengo una duda, personalBot es para ser usado por solo una perosna, otra persona sería otra instancia del bot» y, a la pregunta «¿una persona por instancia o equipo/empresa?»: «una persona por instancia». Esto sustituye la respuesta «Equipo/empresa» de L2. S5 está reescrita. T7 queda invalidada en parte: los roles, `ADMIN_EMAILS`, `OIDC_ALLOWED_DOMAINS`, el enlace de cuentas y la limitación de `SINGLE_USER` a desarrollo ya no responden al requisito. Se abre T10 para adaptarlo. La memoria por persona y el aislamiento por `owner_id` siguen siendo correctos con una sola persona y no hace falta tocarlos. La cadena de PRs queda en espera hasta que se decida T10. Pendiente del usuario: cómo se autentica la persona.

**L23** Decisión del usuario sobre la autenticación: «OIDC con un solo email (Recomendado)». S5 queda actualizada. T10 se delega por el límite de contexto de la sesión padre. Risk: item 2 (auth) y 1 (migración que elimina la columna `users.role`; todavía no hay datos desplegados).

**L24** T10 (writer delegado), commit `6f5e159`:
- con OIDC, `OWNER_EMAIL` es obligatorio y solo entra ese email;
- la comprobación se repite en cada petición;
- desaparecen los roles; la migración 0008 elimina `users.role`;
- README y `.env.example` actualizados.

RED en 20 tests → GREEN: 84 + 7 tests, `tsc` exit 0.

Verificador independiente: S5 y S1 pass, sin blockers. La migración 0008 se aplica limpia sobre una base con usuarios de 0000–0007.

De sus avisos se arregló el primero en `3c77d64`: sin OIDC ni `SINGLE_USER`, una sesión guardada de antes daba acceso, en contra del README («the API admits nobody»). Ahora `chooseIdentify` no admite a nadie. Tests 87/87.

Avisos que quedan:
- `ADMIN_EMAILS` y `OIDC_ALLOWED_DOMAINS` se ignoran sin avisar;
- si la cuenta del owner ya estaba enlazada a otro `sub`, el owner recibe 403 (es la regla anti-takeover; se recupera editando la base);
- `SINGLE_USER` tiene prioridad sobre OIDC (solo en desarrollo).

**L25** Revisión RDD de T10 (lentes risk y reliability): aprobada, con acknowledgement hecho. Un solo aviso, que ya constaba en L24: `ADMIN_EMAILS` y `OIDC_ALLOWED_DOMAINS` se ignoran sin avisar. T10 queda cerrada. Siguiente: abrir la cadena de PRs (falta que el usuario elija la estrategia).

**L26** Estrategia elegida por el usuario: «apilados contra main». Cadena de 13 PRs, cada uno en una rama `stack/NN-*` que apunta a un commit existente, sin reescribir historia: horelvis/personalBot #1–#13. #1 tiene base `main`; cada uno de los siguientes tiene como base la rama del anterior y pasará a `main` cuando se integre su padre. Se pidió `size:exception` para #5 (memoria, 661 líneas), #8 (OIDC, 518) y #11 (web, 1026), porque cada uno es un único commit con su código y sus tests. El merge queda en manos del usuario.

**L27** 2026-10-29: el usuario integró en `main` la cadena completa. Los PRs #1–#13 se mergearon entre las 08:15 y las 08:16 UTC, y el #14 (`7215372`, «docs(odd): record stacked PR chain», que añadió L26) a las 08:24 UTC. El último commit es `a693d3c` y la feature está cerrada. Quedan abiertos los avisos de L24.

**L28** 2026-10-29, aviso 2 de L24 (el owner recibe 403 si su cuenta ya estaba enlazada a otro `sub`). Opciones planteadas: re-enlace automático solo con email verificado, o re-enlace explícito con una variable. Decisión del usuario, literal:
> la 1, re-enlace automático

Con una persona por instancia, la fuente de confianza es `OWNER_EMAIL`: si el proveedor configurado marca `email_verified: true` para ese email, la cuenta del owner se re-enlaza a la nueva identidad (emisor + `sub`) y conserva sus hilos y memorias. Sin verificación (`OIDC_TRUST_UNVERIFIED_EMAIL`) sigue el 403, con un aviso en el log del servidor. Risk: item 2 (auth).

**L29** Aviso 2 hecho en `42b84df`. Verificador independiente: sin blockers. Revisión RDD (lentes risk y reliability): aprobada, con acknowledgement hecho. Petición del usuario sobre los avisos de la revisión, literal:
> corregir el fallo

Arreglado aquí: los avisos de rechazo ya no escriben el email en el log (R1-001, dato personal). Dos tests nuevos fijan comportamiento que ya existía: `email_verified: false` nunca re-enlaza, ni siquiera con `OIDC_TRUST_UNVERIFIED_EMAIL`; y el re-enlace solo toca la cuenta de `OWNER_EMAIL`, nunca la de un owner anterior. R1-002 no aplica: `accounts.ts:20` rechaza cualquier email que no sea el del owner antes de llegar al re-enlace. RED: las comprobaciones del log fallan con el código anterior. Checks: server 94/94, `tsc` exit 0.
