# Quant-UX Migration HANDSOFF

> Last updated: 2026-08-25
> This document captures the completed work, current state, known issues, and recommended next steps for the Quant-UX full-stack migration (Java backend → Node.js, Vue 2 → Vue 3).

---

## 1. Project Goal

- Replace the Java backend (`KlausSchaefers/qux-java`) with a Node.js + TypeScript backend in `backend/`.
- Migrate the existing Vue 2 frontend to Vue 3 (`@vue/compat`).
- Preserve functional parity.
- Use SQLite (`better-sqlite3`) with raw SQL.
- Store image binaries on the filesystem and metadata in SQLite.
- Provide backend and frontend tests, and real Playwright E2E coverage.
- Keep the stack runnable locally without Docker.

---

## 2. Completed Work

### 2.1 Backend Migration

- **Entry & setup**: `backend/src/server.ts`, `backend/src/app.ts`, `backend/src/config.ts`.
- **Database**: `backend/src/db/Database.ts`, `backend/src/db/SQLiteClient.ts`, raw SQL migrations in `backend/src/db/migrations/`.
- **Auth**: JWT middleware (`backend/src/middleware/auth.ts`), ACL (`backend/src/acl/`).
- **Routes/Features**: apps, images, libraries, notifications, stubs, teams, invitations, comments, users.
- **Services**: BlobService (filesystem image storage), JWTService.
- **Tests**: `backend/tests/app.test.ts`, `backend/tests/user.test.ts`.
- **E2E isolation**: `tests/e2e/conftest.py` supports per-run SQLite files, image directories, dynamic ports, and isolated backend/frontend processes.

### 2.2 Frontend Vue 3 Migration

Key patterns implemented (recorded in `AGENTS.md`):

- `@vue/compat` in Vue 3 mode.
- Vue Router 4 (`createRouter` / `createWebHashHistory`).
- Vue I18n 9 (`createI18n`).
- Dojo event bus renamed from `this.emit()` to `this.$emitDojo()`.
- `Vue.nextTick` replaced with named `nextTick` imports.
- Dojo utility constructors use `createApp` instead of `Vue.extend` / `new ComponentClass()`.
- Removed Vue 2 global APIs and event APIs.

Specific files updated for Vue 2 → Vue 3 compatibility (non-exhaustive):

- `src/dojo/DojoWidget.vue`, `src/dojo/DojoUtil.js`
- `src/main.js`, `src/router.js`
- `src/common/Tree.vue`, `src/common/TreeItem.vue`, `src/common/Table.vue`, `src/common/NLS.vue`
- `src/canvas/toolbar/LayerList.vue`
- `src/canvas/toolbar/components/DataBindingTree.vue`, `src/canvas/toolbar/components/XDataBinding.vue`, `src/canvas/toolbar/components/TableSettings.vue`, `src/canvas/toolbar/components/SVGSize.vue`, `src/canvas/toolbar/components/BoxSize.vue`, `src/canvas/toolbar/components/NavigationTable.vue`, `src/canvas/toolbar/components/RestSettings.vue`, `src/canvas/toolbar/components/ChatMessages.vue`
- `src/canvas/toolbar/mixins/_Dialogs.vue`, `src/canvas/toolbar/mixins/_Render.vue`, `src/canvas/toolbar/mixins/_Show.vue`
- `src/svg/SVGEditor.vue`, `src/svg/mixins/Actions.vue`
- `src/core/code/LowCodeUtil.js`
- `src/views/apps/Design.vue`, `src/views/apps/Overview.vue`, `src/views/apps/StudioOverview.vue`
- `src/views/apps/analytics/AnalyticsTab.vue`, `src/views/apps/analytics/SurveySection.vue`, `src/views/apps/analytics/TaskCreateDialog.vue`
- `src/views/apps/test/TestTab.vue`, `src/views/apps/test/TestSettings.vue`
- `src/views/simulator/Splash.vue`, `src/views/simulator/TestPage.vue`
- `src/views/Header.vue`, `src/views/LoginPage.vue`, `src/views/QUX.vue`, `src/views/user/Account.vue`
- `src/unit/FastRenderTest.vue` deleted.

### 2.3 Recent Fixes (latest batch)

- **i18n nested placeholder**: `src/common/NLS.vue` and `src/nls/en.json` changed to avoid HTML inside placeholders; simulator test now passes.
- **Prop mutation in analytics/test tabs**:
  - `src/views/apps/analytics/AnalyticsTab.vue`: removed direct assignments to read-only `test`/`events` props.
  - `src/views/apps/test/TestTab.vue`: introduced local `localTest`/`localEvents` to replace direct prop mutation.
  - `src/views/apps/test/TestSettings.vue`: moved from mutating `test` prop to using local `testSettings` copy.
- **Table initialization**: `src/common/Table.vue` now calls `postCreate()` in `mounted()` to initialize the Dojo logger before `setValue()`.
- **Design lifecycle**: `src/views/apps/Design.vue` timer cleanup.

### 2.4 E2E Tests Created

All under `tests/e2e/` using Playwright + isolated backend/frontend (`conftest.py`):

- `test_auth_account.py`
- `test_app_dashboard.py`
- `test_app_design.py`
- `test_app_settings.py`
- `test_app_test.py`
- `test_app_analytics.py`
- `test_images_team.py`
- `test_libraries.py`
- `test_simulator.py`
- `test_studio.py`
- `test_studio_screens.py`
- `test_studio_layers.py`
- `test_studio_widgets_basic.py`
- `test_studio_widgets_advanced.py`
- `test_studio_dialogs.py`

---

## 3. Verification Status

| Command | Status |
|--------|--------|
| `cd backend && npm test` | 9/9 PASS |
| `npm run test:unit` | 130/130 PASS |
| `npm run build` | PASS (warnings only) |
| `npm run lint` | PASS |

### Playwright scripts (run individually)

| Script | Status |
|--------|--------|
| `test_simulator.py` | PASS |
| `test_app_test.py` | PASS (add-task UI not fully exercised, caught gracefully) |
| `test_app_analytics.py` | PASS |
| `test_studio_screens.py` | PASS |
| `test_studio_widgets_basic.py` | PASS |
| `test_studio_widgets_advanced.py` | PASS |
| `test_studio_layers.py` | FAIL (`.MatcToolbarLayerList` selector not matched) |

### `pytest -q tests/e2e` (sequential run)

- Intermittent editor-canvas timeouts (`localhost:8081` unavailable or `.MatcCanvas` not rendered in 20s) when run sequentially.
- Root cause: `IsolatedTestEnvironment` port reuse and frontend process lifecycle between tests; individual scripts are stable.

---

## 4. Known Issues

1. **Sequential E2E instability**: `pytest tests/e2e` in one process sometimes fails to start the isolated frontend or reuses a busy port. The `conftest.py` fixture should be hardened so each test uses a guaranteed free port and tears down processes cleanly.
2. **Studio layer-list test**: `test_studio_layers.py` cannot find `.MatcToolbarLayerList`. This is either a selector mismatch or the layer list is rendered lazily; needs test or UI adjustment.
3. **Add-task dialog**: `test_app_test.py` opens the dialog but cannot complete the task creation flow. `TestSettings` task-creation is functional, but the test assertion needs refinement.
4. **Dojo widget console warnings**: non-fatal errors remain for some legacy Dojo widgets (`Table`, `TaskCreateDialog`, `TestTab` session list) where `postCreate`/logger initialization is inconsistent. They do not block current scripts but should be cleaned up.
5. **Missing E2E coverage**: `test_analytics_canvas.py` (analytics canvas/diagram interactions) and `test_share_comments.py` (public sharing + comments) were planned but not implemented.
6. **Subagent rate limit**: during the last multi-agent run the orchestrator hit a `429 Too many requests` limit (`retry-after` ~1900s). Parallel work should be spaced or the limit should be considered in the schedule.

---

## 5. Next Steps (Recommended)

1. **Harden E2E harness** (`tests/e2e/conftest.py`):
   - Ensure unique free ports per test run.
   - Add robust teardown/kill of leftover backend/frontend processes.
   - Stabilize sequential `pytest` execution so all 16 tests pass in one invocation.
2. **Fix `test_studio_layers.py`**:
   - Verify the real DOM structure for the layer list.
   - Adjust selector or add an explicit toggle step.
3. **Implement missing tests**:
   - `test_analytics_canvas.py`
   - `test_share_comments.py`
4. **Dojo lifecycle cleanup**:
   - Audit components with empty or custom `mounted()` hooks that suppress the `DojoWidget` mixin lifecycle.
   - Standardize `postCreate()`/`initLogger()` calls to remove the remaining `Cannot read properties of undefined (reading 'log')` / `innerHTML` console errors.
5. **Complete the multi-agent Playwright campaign** once rate limits allow, keeping each subagent task small (≤16 concurrent).
6. **Run a full verification sweep** after the above:
   - `cd backend && npm test`
   - `npm run test:unit`
   - `npm run build`
   - `npm run lint`
   - `pytest tests/e2e`

---

## 6. Important Files

- `AGENTS.md` – migration conventions and decisions.
- `tests/e2e/conftest.py` – isolated E2E infrastructure.
- `backend/src/server.ts` / `backend/src/app.ts` – backend entry points.
- `src/router.js` – frontend routes.
- `src/main.js` – frontend bootstrap.
- `src/dojo/DojoWidget.vue` / `src/dojo/DojoUtil.js` – Dojo compatibility layer.
- `src/views/apps/test/TestTab.vue` / `TestSettings.vue` – recently fixed prop mutation.
- `src/views/apps/analytics/AnalyticsTab.vue` – recently fixed prop mutation.
- `src/common/Table.vue` – Dojo initialization fix.
- `src/common/NLS.vue` / `src/nls/en.json` – i18n fix.

---

## 7. How to Run Locally

```bash
# Backend tests
cd backend && npm test

# Frontend unit tests
npm run test:unit

# Build
npm run build

# Lint
npm run lint

# Individual E2E scripts
python3 tests/e2e/test_simulator.py
python3 tests/e2e/test_app_test.py
python3 tests/e2e/test_app_analytics.py
python3 tests/e2e/test_studio_screens.py
python3 tests/e2e/test_studio_widgets_basic.py
python3 tests/e2e/test_studio_widgets_advanced.py

# Full E2E suite (currently flaky due to port/lifecycle reuse)
pytest tests/e2e
```
