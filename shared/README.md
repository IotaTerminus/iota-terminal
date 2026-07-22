# shared/

Code and assets shared between `apps/react-ui` and `apps/angular-ui` (and, where noted, the backends). Each subdirectory is documented below.

## shared/styles

Tailwind theme shared by both frontends:

- `tailwind.preset.js` — single source of truth for the terminal visual theme (colors, fonts, keyframes). Consumed by `apps/react-ui/tailwind.config.js` and `apps/angular-ui/tailwind.config.js` via the `presets` option. Extend this preset instead of duplicating tokens in either app's own config.
- `styles.css` — framework-agnostic global stylesheet (`@tailwind base/components/utilities` plus a couple of `@layer` rules). Imported by each app's own global stylesheet (`apps/react-ui/src/index.css`, `apps/angular-ui/src/styles.css`) via `postcss-import`, so both apps end up with byte-identical global CSS.

## shared/types (`@iota/types`)

Framework-agnostic TypeScript package: enums (`src/enums.ts`), domain models (`src/models/`), and API payload interfaces (`src/payloads/`), all re-exported from `src/index.ts`. Consumed with `import type { SystemStatus } from '@iota/types'` in both frontends.

Note: `BackendType` enum uses `TypeScript = 'typescript'`, which is inconsistent with the `'ts'` literal used everywhere else (`active_backend` storage values, `/api/ts` route prefix, `BackendId` type) — don't conflate the two when adding backend-related types.

## shared/content (`@iota/content`)

Framework-agnostic page/nav content (`src/nav.ts`, `src/about-me.ts`, `src/about-site.ts`, `src/projects.ts`, `src/resume.ts`), re-exported from `src/index.ts`. `NAV_ITEMS` (in `nav.ts`) is the single source of truth for site navigation — both the React and Angular routers/nav bars are driven by it, so route paths and labels never drift between the two apps. Each page component in both frontends imports the matching constant (e.g. `ABOUT_ME`, `PROJECTS`, `RESUME`) directly from `@iota/content` rather than duplicating copy.

## shared/ui (`@iota/ui`)

Framework-agnostic UI components implemented as native [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements), so the same component works unmodified in both React and Angular:

- `IotaCursor` (`src/cursor.ts`, `<iota-cursor>`, registered via `registerIotaCursor()`) — blinking terminal cursor.
- `IotaWindow` (`src/window.ts`, `<iota-window title="...">`, registered via `registerIotaWindow()`) — bordered terminal-window chrome wrapping page content.

Both frontends call `registerIotaCursor()`/`registerIotaWindow()` once at startup (`App.tsx` / `app.component.ts`) then reference the custom elements directly in markup.

**Convention: no shadow DOM.** These elements intentionally don't use `attachShadow`, so their content stays in the light DOM and the global Tailwind stylesheet (`shared/styles/styles.css`) still applies to it (a shadow root would encapsulate styles and stop utility classes from reaching projected content).

**Gotcha: don't assume light-DOM children or attributes exist yet inside `connectedCallback`.** React builds an element's whole subtree off-document (children and bound attributes included) before attaching it to the page, so by the time `connectedCallback` fires, everything is already in place. Angular's renderer instead attaches the host element to the document _first_, then appends projected children and applies attribute bindings (e.g. `[attr.title]`) afterward — so `connectedCallback` can fire before either exists. A synchronous `this.innerHTML`/`getAttribute(...)` read-then-rewrite inside `connectedCallback` (an anti-pattern an earlier version of `IotaWindow` used) works by accident under React but silently drops content/attributes under Angular — this is exactly what happened to `about-me.component.ts`, the only page passing `title` via a dynamic `[attr.title]="...":` binding instead of a static `title="..."`, causing its heading to go missing. `IotaWindow` handles this by: (1) moving whatever children are already present at connect time into its content wrapper, then using a `MutationObserver` to catch any appended afterward; (2) declaring `title` in `observedAttributes` and re-rendering it via `attributeChangedCallback` whenever it changes, not just once on connect. Keep an equivalent pattern for any future Custom Element in this package that projects light-DOM content or reads attributes.

## shared/db

Single SQLite database (`iota.sqlite`) and its `migrations/schema.sql` baseline, created via `make db-init` (root `Makefile`) and removed via `make db-clean`. No backend reads/writes it yet.
