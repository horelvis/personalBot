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
| T1 | S1, S2, S4 | inline | [x] Base visual: Tailwind 4, tokens de `theme.css`, Inter, primitivas `ui` copiadas con atribución | cb59715 |
| T2 | S1, S3 | inline | [x] Estructura: sidebar de la app con navegación, hilos y usuario; formulario de nuevo hilo | 9bc7fbc |
| T3 | S1, S3 | inline | [x] Chat: mensajes y caja de mensaje con el estilo de openbot | 469eb51 |
| T4 | S1, S3 | inline | [x] Memorias e inicio de sesión | fdd0f9d |
| T5 | S1–S4 | inline + verificador independiente | [x] Verificación: tests, typecheck, grep de `copilotkit`, capturas comparadas con openbot | |

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

**L6** T1 hecha en `64e9db1`. Dependencias nuevas, todas con versión fija: `tailwindcss` y `@tailwindcss/vite` 4.3.3, `@base-ui/react` 1.9.0, `class-variance-authority` 0.7.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0 y `@fontsource-variable/inter` 5.3.0. `npm audit --omit=dev` = 0.
- Copiados de openbot con atribución: `theme.css` entero; `lib/utils.ts`; `ui/button`, `input`, `textarea` y `label`. Las importaciones `@/` pasan a rutas relativas. Licencia en `web/NOTICE`.
- No se copiaron `shadcn/tailwind.css`, `tw-animate-css` ni `ui/select`: las primitivas de T1 no los necesitan. El `<select>` sigue siendo nativo porque los tests lo usan por su etiqueta.
- El modo oscuro sigue al sistema mediante la clase `.dark` en `main.tsx`, como en el tema de openbot.
- El CSS anterior queda en `@layer components`, ya con los tokens de openbot; T2–T4 lo irán borrando pantalla a pantalla.
- Excepción test-first: es un cambio solo visual, sin un RED significativo. Checks: `tsc` exit 0, 7/7 tests de web, `vite build` correcto (el CSS contiene los tokens oklch e Inter), sin `copilotkit` en `web/src` ni en `web/package.json`.
- Risk: item 5 (dependencias nuevas). El verificador independiente se hará al final de la feature (T5).
Siguiente: T2.

**L7** T2: la barra lateral de openbot (clases de `app-sidebar.tsx`, `ui/sidebar.tsx` y `channel.tsx`) queda en `components/AppSidebar.tsx`, sin el `SidebarProvider`, el menú desplegable ni el panel móvil de openbot. En móvil la barra se apila arriba. `Header.tsx` desaparece: la marca va arriba, y Threads/Memories, el avatar con iniciales, el email y Sign out van en el pie. El formulario de nuevo hilo usa `Label`, `Input` y `Button`; el `<select>` sigue siendo nativo, con las clases de `Input`. Las filas de hilos usan las clases del `channel` de openbot.
- Comportamiento nuevo: los hilos siguen visibles en la barra desde Memorias, y al abrir uno se vuelve al chat. Tiene su test, que falla con el código anterior y pasa con el nuevo.
- El CSS antiguo queda limitado a `:where(.chat, .memories-page)` y `.button`, y se han borrado las reglas de cabecera, workspace e hilos.
- Checks: `tsc` exit 0, 8/8 tests de web, `vite build` correcto.
Siguiente: T3.

**L8** T3: el chat sigue la vista de conversación de openbot. Columna `max-w-2xl` centrada. Los mensajes del usuario van en la burbuja `muted` alineada al final; los del bot en la `ghost`, a todo el ancho, con las clases de `ui/bubble.tsx` y `chat-transcript.tsx`. La caja de mensaje es el bloque `rounded-2xl` de `composer.tsx`, con el placeholder «Ask anything» y un botón de enviar redondo con el icono arrow-up de Tabler (SVG inline, sin añadir `@tabler/icons-react`) y `aria-label="Send"`. `ErrorBanner` usa `text-destructive`.
- Fuera: `PromptArea` (menciones y comandos), adjuntos, dictado y animaciones de openbot; personalBot no tiene esas funciones.
- Se borra el CSS antiguo del chat y `.visually-hidden`; ahora se usa `sr-only` de Tailwind.
- Checks: `tsc` exit 0, 8/8 tests de web, `vite build` correcto. Sin comportamiento nuevo: no hay RED.
Siguiente: T4.

**L9** T4: Memorias sigue la página de openbot (`page-shell.tsx`): columna `max-w-2xl` con `pt-12`, título `text-2xl font-medium tracking-tight` y descripción en `muted-foreground`. Las filas usan las clases de `ui/item.tsx` (`outline`, y `muted` en oscuro), el estado vacío las de `ui/empty.tsx` (borde discontinuo) y «Forget» es el `Button` `destructive`. El formulario usa `Label`, `Input` y `Button`. El inicio de sesión sigue `routes/sign.tsx`: columna `max-w-82` centrada y enlace con `buttonVariants` `outline`, `h-10`.
- El CSS antiguo queda eliminado del todo: `styles.css` solo importa Tailwind, Inter y `theme.css`.
- Checks: `tsc` exit 0, 8/8 tests de web, `vite build` correcto. Sin comportamiento nuevo: no hay RED.
Siguiente: T5 (verificación, con verificador independiente por el item 5 de riesgo).

**L10** T5 (en curso): tras el rebase sobre `ae1aaac` (arreglo del gateway, PR #17), los commits de T1–T4 pasan a ser `cb59715`, `9bc7fbc`, `469eb51` y `fdd0f9d`; la tabla ya está corregida. openbot no publica capturas y su app no arranca sin CopilotKit Intelligence, así que la comparación lado a lado de S1 se hace contra su código (clases y tokens), más capturas de personalBot en claro y oscuro hechas con Chrome headless.

Petición del usuario, literal:
> arregla el email cortado y el select desalineado

Arreglado: en el pie de la barra, el nombre y el email van en dos líneas (el email en `text-xs`, sin cortar «local@localhost»); el `<select>` usa `appearance-none` con `pl-2.5` y un chevron de Tabler dibujado, así que su texto queda alineado con el del `Input`. Checks: `tsc` exit 0, 8/8 tests de web, capturas revisadas en claro y oscuro.

**L11** T5, verificador independiente sobre clones aparte de `ae1aaac` (base) y de la rama: **sin blockers**.
- S2 pasa: no hay `@copilotkit` en `web/` ni en el lockfile.
- S3 pasa: `npm ci` correcto; server 91/91 y web 8/8; `typecheck` y `build` correctos. Su inventario de nombres accesibles, ejecutado en base y en HEAD, sale idéntico; el teclado de la caja de mensaje (Enter envía, Shift+Enter no) no cambia.
- S1 parcial: los archivos copiados son idénticos al original salvo la cabecera y las importaciones, y las clases de las pantallas coinciden con las de openbot. No hubo comparación visual lado a lado porque openbot no publica capturas ni arranca sin Intelligence; en su lugar, capturas de personalBot en claro y oscuro (L10).
- S4 parcial → arreglado aquí: cabecera de atribución añadida a `ThreadList.tsx` y `NewThreadForm.tsx`; `web/NOTICE` cubre ahora todo componente cuya cabecera nombra a CopilotKit/openbot.
- Dependencias (item 5 de riesgo): todas con versión fija; `npm audit --omit=dev` = 0.

Avisos que quedan sin tocar:
1. `ui/button.tsx` conserva un comentario de openbot sobre «six call sites» que no aplica a personalBot (copia literal).
2. La lista de hilos ya no se recarga al volver de Memorias, porque sigue montada. Solo el usuario crea hilos, desde ese mismo formulario, así que hoy no se pierde nada.
3. Sin landmark `banner`: la cabecera vive dentro del `aside`. Los nombres accesibles están intactos.

Feature completa. Copias temporales del verificador borradas.
