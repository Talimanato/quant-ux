# Quant-UX Agent Notes

## Project Structure

This is a Vue 3 (compat build) frontend (`/src`) and a new Node.js/SQLite backend (`/backend`) that replaces the Java `qux-java` backend.

## Backend (`/backend`)

- Node.js 20+, TypeScript, Express, better-sqlite3
- Database: SQLite (file `backend/data/qux.db` or `:memory:` for tests)
- Images stored on filesystem, metadata in SQLite
- Run dev: `cd backend && npm run dev` (port 8080)
- Run tests: `cd backend && npm test`
- JWT secret via `QUX_JWT_PASSWORD` env or random

## Frontend (`/src`)

- Vue 3.5 + Vue Router 4 + Vue I18n 9 (with `@vue/compat` migration build)
- Dev server: `npm run serve` (port 8081)
- Proxy config in `vue.config.js` forwards `/rest` and `/ai` to `http://localhost:8080`
- Production server: `server/start.js` serves `dist/` and proxies to `QUX_PROXY_URL` (default `http://localhost:8080`)

## Verification commands

- `cd backend && npm test`
- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `python3 tests/e2e/test_studio.py`

## Vue 3 migration notes

- Uses `@vue/compat` with `MODE: 3` in `src/main.js`.
- Vue Router 4 uses `createRouter` + `createWebHashHistory` in `src/router.js`.
- vue-i18n 9 uses `createI18n` in `src/main.js`.
- The dojo event bus method `this.emit()` was renamed to `this.$emitDojo()` in `src/dojo/DojoWidget.vue` and all callers because Vue 3 reserves `this.emit`.
- `Vue.nextTick` replaced by named `nextTick` import in updated files.
- `<template v-for>` keys must be on the `<template>` tag in Vue 3; updated in `src/help/Help.vue`, `src/canvas/toolbar/chat/Chat.vue`, etc.
- HTML tables need `<tbody>` around `<tr>` children; updated in `src/views/apps/analytics/ScatterPlotDetails.vue` and `src/canvas/toolbar/components/DataBindingTree.vue`.
- Jest config maps the same aliases as `vue.config.js` and uses `@vue/vue3-jest`.
- `DojoUtil.$new` (and `RenderFactory.$new` / `SymbolService.$new`) were rewritten to use `createApp` instead of the Vue 2 `Vue.extend` / `new ComponentClass()` pattern.
- `CheckBox.vue` no longer mutates its `label` prop; an `internalLabel` data field is used instead.
- `ToolbarSelector.vue` no longer mutates its `options` prop; an `allOptions` data field and `visibleOptions` computed property are used instead.
- `ViewConfig.vue` no longer mutates its `value` prop; a `localValue` data copy is used for state updates and emitted to the parent.
- `StudioDetails.vue` watchers no longer reassign prop values (`this.app = v`, `this.test = v`, etc.).
- `ViewConfig.vue` watcher no longer reassigns the `value` prop.
- `src/canvas/toolbar/mixins/_Show.vue` defensively checks for `alignmentBtn`, `screenDownLoad` and other toolbar child refs before invoking methods.

## Important implementation details

- `backend/src/routes/stubs.ts` now contains the full CommandStack, Events, Mouse, Team, Invitations, Libraries, Comments, Notifications and TestSettings endpoints.
- `backend/src/routes/apps.ts` handles incremental `applyChanges` (`/rest/apps/:appID/update`) as well as full app saves.
- E2E `tests/e2e/test_studio.py` covers registration, app creation, opening the Studio editor, adding a screen, verifying the `applyChanges` call returns 200, screen persistence, undo/redo (screen count returns to 1 then 2), adding a widget with the `r` shortcut, copying and pasting it with `Ctrl+C` / `Ctrl+V`, and deleting both with the `Delete` key. Widget count is verified through the backend after each operation.

## Current verification status

- `cd backend && npm test` -> 15 passed (app updates, command stack, team, invitation, image upload/list/delete, password reset, AI proxy validation, log sink)
- `npm run build` -> success
- `npm run lint` -> no errors
- `npm run test:unit` -> 130 passed
- `python3 tests/e2e/test_studio.py` -> PASS (screen add/undo/redo, widget add/delete/copy/paste, no unexpected REST errors)
- `pytest tests/e2e` -> all 18 scripts pass sequentially (start `npm run serve` first, `test_studio.py` needs the dev server on 8081; everything else uses the isolated `dist` server). `test_studio_layers.py` now passes (LayerList renders), and `test_analytics_canvas.py` / `test_share_comments.py` were added.

## Vue 3 cleanup completed in this pass

- Replaced all real `this.$set(...)` calls with direct assignment / object cloning in `Tree.vue`, `TreeItem.vue`, `LayerList.vue`, `DataBindingTree.vue`, `XDataBinding.vue`, `TableSettings.vue`, `SVGSize.vue`, `BoxSize.vue`, `TestPage.vue`, `SurveySection.vue`, `_DesignToken.vue`, `RestSettings.vue`, `Actions.vue`, and `SVGEditor.vue`.
- Replaced all real `this.$delete(...)` calls with `splice` / `delete` in `TableSettings.vue`, `NavigationTable.vue`, and `ChatMessages.vue`.
- Replaced Vue 3 removed `$on` / `$root.$on` / `$root.$emit` with the existing `dojo/topic` event bus or Dojo per-instance events (`dialog.own(aiDialog.on(...))`) across `App.vue`, `QUX.vue`, `_Dialogs.vue`, `DojoWidget.vue`, `Help.vue`, `LoginPage.vue`, `Header.vue`, `Account.vue`, and other event publishers.
- Updated `src/core/code/LowCodeUtil.js` generated templates to Vue 3 syntax (`createApp`, `createRouter`, `createWebHashHistory`) and removed `import Vue from 'vue'` / `Vue.use(...)` from generated code.
- Deleted the unused `src/unit/FastRenderTest.vue` file which contained 36 `Vue.component` registrations.
- Updated `src/common/Code.vue` LowCode hint to refer to `main.js` instead of `Home.vue`.
- Cleaned up remaining `beforeDestroy` log/comment strings inside `beforeUnmount` methods in `Overview.vue`, `StudioOverview.vue`, and `Canvas.vue`.

## Notes on remaining `beforeDestroy` methods

Several Dojo-style widgets in `src/core/widgets/` have custom `beforeDestroy` methods. These are **not** Vue lifecycle hooks; they are manually called by `src/core/RenderFactory.js` and work correctly under Vue 3 compat mode. No further changes are required.

## Dojo `$new()` lifecycle convention (IMPORTANT)

Vue 3 flushes `mounted()` hooks in a **microtask** after `app.mount()`, but the Dojo-style code calls `placeAt()` / `render()` and reads attach points (`this.cntr`, `this.domNode`, ...) **synchronously right after `$new()`**. Vue 2 ran `mounted` synchronously, so without compensation every `$new(...)` consumer broke ("Cannot read properties of undefined (reading 'appendChild')"), which silently aborted the toolbar build and the LayerList init (`Canvas.initLayer`).

- `DojoUtil.$new()` (and `RenderFactory.$new` / `SymbolService.$new`) therefore call the exported `initDojoWidget(instance)` helper, which runs `initDojoListeners/initLogger/initDomNodes/registry.add/startup/postCreate` synchronously. `DojoWidget.mounted()` skips the repeat via the `dojoInited` flag. Do not remove this.
- `DojoUtil.$new()` also drops **object/array valued params that the component does not declare as props** (`filterRootProps`). Vue 2 ignored undeclared `propsData`; Vue 3 would render them as fall-through DOM attributes and throw `Cannot convert object to primitive value` (e.g. `BoxBorder2` `{colorWidgets: [...]}`). If a `$new` param must survive, declare it as a prop (see `BoxBorder2.colorWidgets`).

## Never navigate from async lifecycle code without re-checking

`Studio.vue` used to `router.push('/apps/<id>.html')` (default app auto-select) as soon as its async `load()` resolved. When the user navigated away in the meantime (E2E: dashboard → editor), vue-router resolved the queued push LAST and hijacked the editor navigation (`#/apps/<id>/create.html` ended up at `#/apps/<id>.html`). This was the root cause of the "sequential E2E editor timeouts" flakiness. Fixes (do not remove): `Studio.setDefaultApp()` defers the push one tick and re-checks the synchronous `location.hash`, and `Studio.mounted()` bails when the component unmounted during `await load()`.

## Never mutate props in watchers

A watcher like `value (v) { this.value = v }` was a silent no-op in Vue 2 but **throws** `'set' on proxy: trap returned falsish` in Vue 3 — and an uncaught throw inside a lifecycle/watcher flush can abort other components' mounted hooks (this is how the LayerList disappeared). The same applies to **setter methods** assigning props (`setPublic(p) { this.isPublic = p }`): this broke the dashboard (Preview/ScreenList) and the Team dialog (Input.setHints). All offenders were removed or converted to internal data/computed mirrors (`Preview.isPublic`, `Input.hintList`, `VideoPlayer.currentTestSettings`, `BulletGraph`, `CollabUser`, `ScatterPlot`, `SVGEditor`, `QRCode`, `Export*` dialogs). When porting, never assign to a prop — pass it via `$new` params (declared props) or mirror it in data.

## Updates dialog auto-open persistence

`StudioNotification.showAutoDialog()` auto-opens the updates dialog for users with no seen notifications. The seen ids are persisted in the `user.notifications` JSON column (migration `003_user_notifications.sql`; the migration runner tolerates duplicate-column errors) and written on close via `NotificationService.setSeenNotifications()` and the `ZoomDialog` `@close` event. Without this the dialog (and its full-screen backdrop) re-appeared on **every** login and intercepted all sidebar clicks.

## E2E harness

`tests/e2e/conftest.py` runs each test against an isolated backend + production frontend server (`server/start.js` serving `dist/`):

- Rebuild `dist` before E2E runs (`npm run build`) — the harness does NOT use the dev server.
- Ports come from `get_free_port(9000/9100)`; leftover processes are killed via `atexit`/signal handlers and `_kill_port_owner` (only inside the 9000-9999 range).
- Readiness checks re-verify the child process is alive afterwards, to detect stale servers that answer on the same port.

## Backend feature notes

- **Default account**: the server seeds an `admin` / `admin` user on startup when that email does not exist (`backend/src/seed.ts`). Disable with `QUX_SEED_ADMIN=false`, change credentials with `QUX_ADMIN_EMAIL` / `QUX_ADMIN_PASSWORD`.
- **Password reset**: `POST /rest/user/password/request` and `/rest/user/password/set` (migration `002_password_reset.sql`). There is **no SMTP support** — the reset link is printed to the server log (`[password-reset] ... #/?id=<key>`); wire `QUX_MAIL_*` up if email delivery is needed.
- **AI proxy**: `POST /ai/openai.json` (`backend/src/routes/ai.ts`) forwards `openAIPayload` to the OpenAI-style upstream. Configure via `QUX_AI_TOKEN` (server key, takes precedence) and `QUX_AI_ALLOWED_URLS` (comma separated base URLs; default `https://api.openai.com`). Returns 503 `ai.token.missing` when no key is configured.
- **Client error log**: `POST /rest/log/error` acknowledges `Logger` reports (no-op sink).
- **Collab WebSocket**: the URL comes from `config.json` (`websocket` key, default `wss://ws.quant-ux.com` — the author's public service). Self-hosted deployments point it at their own `qux-websocket` instance; `public/config.json` is gitignored and copied to `dist/` at build time.
- `GET /rest/events/:appID.json?batch=true` accepts the flag for compatibility; no batching is needed at SQLite scale.

## Axure RP import

- `src/services/AxureParser.js` holds the pure parsing functions (unit tested in `tests/unit/AxureService.spec.js`): `extractPageData` (JSON after `$axure.loadCurrentPage(` in `pages/*/data.js`), `flattenObjects` (expands dynamic panel states; treats state children as panel-relative when their bounding box fits inside the panel), `mapWidget` (Axure type → QUX widget, e.g. `Axure:TextBox`→TextBox, `Heading1-4`→Label 26/22/18/16 bold, `Image`→Image + `imageUrl`), `buildModel` (screens laid out in a row, first screen `props.start`).
- `src/services/AxureService.js` orchestrates: loads the zip with a dynamic `jszip` import, uploads referenced `files/...` images to `/rest/images/<appID>` and sets `style.backgroundImage = {name, url, w, h}`.
- `ImportDialog.vue` has an `axure` tab next to Zip/Figma; on save it centers the imported screens on the canvas before `controller.addScreensAndWidgets(model)`.
- NLS keys: `dialog.import.tab-axure`, `axure-drop-msg`, `axure-progress`, `axure-note`, `error-axure-parse`.
- **Known limitations (disclosed in the UI via `axure-note`)**: this is a static-layout import — interactions/page links, master contents and non-base adaptive views are dropped; unknown widget types (Repeater, Table, Menu, …) fall back to a Box. Target is Axure RP 9/10 exports (`pages/*/data.js`); RP 8 and older exports are not supported and fail with `axure.no.pages`. Verification so far is unit tests plus a synthetic export zip — **a real RP 9/10 export has not been tested**.

## i18n: Chinese is the default language

- `src/services/Locale.js` `resolveLocale()` maps any stored/browser value (`zh*`, `de*`, `pt*`, `en*`) to the four supported locales; **unknown/missing → `cn`**.
- `src/main.js` boots vue-i18n with `resolveLocale(localStorage.quxLanguage) ?? 'cn'`; `UserService.getLanguage()`, `KeyCloakService.getLanguage()` and `LanguagePicker` use the same helper. Never read `navigator.language` directly (always wrap it in `resolveLocale`).
- **E2E must seed English**: every `tests/e2e/test_*.py` (all 18) sets `localStorage.setItem('quxLanguage', 'en')`, because the text assertions expect English strings. New E2E scripts need the same line.
- vue-i18n 9 message values treat `@` as linked-message syntax and `|` as plural separator — an unescaped `you@studio.com` crashes the whole page render (`Invalid linked format`), and a bare `|` silently truncates the text. Escape as `you{'@'}studio.com` / `Interactions {'|'} Duration` in all four `src/nls/*.json` files.
- The welcome-notification strings (dashboard auto dialog) live in `NotificationService.initRules()` with an `isCN()` variant (Chinese vs English only — de/pt users get English) — they are not NLS keys.
- Language coverage is uneven by design of this pass: cn gained 409 keys (592 total) and en is fully aligned, but **de is missing ~393 keys and pt_br ~329** — those locales fall back to English via `fallbackLocale: 'en'`.

## Prefab / template library

- `tools/prefabs/generate-prefabs.mjs` generates 9 theme JSON files (79 prefabs: nav bars, heroes, cards, forms, dashboards, lists, e-commerce, mobile, chart cards) into `src/themes/composite/qux_*.json` and `src/themes/charts/qux_charts.json`. Run `node tools/prefabs/generate-prefabs.mjs` after editing — do not hand-edit the JSON.
- The generator follows login.json conventions: groups are `{type:'Group'}` with full child widget models, unique widget id prefixes per file (`QXNav*`, `QXHero*`, ...) are enforced by `setPrefix()`, images use MDI icons (`style.icon = 'mdi mdi-*'`).
- Widget style gotchas: ProgressBar fill color key is `foreground`; RingChart is `{background, color, lineWidth}`.
- The files are registered in `SymbolService.getCore()`; CreateButton.vue buckets them by `category` (`Composite` shows as "Templates", `Charts` as its own tab).

## E2E setup detail

`python3 tests/e2e/test_studio.py` does **not** start the frontend dev server automatically. Start it manually first with:

```bash
npm run serve
```

The other `tests/e2e/test_*.py` scripts are self-contained (isolated backend + `dist` frontend) and need no dev server, only a fresh `npm run build`.

Then run the E2E script. The test will start the backend itself on `localhost:8080` and use the dev server at `http://localhost:8081`.
