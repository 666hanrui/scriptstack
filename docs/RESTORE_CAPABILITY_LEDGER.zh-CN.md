# 剧本栈恢复能力对账表

> 目的：本文件只做能力对账，不等于验收通过。后续所有恢复工作按本表逐项收敛，避免前端临时拼入口、后端能力堆在仓库里但不可用。

## 0. 当前阶段结论

当前状态不是“完全没恢复”，而是：

- 后端能力已经恢复了大量核心命令。
- 前端已经重构了主页面外观，但部分旧功能入口仍未完整接回。
- 原始本地 Git 提示词已有可证明归档。
- 远端服务器提示词 dump 不存在合法导出文件，不能声称已恢复。

## 1. Prompt 来源状态

| 项目 | 当前状态 | 证据 | 处理原则 |
|---|---|---|---|
| 本地 Git 原始提示词 | 已归档 | `original-prompt-archive/manifest.json` 记录 `sourceCommit`、`byteSize`、`sha256`、`exactBytesFromGit` | 不允许重写 raw-original |
| active prompt 与 raw-original | 需持续校验 | 后续必须用脚本比对 active prompt 与 raw-original | 任何变更必须生成 hash 记录 |
| 远端服务器提示词 dump | 不存在合法导出 | `REMOTE_SERVER_CAPTURE_STATUS.zh-CN.md` 明确没有合法导出的远端服务器提示词 dump | 不允许伪造远端来源 |
| debug prompt 审计 | 未闭环 | 默认落到 `$HOME/Library/Application Support/ScriptStack/debug-prompts`，也可用 `SCRIPTSTACK_PROMPT_AUDIT_DIR` 覆盖 | 后续需要真实调用后落 `prompt_hash_index.jsonl`，禁止写回源码目录触发 Tauri dev 重启 |

## 2. 前端 Bridge 与后端命令对账

### 2.1 Workflow 八步工作流

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| 创建 workflow project | `project/create` | `screenplay_create_project` | `/` 首页 | 已接 | 入口可用，仍需 GUI 验证 |
| 恢复 project | `screenplay/get` | `screenplay_get_project` | `/workflow` | 已接 | RouteGuard 曾提前拦截，已改为由 WorkflowValley 自己处理 |
| 最近项目列表 | `screenplay/list-recent` | `screenplay_list_recent_projects` | `/projects` | 部分接 | 后端摘要字段不足，缺 `currentStep/doneSteps/linkedScriptTaskId` |
| 生成 step | `workflow/generate` | `screenplay_generate_step` | `StepEngine` | 已接 | 不在本轮改动范围 |
| 自检 step | `workflow/selfcheck` | `screenplay_selfcheck_step` | `StepEngine` | 已接 | 不在本轮改动范围 |
| 读取 cached selfcheck | `workflow/selfcheck-cached` | `screenplay_get_cached_selfcheck` | `StepEngine` | 已接 | 需 GUI 验证 |
| approve step | `workflow/approve` | `screenplay_approve_step` | `StepEngine` | 已接 | 需验证 doneSteps 不伪完成 |
| rollback | `workflow/rollback` | `screenplay_rollback_to` | `StepEngine` | 已接 | 需验证 UI 是否有入口 |
| versions | `workflow/versions` | `screenplay_list_versions` | `StepEngine` | 已接 | 需验证版本切换 |
| restore version | `workflow/restore-version` | `screenplay_restore_version` | `StepEngine` | 已接 | 需验证 active version |
| finalize | `workflow/finalize` | `screenplay_finalize_to_script_task` | `StepEngine` | 已接 | 需验证幂等性与 linked task 回写 |
| checkpoint | `workflow/get-checkpoint` | `screenplay_get_checkpoint` | `StepEngine` | 已接 | 需验证 |
| regenerate checkpoint | `workflow/regenerate-checkpoint` | `screenplay_regenerate_checkpoint` | `StepEngine` | 已接 | 需验证 |
| Doctor | `workflow/doctor` | `doctor_diagnose` | `/workflow` Doctor panel | 已接 | 后端仍复用 `screenplay_checkpoint` context，功能定位不干净 |

### 2.2 Script 任务

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| 最近剧本任务 | `script/recent` | `get_recent_script_tasks` | `/scripts` | 已接 | 需验证数据展示 |
| 读取任务 | `script/load` | `load_script_task` | `/scripts` | 已接 | 需验证 script body |
| 保存草稿 | `script/save-draft` | `save_script_draft` | `/scripts` | 已接 | 需验证 |
| 生成剧本 | `script/generate` | `save_script_generation` | `/scripts` | 已接 | 需验证配置缺失时提示 |
| 导入剧本 | `script/import` | `import_existing_script` | `/scripts` | 已接 | 需验证 |
| 更新正文 | `script/update-body` | `update_script_body` | `/scripts` | 已接 | 后端返回 void，前端需只做乐观提示 |
| 剧本审核 | `script/review` | `run_script_review` | `/scripts` | 已接 | 需验证真实审核还是 mock |

### 2.3 Asset 资产矩阵

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| 提取资产 | `asset/extract` | `run_asset_extraction` | `/assets` | 已接 | API 未配置时直接失败，fallback 不会执行 |
| 读取资产 | `asset/get-all` | `get_assets_by_task` | `/assets` | 已接 | 需验证三类资产读取 |
| 更新资产 | `asset/update` | `update_assets` | `/assets` | 已接 | normalize 会丢字段，需要修 |
| scan events | `asset:scan-*` | `app.emit` | `/assets` | 已接 | 目前是阶段性事件，不是真细粒度 streaming |

### 2.4 PromptLab 旧 V2 完整链路

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| 独立图像提示词 | `prompt/image` | `run_image_generation` | `/image` | 已接 | 当前 PromptLab 只接独立链路 |
| 独立视频提示词 | `prompt/video` | `run_video_generation` | `/video` | 已接 | 当前 PromptLab 只接独立链路 |
| 图像审核 | `prompt/image-review` | `run_image_review` | `/image` | 已接 | 需验证 |
| 视频审核 | `prompt/video-review` | `run_video_review` | `/video` | 已接 | 需验证 |
| 生成 outline | `prompt/generate-outline` | `generate_outline` | 缺页面入口 | 未接 | PromptLab V2 核心缺口 |
| 确认 outline | `prompt/confirm-outline` | `confirm_outline` | 缺页面入口 | 未接 | PromptLab V2 核心缺口 |
| 获取 outline | `prompt/get-outline` | `get_outline` | 缺页面入口 | 未接 | PromptLab V2 核心缺口 |
| run generation | `prompt/run-generation` | `run_prompt_generation` | 缺完整入口 | 未接/旧入口残留 | 逐镜生成链路没接回 |
| run group generation | `prompt/run-group-generation` | `run_prompt_group_generation` | 缺页面入口 | 未接 | 分组生成缺入口 |
| prompt output | `prompt/get-output` | `get_prompt_output_by_task` | 缺页面入口 | 未接 | 无输出恢复面板 |
| prompt update | `prompt/update-output` | `update_prompt_output` | 缺页面入口 | 未接 | 无编辑保存入口 |
| scene count | `prompt/get-scene-count` | `get_scene_count` | 缺页面入口 | 未接 | 不能辅助分镜数量恢复 |
| segment titles | `prompt/get-segment-titles` | `get_segment_titles` | 缺页面入口 | 未接 | 无分段标题恢复 |
| quality check | `prompt/quality-check` | `run_prompt_quality_check` | 缺页面入口 | 未接 | 质量闭环缺失 |

### 2.5 Seedance V5

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| Phase A-D | `seedance/phase-ad` | `seedance_run_phase_ad` | `/seedance` | 已接 | 需验证 |
| 读取 analysis | `seedance/get-analysis` | `seedance_get_analysis` | `/seedance` | 已接 | 需验证 |
| list units | `seedance/list-units` | `seedance_list_units` | `/seedance` | 已接 | 需验证 |
| get unit | `seedance/get-unit` | `seedance_get_unit` | `/seedance` | 已接 | 需验证 |
| run unit | `seedance/run-unit` | `seedance_run_unit` | `/seedance` | 已接 | 需验证 |
| run all | `seedance/run-all` | `seedance_run_all` | `/seedance` | 部分接 | 当前前端逐个 run-unit，未直接调用 run-all |
| progress event | `seedance:progress` | `app.emit` | `/seedance` | 已接 | 后端 progress 粒度有限 |

### 2.6 Auth / Token

| 能力 | 前端 action | 后端 command | 当前前端入口 | 状态 | 问题 |
|---|---|---|---|---|---|
| 登录 | `auth/login` | `auth_login` | `AuthModal` | 部分接 | 登录成功后需确认是否调用 auth/set-token |
| 注册 | `auth/register` | `auth_register` | `AuthModal` | 部分接 | 需确认前端保存 token 策略 |
| 状态 | `auth/status` | `auth_status` | `AuthModal` / app start | 部分接 | 后端只看 `SCRIPTSTACK_AUTH_TOKEN` 环境变量 |
| set token | `auth/set-token` | `set_auth_token` | 需查 | 可能未接 | 如果登录后不调用，后端状态与前端状态不一致 |
| refresh | `auth/refresh` | `auth_refresh` | 需查 | 可能未接 | 需要接线或移除误导 |

## 3. 已确认结构性问题

### P0：Workflow RouteGuard 抢先拦截

`/workflow` 原本被 `RouteGuard requireProjectId` 包住，导致 `WorkflowValley` 内部 stale project / task handoff UI 永远无法执行。

处理策略：

- `/workflow` 不应该由 RouteGuard 强制拦截。
- 由 `WorkflowValley` 自己处理四种状态：
  1. 有 project：进入 Step 1-8。
  2. 有 task 无 project：显示 task handoff。
  3. 无 project 无 task：显示新建/恢复引导。
  4. stale project：显示失效项目恢复。

### P0：PromptLab V2 完整链路未接回

后端与 bridge 都已有旧链路命令，但当前 `/image` `/video` 只接独立图像/视频提示词，不包含旧的 outline / group / quality-check 流程。

处理策略：新增独立页面或 PromptLab tabs：

- 独立图像提示词
- 独立视频提示词
- 逐镜分镜提示词
- Prompt 输出恢复 / 质量检查

### P1：screenplay/list-recent 摘要字段不足

后端 `list_recent` 只返回：

- projectId
- updatedAt
- name
- concept

前端项目库却需要：

- currentStep
- doneSteps
- linkedScriptTaskId
- status

处理策略：后端摘要补字段，不让前端猜。

### P1：Asset normalize 丢字段

资产 normalize 只白名单保留少量字段。模型返回的额外丰富字段会被丢弃。

处理策略：normalize 应保留原始字段，并叠加标准字段，而不是只输出标准字段。

### P1：未配置 API 时资产提取直接失败

当前 `prepare` 在 API key 或 endpoint 缺失时直接 Err，fallback regex 不会执行。

处理策略：允许无 API 时走 fallback；但 UI 必须明确显示 fallback 模式、质量较低。

### P2：Auth 登录态前后端不一致风险

后端 `auth_status` 只看 `SCRIPTSTACK_AUTH_TOKEN`，而前端登录成功后如果只写 Zustand，则后端不知道 token。

处理策略：登录/注册/refresh 成功后统一调用 `auth/set-token`，或者改 auth_status 从持久化用户状态读。

### P2：BrowserRouter 对 file:// 脆弱

Tauri dev URL 通常没事，但直接打开 `dist/index.html` 的 file:// 场景仍不稳。

处理策略：改 HashRouter，或明确产品只支持 Tauri/webview URL。

## 4. 下一阶段施工顺序

### 阶段 1：修 Workflow 恢复入口

目标：先把用户当前遇到的问题彻底修掉。

- 保留 `App.tsx` 中 `/workflow` 不再使用 `requireProjectId`。
- 增强 `EmptyStateGuide`，让 project 缺失时如果已有 task，显示 task handoff，而不是“没选择”。
- 验证从 `/scripts` 选择 task 后进入 `/workflow` 的表现。

### 阶段 2：补项目库摘要字段

目标：让 `/projects` 能真实知道 workflow 的 currentStep / doneSteps / linked task。

- 修改 `screenplay_store::list_recent` 返回字段。
- 修改 ProjectsPage 使用真实字段。
- 确保 WORKFLOW 卡片能正确判断是否有 linked script task。

### 阶段 3：修资产提取可靠性

目标：让资产矩阵在 API 未配置和模型字段丰富时都不崩、不丢。

- 无 API 时允许 fallback。
- normalize 保留 raw 字段。
- `/assets` 标记 fallback 模式。

### 阶段 4：补 PromptLab V2 tabs

目标：把后端已有旧链路完整接回前端。

- 新增 `FramePromptLab` 或在 PromptLab 内新增 tabs。
- 接 `generate-outline / confirm-outline / get-outline`。
- 接 `run-generation / run-group-generation`。
- 接 `get-output / update-output`。
- 接 `quality-check`。

### 阶段 5：修 Auth token 接线

目标：前端登录态和后端 token 状态一致。

- 登录成功调用 `auth/set-token`。
- 注册成功调用 `auth/set-token`。
- refresh 成功调用 `auth/set-token`。
- 启动时 `auth/status` 与 Zustand reconciliation。

### 阶段 6：Router 策略

目标：处理 file:// 黑屏风险。

- 若产品允许直接打开 `dist/index.html`：改 `HashRouter`。
- 若产品只允许 Tauri/webview URL：文档明确并禁用 file:// 验收口径。
