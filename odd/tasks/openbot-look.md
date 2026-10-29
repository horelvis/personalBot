# personalBot — aspecto de openbot en la web

La web de personalBot adopta el aspecto de la app de openbot (`app/` en
[CopilotKit/openbot](https://github.com/CopilotKit/openbot), MIT, commit de referencia `4766e42` del 2026-10-28)
sin copiar su código de producto y sin `@copilotkit/*`. Solo cambia lo visual; la lógica (`web/src/containers/`, `web/src/api/`) y la API se mantienen.

- Branch: `feat/openbot-look`. Entrega: `ask-on-risk`. Tests: Vitest + Testing Library (`npm test`, `npm run typecheck`).
- Engram mirror: topic `odd/openbot-look/tasks`, proyecto `personalBot` — **pendiente** (Engram no disponible en esta sesión).

## Specs

**S1 — Clonar el aspecto de openbot.**
Cita: «mejor clona lo que hay en openbot,» y «clonar el aspecto, crea el spec».
- Tokens de tema de openbot (`app/src/theme.css`: colores oklch, `--radius`, variables `--sidebar-*`), en modo claro y oscuro.
- Fuente Inter, como openbot (`@fontsource-variable/inter`).
- Primitivas de UI al estilo shadcn de openbot (`app/src/components/ui`) para botones, campos, listas y el resto de controles.
- Disposición de openbot: sidebar de la app (`app/src/components/app-sidebar`) con la navegación y los hilos; chat y caja de mensaje con su estilo.
- Se aplica a las pantallas que ya existen: inicio de sesión, lista de hilos, nuevo hilo, chat y memorias. No se añaden las pantallas de openbot que personalBot no tiene.
- Check: comparación visual lado a lado con openbot en claro y oscuro, con capturas.

**S2 — Sin lock-in en la web.**
Cita: «clonar el aspecto» (frente a portar la app entera, que exigía `@copilotkit/react-core`).
- Ninguna dependencia de `@copilotkit/*` en `web/`. La web sigue hablando solo con la API de personalBot.
- Check: `grep -r copilotkit web/src web/package.json` sin coincidencias.

**S3 — Nada deja de funcionar.**
Cita: «no te lances» (solo cambia el aspecto).
- Hilos, chat con streaming, memorias, inicio y cierre de sesión se comportan igual que hoy.
- Los 7 tests actuales de `web/` siguen pasando sin cambiar lo que comprueban (textos, etiquetas y roles accesibles).
- Check: `npm test` y `npm run typecheck` en verde.

**S4 — Atribución MIT.**
- El código o CSS copiado de openbot conserva su aviso «Copyright (c) 2026 CopilotKit» y la licencia MIT.
- Check: aviso presente en los archivos copiados o en un `NOTICE` de `web/`.

Supuestos confirmados por el usuario en L5:
- Se añaden Tailwind 4 y las piezas de shadcn que use openbot, porque así está construido su aspecto. Son dependencias nuevas (Risk: item 5).
- El selector de skins de openbot (`app/src/skins`) queda fuera.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2, S4 | inline | [ ] Base visual: Tailwind 4, tokens de `theme.css`, Inter, primitivas `ui` copiadas con atribución | |
| T2 | S1, S3 | inline | [ ] Estructura: sidebar de la app con navegación, hilos y usuario; formulario de nuevo hilo | |
| T3 | S1, S3 | inline | [ ] Chat: mensajes y caja de mensaje con el estilo de openbot | |
| T4 | S1, S3 | inline | [ ] Memorias e inicio de sesión | |
| T5 | S1–S4 | inline | [ ] Verificación: tests, typecheck, grep de `copilotkit`, capturas comparadas con openbot | |

## Log

**L1** (petición original, literal, 2026-10-29):
> es lo más feo que he visto en mi vida

**L2** Aclaraciones del usuario, literales:
> claude no tiene bot, sería como Gruk

> no te lances, merge a main y luego crear spec con odd

> mejor clona lo que hay en openbot,

> clonar el aspecto, crea el spec

**L3** Hallazgo: la app de openbot (`app/`) tiene 439 `.tsx`, y 41 importan `@copilotkit/react-core`; además usa `better-auth`, TanStack Router/Query, Tailwind 4 + shadcn, `motion` y `streamdown`. Portarla entera rompería la regla de cero lock-in (S1 de `openbot-alternative.md`) y obligaría a reescribirla contra nuestra API. El usuario eligió «clonar el aspecto». La web actual son 95 líneas de CSS propio sin sistema de diseño.

**L4** PRs #15 y #16 mergeados en `main` (`9d511bc`) antes de abrir esta feature. Siguiente: T1.

**L5** Confirmación del usuario, literal:
> sí, confirmo, empieza con T1

Tailwind 4 + shadcn entran como dependencias; las skins quedan fuera.
