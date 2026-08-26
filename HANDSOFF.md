# Quant-UX 迁移实测 Handoff

> 生成时间：2026-08-26  
> 当前工作目录：`/Users/zk/WebstormProjects/quant-ux`  
> 本文件基于一次全量后端 + 前端浏览器/Playwright 实测，汇总已发现的关键问题、修复方案与下一步工作。

---

## 1. 本次完成的工作

### 1.1 全量实测覆盖

| 模块 | 执行方式 | 结果 |
|---|---|---|
| 认证 & Dashboard | subagent 48d472d5 | PASS |
| Studio 编辑器核心（屏幕、撤销/重做、组件、图层） | subagent 71bafe71 | PASS |
| Studio 对话框 & 高级组件（Settings/Import/Export、分组） | `pytest tests/e2e/test_studio_dialogs.py test_studio_widgets_advanced.py` | PASS (2/2) |
| Libraries / Team / Images | subagent 1d582b4a | 通过，但发现前端缺失/字段不匹配 |
| Analytics / Test / Simulator / Share / Replay | 直接运行 5 个 quick 脚本 | Share/Design/Mobile/Replay 通过；**公开测试页 Start 崩溃** |
| 后端 API 全量探针 | subagent 4ca26848 | 87/87 路由覆盖，主流程正常；发现 1 CRITICAL、1 MEDIUM、11 LOW 异常 |

### 1.2 已通过的自动化基线

- 后端 Jest：`18 passed / 18 total`
- 前端 `npm run test:unit`：`130 passed / 130 total`
- 前端 `npm run lint`：No errors
- 前端 `npm run build`：success
- E2E `pytest tests/e2e --ignore=tests/e2e/test_studio.py`：17/17 passed
- E2E `python3 tests/e2e/test_studio.py`：PASS

### 1.3 测试环境当前状态

- 后端 dev server：`http://localhost:8080`（仍在运行）
- 前端 dev server：`http://localhost:8081`（仍在运行）
- Browser preview 仍可使用
- 测试脚本与截图保留在 `/tmp/`：
  - `/tmp/qux-qa-*.py` 与 `/tmp/qux-qa-*.png`（subagent 产出）
  - `/tmp/test_design_quick.py`、`test_share_quick.py`、`test_replay_quick.py`、`test_mobile_quick.py`、`test_pub_quick.py`
  - `/tmp/qux-backend-report.json`（后端探针完整报告）

> 注意：实测过程中 2 个 subagent（Studio 对话框/高级功能、Analytics/Test/Simulator/Share）因触发消息速率限制中断；剩余 quick 脚本由主会话直接接手运行完成。

---

## 2. 已定位的关键 Bug（按优先级）

### P0：公开测试页（`/test.html`）Start 后白屏

- **表现**：点击 Start 后 `MatcScreen count: 0`，页面未渲染原型。控制台出现：
  ```
  [Vue warn]: Attempting to mutate prop "mode". Props are readonly.
  PAGE ERROR: 'set' on proxy: trap returned falsish for property 'mode'
  ```
- **文件**：`src/core/Simulator.vue`、`src/views/simulator/TestPage.vue`
- **根因**：`Simulator.vue` 把 `mode` 声明为 `props`，但 `TestPage.vue` 在 `createSimulator()` 中创建实例后，又直接赋值 `sim.mode = "debug"`。Vue 3 props 只读，赋值触发 proxy 异常。
- **影响**：所有公开测试、模拟器、DesktopTest 入口都可能触发。
- **修复方案**：
  1. 将 `mode` 从 `Simulator.vue` 的 `props` 中移除，改为 `data` 字段，并在 `postCreate` 中从 `this.$attrs.mode` 初始化。
  2. 设置 `inheritAttrs: false`，防止 `mode` 属性被渲染到根 DOM。
  3. 将 `TestPage.vue` 中 `this.$new(Simulator)` 改为 `this.$new(Simulator, { mode: "debug", logData: false })`，并删除后续 `sim.mode = "debug"` 赋值。
  4. 同理清理 `src/unit/ResponsiveTest.vue` 中重复的 `sim.mode = "debug"`。

### P0：后端 `POST /rest/user/:id.json` 对不存在 ID 返回 500

- **表现**：调用不存在的用户 ID 会抛出：
  ```
  Cannot destructure property 'password' of 'user' as it is null.
  ```
- **文件**：`backend/src/routes/users.ts:203-239`
- **根因**：`db.updateCollection` 后调用 `db.findOne('user', { _id: id })`，找不到时返回 `null`，随后 `cleanUser(dbUser)` 直接解构 `password` 触发异常。
- **影响**：任何能构造用户 ID 的请求都会让后端崩溃并泄露栈信息。
- **修复方案**：在 `cleanUser` 调用前判空：
  ```ts
  const dbUser = db.findOne('user', { _id: id });
  if (!dbUser) {
    return res.status(404).json({ error: 'user.not.found' });
  }
  return res.json(cleanUser(dbUser));
  ```

### P0：图片上传 UI 与后端字段不匹配

- **表现**：通过 Studio UI 上传图片时后端返回 `MulterError: Unexpected field`（field: `file`），HTTP 500。
- **文件**：
  - 前端：`src/page/Uploader.vue:82`、`src/canvas/Upload.vue:182`、`src/canvas/toolbar/dialogs/ImportDialog.vue:476`、`src/page/ObjectUploader.vue:55`、`src/views/apps/test/TestTab.vue:220`
  - 后端：`backend/src/routes/images.ts:63`
- **根因**：前端所有上传点使用字段名 `file`，后端 multer 配置 `upload.array('files', 20)` 只接收 `files`。
- **影响**：所有图片上传入口当前均不可用（测试团队用 API 上传才能绕过）。
- **修复方案**：
  - 推荐 A（最小侵入，保留后端校验）：将 `images.ts:63` 改为 `upload.fields([{ name: 'files', maxCount: 20 }, { name: 'file', maxCount: 20 }])`，并在处理函数中合并两个字段的文件数组：
    ```ts
    const uploaded = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const files = uploaded
      ? [...(uploaded.files || []), ...(uploaded.file || [])]
      : [];
    ```
  - 备选 B：统一前端所有 `formData.append('file', ...)` 改为 `formData.append('files', ...)`，但前端文件多、易遗漏，且需重新测试所有上传入口。

### P1：`StudioOverview.checkEventCount` 误报更新失败

- **表现**：每次打开 Overview 都会 `console.error('checkEventCount >> Could not update')` 并 `sendError`。
- **文件**：`src/views/apps/StudioOverview.vue:370`、`backend/src/routes/apps.ts:232-233`
- **根因**：前端检查 `res.status !== "ok"`，后端返回 `{ message: 'app.update.success' }` 缺少 `status`。
- **影响**：大量 false-positive 错误日志；其他调用 `updateAppProps` 的界面（`SettingsTab.vue`、`AppList.vue` 等）也依赖 `res.status`，当前都会误判为失败。
- **修复方案**：在 `backend/src/routes/apps.ts:233` 增加 `status: 'ok'`：
  ```ts
  return res.json({ message: 'app.update.success', status: 'ok' });
  ```

### P1：`RenderFactory` 未校验 `model.props`

- **表现**：插入无 `props` 字段的 widget 时控制台出现 `Cannot read properties of undefined (reading 'label')`。
- **文件**：`src/core/RenderFactory.js:1081`
- **根因**：`_createInlineEdit` 直接访问 `model.props.label`，未处理 `model.props` 未定义。
- **修复方案**：
  ```js
  if (!model.props || !model.props.label) {
  ```

### P1：`GET /rest/libs/:libID/suggestions/team.json` 不校验 `libID`

- **表现**：任意 `libID` 都返回当前用户所在所有库房的队友列表，与传入的 `libID` 无关。
- **文件**：`backend/src/routes/libs.ts:129-143`
- **影响**：信息泄露、越权。
- **修复方案**：验证当前用户对 `libID` 有读取权限，并限定返回的 userIds 属于该库：
  ```ts
  const libId = req.params.libID;
  if (!(await canReadLib(user, libId))) {
    return res.status(404).json({ error: 'lib.suggestions.denied' });
  }
  const myTeams = db.find('library_team', { userID: user.id, libID: libId });
  const relatedTeams = db.find('library_team', { libID });
  ```

### P2：`Account.vue` 引用未注册 `Label` 组件

- **表现**：Vue warn `Failed to resolve component: Label`。
- **文件**：`src/views/user/Account.vue:74`
- **修复方案**：移除 `<Label>Image</Label>` 或将其替换为 `<label class="...">Image</label>`/`<h5>Image</h5>`。

### P2：WebSocket 默认指向公网 `wss://ws.quant-ux.com`

- **表现**：本地测试时持续 `WebSocket connection ... failed: HTTP Authentication failed`。
- **文件**：`public/config.json`（gitignored，运行时被复制到 `dist/`）
- **修复方案**：本地开发提供 `public/config.json` 或让前端在缺失/失败时优雅降级（例如不显示 console 错误、关闭自动重试）。

### P2：i18n 消息含 HTML 触发 `[intlify]` 警告

- **表现**：测试/模拟器欢迎页出现多条 `Detected HTML in message. Recommend not using HTML messages to avoid XSS.`
- **文件**：i18n message 文件
- **修复方案**：用 `{0}` 插值替换 HTML 标签，或在 Vue I18n 配置中明确关闭 HTML 警告。

### P2：多条写接口接受空 payload 仍返回 200

- **表现**：`POST /rest/apps/:appID.json`、 `/rest/apps/props/:appID.json`、 `/rest/libs/:libID.json` 等接收空对象并返回 200。
- **文件**：`backend/src/routes/apps.ts`、`libs.ts`、`stubs.ts` 等
- **影响**：数据完整性、可审计性风险。
- **修复方案**：增加 schema/必填字段校验；空体返回 `400`。

### P2：Library 前端未接入

- **表现**：访问 `/#/libs.html` 空白，无路由/视图。
- **文件**：`src/router.js`、`backend/src/routes/libs.ts`
- **根因**：后端 Library 接口已迁移完成，前端未接入。
- **影响**：Library 功能完全不可用。
- **修复方案**：在 `src/router.js` 添加 Library 路由，或在 Studio 组件面板中对接 `/rest/libs`。

---

## 3. 当前工作中断点

- 已通过 `read` 工具查看所有需要修改的文件（见第 2 节），但**尚未执行任何 `edit`/`write` 修改**。
- 后端和前端 dev server 仍在运行（端口 8080/8081）。
- `/tmp` 中保留了大量实测脚本和截图，可供复用。

---

## 4. 下一步工作清单

建议按以下顺序推进：

1. [ ] **应用 P0 修复**（先保证不崩溃、核心上传可用）：
   - [ ] `backend/src/routes/users.ts`：用户更新 500 修复
   - [ ] `backend/src/routes/images.ts`：图片上传字段 `file`/`files` 兼容
   - [ ] `src/core/Simulator.vue` + `src/views/simulator/TestPage.vue` + `src/unit/ResponsiveTest.vue`：Vue `mode` prop 改为 data
   - [ ] 针对 Test/Simulator 重新运行 `python3 /tmp/test_pub_quick.py`、`test_mobile_quick.py`，以及 `pytest tests/e2e/test_app_test.py test_simulator.py test_share_comments.py`

2. [ ] **应用 P1 修复**：
   - [ ] `backend/src/routes/apps.ts`：`updateAppProps` 返回增加 `status: 'ok'`
   - [ ] `src/core/RenderFactory.js`：`model.props` 空值防护
   - [ ] `backend/src/routes/libs.ts`：Library suggestions 校验 `libID`
   - [ ] 重新运行 `npm run build`、`npm run lint`、`npm run test:unit`、`cd backend && npm test`、`pytest tests/e2e`

3. [ ] **应用 P2 修复**（可选/按产品优先级）：
   - [ ] `src/views/user/Account.vue`：移除/替换未注册 `Label`
   - [ ] WebSocket 本地降级（`public/config.json` 或前端容错）
   - [ ] i18n HTML 清理
   - [ ] 后端写接口空 payload 校验
   - [ ] Library 前端接入

4. [ ] **回归验证**：
   - [ ] `npm run build` 无新增 warning/error
   - [ ] `npm run test:unit` 130/130 通过
   - [ ] `cd backend && npm test` 18/18 通过
   - [ ] `pytest tests/e2e` 全部通过
   - [ ] 手动/Playwright 快速脚本验证公开测试页、图片上传、分享评论、模拟器

5. [ ] **清理**：
   - [ ] 停止 dev server：
     ```bash
     lsof -ti:8080,8081 | xargs kill -9
     ```
   - [ ] 归档或删除 `/tmp/test_*_quick.py`、`/tmp/qux-qa-*.py`、`/tmp/qux-backend-report.json`（如需保留可移动到项目 `tests/qa/`）

---

## 5. 快速复测命令

```bash
# 后端
cd backend && npm test

# 前端
npm run lint
npm run test:unit
npm run build

# E2E
pytest tests/e2e -v

# 手动浏览器脚本（基于现有 /tmp 脚本）
python3 /tmp/test_pub_quick.py
python3 /tmp/test_mobile_quick.py
python3 /tmp/test_share_quick.py
python3 /tmp/test_design_quick.py
python3 /tmp/test_replay_quick.py
```

---

## 6. 相关文件索引

| 作用 | 路径 |
|---|---|
| 项目笔记 | `AGENTS.md` |
| 后端入口 | `backend/src/server.ts` |
| 后端路由挂载 | `backend/src/app.ts` |
| 用户路由 | `backend/src/routes/users.ts` |
| 图片路由 | `backend/src/routes/images.ts` |
| 应用路由 | `backend/src/routes/apps.ts` |
| 库路由 | `backend/src/routes/libs.ts` |
| Studio Overview | `src/views/apps/StudioOverview.vue` |
| 模拟器组件 | `src/core/Simulator.vue` |
| 测试页面 | `src/views/simulator/TestPage.vue` |
| 渲染工厂 | `src/core/RenderFactory.js` |
| 账户页面 | `src/views/user/Account.vue` |
| Dojo 工具 | `src/dojo/DojoUtil.js` |
| 后端探针报告 | `/tmp/qux-backend-report.json` |

---

## 7. 备注

- 本次实测中 subagent 遇到整体消息速率限制，导致 2 个测试子任务未完成。后续修复工作可视情况拆分为更小的 subagent 任务或直接由主会话处理。
- `HANDSOFF.md` 生成时未修改仓库源码；源码修改记录从本文件落盘后开始。

---

## 8. 画布页面重构 Handoff（2026-08-26）

> 本 Handoff 对应一次新的会话：用户要求「画布页面整体优化」+「左侧 sidebar 改为可拖拽新组件面板」+「当前组件树改为浮窗」。

### 8.1 已完成：Phase 1（布局重排 + 浮窗层级树 + 组件面板壳体）

Phase 1 已实施并验证通过，由 subagent `06e1bbdb` 完成：

- **左侧组件面板**：新增 `ComponentPanel.vue` / `ComponentPanelCategory.vue` / `ComponentPanelItem.vue` / `ComponentData.js`，基于 `SymbolService.getCore()` 和 `model.templates` 加载 7 个分类（WireFrame/Advanced/Composite/Survey/Material/IOS/Charts + My Components）。当前为只读展示，DOM 已 `draggable="true"`。
- **Top Bar 开关**：新增 `ComponentPanelToggle.vue` / `LayerTreeToggle.vue`，用 `QIcon` 图标切换面板。
- **浮窗层级树**：新增 `LayerListFloating.vue`，`Layer.vue` 不再把 `LayerList` 挂到 `Toolbar.layerListCntr`，而是挂到新的浮窗容器。浮窗支持拖拽标题栏移动、右下角 resize、关闭，位置/大小持久化到 `localStorage.quxLayerFloating`。
- **布局重构**：`Design.vue` 模板重排为 Top Bar + 左侧 280px 组件面板 + 画布 + 右侧面板 + 浮窗挂载点；`Toolbar.vue` 改为 48px 全宽 Top Bar；`canvas.scss` 使用 CSS 变量 `--component-panel-width` 动态偏移画布。
- **i18n**：新增 `toolbar.componentPanel.title`、`toolbar.floatingLayer.title/toggle`、`tooltip.componentPanel` / `tooltip.layerTree` 等 key，合并到 `en.json` / `cn.json` / `de.json` / `pt_br.json`，未覆盖已有的 `ui.viewConfig` 等未提交内容。
- **新增样式文件**：`src/style/canvas/component_panel.scss`、`src/style/canvas/layer_floating.scss`。

### 8.2 Phase 1 修改/新增文件清单

```
新增：
  src/canvas/toolbar/components/ComponentData.js
  src/canvas/toolbar/components/ComponentPanel.vue
  src/canvas/toolbar/components/ComponentPanelCategory.vue
  src/canvas/toolbar/components/ComponentPanelItem.vue
  src/canvas/toolbar/components/ComponentPanelToggle.vue
  src/canvas/toolbar/components/LayerListFloating.vue
  src/canvas/toolbar/components/LayerTreeToggle.vue
  src/style/canvas/component_panel.scss
  src/style/canvas/layer_floating.scss

修改：
  src/views/apps/Design.vue
  src/canvas/toolbar/Toolbar.vue
  src/canvas/toolbar/LayerList.vue
  src/canvas/Layer.vue
  src/canvas/Canvas.vue
  src/style/variables.scss
  src/style/canvas/all.scss
  src/style/canvas/canvas.scss
  src/style/toolbar/toolbar_layer_list.scss
  src/style/toolbar/toolbar_layout.scss
  src/nls/en.json
  src/nls/cn.json
  src/nls/de.json
  src/nls/pt_br.json
```

### 8.3 Phase 1 验证结果

| 检查 | 命令 | 结果 |
|---|---|---|
| Lint | `npm run lint` | No errors |
| Build | `npm run build` | Success |
| Unit tests | `npm run test:unit` | 54 suites passed, 149 tests passed |

> 注：Phase 1 subagent 报告还进行了一次 Playwright smoke test（`npm run serve` + 截图），编辑器页面加载、组件面板、浮窗层级树、开关按钮可见。

### 8.4 Phase 2 / 3 / 4 完成记录（2026-08-26 第三次会话）

#### Phase 2：组件面板拖拽到画布 ✅

- **新增 `src/canvas/ComponentDrop.vue` mixin**（Canvas mixins 已注册，`postCreate` 中在 `initUpload()` **之前**调用 `initComponentDrop()`，用 `stopImmediatePropagation` 拦截组件拖拽，避免触发上传 DnD 高亮）：
  - 识别 `application/qux-component` MIME（`ComponentPanelItem.onDragStart` 设置该 MIME + `text/plain` fallback）；层级树/表格等 `text` DnD 不受影响。
  - `dragover` 显示 `.MatcComponentDropTarget` 虚线预览（样式在 `canvas.scss`，oklch+HEX fallback），中心对准光标，经 `alignmentStart('widget'|'boundingbox'|'screen') + allignPosition` 吸附网格/其他组件；`dragleave`（relatedTarget 判空防子元素抖动）/`drop`/`dragend` 清理。
  - `drop` 按 `_type` 分发：`Widget→controller.addWidget`、`Group→addGroupByTheme`、`Screen→addScreen`、`ScreenAndWidget→addScreensAndWidgets`、`_isTemplate→factory.createTemplatedModel + addWidget/addGroupByTemplate`。坐标走 zoomed 约定（controller 内部 unzoom），与 `_onAddNDropUp` 路径一致；meta 字段清理同 `Toolbar.onNewThemeObject`。
  - 点击面板项 = 点击创建：`Design.vue` `@select` → `canvas.addComponentAt(item)`，落在选中屏（或第一屏）内居中偏 (16,16)。
- **接线**：`Design.vue` 监听 panel `@dragstart/@dragend/@select`；`_componentDragItem` 通过 `setComponentDragItem` 注入（dataTransfer 在 dragover 期间不可读）。
- **i18n**：新增 `toolbar.componentPanel.searchPlaceholder` / `empty`（4 个 nls 文件），替换误用的 `ui.appList.searchPlaceholder`。

#### 本次发现并修复的 3 个 Phase 1/2 隐蔽 Bug（重要！）

1. **画布坐标偏移 280px（P0，Phase 1 引入）**：组件面板用 `margin-left` 平移的是 `.MatcCanvasFrame`，但 `Render.getCanvasMousePosition()` 以 `.MatcCanvas` 根（`domPos`，仅 initRender 计算一次）为基准——面板打开时所有绘制/点击向右偏移一个面板宽度（E2E 第二次删除 widget 失败的根因）。**修复**：margin 移到 `#CanvasNode.MatcComponentPanelOpen .MatcCanvas` 根上 + `Render.updateDomPos()` + `Design.onToggleComponentPanel` 在 nextTick 和 300ms 后重算。
2. **Vue 3 事件 fallthrough 覆盖拖拽 payload（P1）**：`ComponentPanelItem/ComponentPanel` 未声明 `emits`，父级 `@dragstart` 同时 fallthrough 为根元素**原生** dragstart 监听，DragEvent 对象在正确 item 之后到达并**覆盖** `_componentDragItem` → ghost 尺寸永远 fallback。**修复**：两个组件声明 `emits: ['select','dragstart','dragend']`。
3. **设计 token 尺寸 NaN（P2）**：wireframe 主题的 w/h 是 `@box-width-l`/`@form-height` 字符串（仅 QSS 渲染管线可解析），`Math.max()` 产生 NaN → ghost 宽高变成 2px。**修复**：`getComponentItemSize` 用 `Number()+isFinite` 防御，token 引用回落默认值（drop 后的 widget 本身仍走 QSS token 渲染，与 CreateButton 一致）。

#### 其他产品改动

- **浮窗层级树默认收起**（仅 40px 标题条）：避免默认遮挡画布中央；`collapsed` 状态随位置/尺寸一起持久化到 `quxLayerFloating`。`LayerListFloating` 根类名为 `MatcLayerListRoot`（不再是 `MatcToolbarLayerList`）。

#### Phase 3：视觉打磨 ✅（轻量）

- `.MatcComponentDropTarget` 虚线 + 光晕（oklch + HEX fallback）。
- 面板拖拽时源 item 半透明（`MatcComponentPanelItemDragging`）。
- 面板开合 220ms `cubic-bezier(0.16,1,0.3,1)` 过渡（Phase 1 已有，保留）。

#### Phase 4：验证 ✅

| 检查 | 结果 |
|---|---|
| `npm run lint` | No errors |
| `npm run test:unit` | 149/149 passed（54 suites） |
| `npm run build` | success |
| `cd backend && npm test` | 18/18 passed |
| `python3 tests/e2e/test_studio.py` | PASS（修复坐标 bug 后） |
| `python3 tests/e2e/test_studio_layers.py` | PASS（选择器改 `.MatcLayerListRoot` + 先展开浮窗） |
| `pytest tests/e2e` | 17/18 首轮（test_simulator dashboard 偶发超时，单独重跑 PASS）；修复后已全量重跑见下 |
| 手动 DnD 验证（dist 环境，DragEvent 合成） | Button ghost 100x40 ✓、Confirm 组 ghost 320x176（children bbox）✓、drop 创建 widget/group+children ✓、点击创建 ✓、i18n ✓、无 pageerror ✓ |

#### 已知遗留问题（非本次范围）

- **dashboard "Welcome to Quant-UX!" 偶发超时**（影响 test_simulator 等）：dev server 编译抖动 + Studio.vue 对单 app 用户的自动跳转（AGENTS.md 已记载该行为）叠加。建议后续把 E2E 的 dashboard 等待换成更稳定的 selector（如 app 卡片元素）。
- 合成 DragEvent 的 `dataTransfer.dropEffect` 在无用户手势时不可写（显示 none），仅影响测试脚本，真实拖拽正常。
- de/pt_br 语言缺失 key 约按原计划回退英文。

### 8.6 重要：工作区未提交改动混杂

当前 `git status --short` 显示 65 文件改动，除本次 Phase 1 的文件外，还包含大量未提交内容（通知系统删除、Studio/Account/Settings 等 i18n 化、dashboard 样式调整）。建议：

1. 不要直接 `git add -A` 后提交；先 `git diff --stat` / `git add -p` 分块审查。
2. 本次 Phase 1 改动集中在 `src/canvas/toolbar/components/*`、`src/canvas/*`、`src/style/canvas/*`、`src/style/toolbar/*`、`src/views/apps/Design.vue`、`src/nls/*.json` 等。
3. 通知系统相关删除（`public/notification/*`、`src/services/NotificationService.js`、`src/views/apps/StudioNotification.vue` 等）与画布重构无关，是其他并行改动。

### 8.7 关键设计/架构上下文

- 当前画布入口为 `src/views/apps/Design.vue`。
- 现有添加组件逻辑可参考 `src/canvas/toolbar/components/CreateButton.vue`（`onCreate` 触发 `createTheme`）和 `src/canvas/Add.vue`（`addThemedWidget` / `_onAddNDropStart`）。
- `ComponentData.js` 已提取 `setDefaultValues` / `mergeThemeExtensions` / `groupCoreThemes` / `loadComponentData`，可用于 Phase 2 避免复制 `CreateButton.vue` 的大段逻辑。
- `LayerList.vue` 内部仍使用 `Tree.vue` / `TreeItem.vue` 的 HTML5 drag 进行层级排序，浮窗自身拖拽使用 `src/util/DND.js` 的 `onStartDND`。
- Dojo 生命周期：`DojoUtil.initDojoWidget` 同步执行；浮窗容器必须在 `LayerList.$new()` 前存在于 DOM。

### 8.8 推荐下一步命令

```bash
# 快速确认当前状态
npm run lint
npm run test:unit
npm run build

# 继续 Phase 2 后
python3 tests/e2e/test_studio.py
python3 tests/e2e/test_studio_layers.py
```

### 8.9 相关文件索引

| 作用 | 路径 |
|---|---|
| 画布入口/布局 | `src/views/apps/Design.vue` |
| Top Bar | `src/canvas/toolbar/Toolbar.vue` |
| 左侧组件面板 | `src/canvas/toolbar/components/ComponentPanel.vue` |
| 组件数据/共享 helper | `src/canvas/toolbar/components/ComponentData.js` |
| 组件面板开关 | `src/canvas/toolbar/components/ComponentPanelToggle.vue` |
| 层级树浮窗 | `src/canvas/toolbar/components/LayerListFloating.vue` |
| 层级树开关 | `src/canvas/toolbar/components/LayerTreeToggle.vue` |
| 画布核心/拖拽 | `src/canvas/Canvas.vue`、`src/canvas/Add.vue`、`src/canvas/Render.vue` |
| 层级树初始化 | `src/canvas/Layer.vue` |
| 组件面板样式 | `src/style/canvas/component_panel.scss` |
| 浮窗层级树样式 | `src/style/canvas/layer_floating.scss` |
| 项目笔记 | `AGENTS.md` |
