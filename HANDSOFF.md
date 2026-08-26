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
