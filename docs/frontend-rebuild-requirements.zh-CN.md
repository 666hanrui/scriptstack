# 剧本栈前端重建需求文档

> 目标：本项目后端与核心业务链路已经基本恢复。接下来前端由独立前端/UI 团队接手。本文档定义的是完整前端产品需求，不只是视觉 UI。前端团队需要重建页面结构、交互流程、状态恢复、组件体系、错误处理和验收路径。

---

## 0. 项目定位

产品名：剧本栈 / ScriptStack

核心定位：

```text
面向短剧、分镜、AI 图像提示词、AI 视频提示词、Seedance 镜头单元生成的本地化创作工作台。
```

核心链路：

```text
灵感枢纽 / 新建工作流
→ 工作流 Step 1-8
→ finalize 成 script task
→ 剧本任务页 / 直接生成 / 导入已有剧本
→ 资产矩阵
→ 图像 PromptLab
→ 视频 PromptLab
→ Seedance V5
→ 项目库恢复任意阶段
```

前端重建原则：

```text
1. 前端负责“让人看懂、点得动、可恢复、可验收”。
2. 不改后端命令名和后端数据结构，除非提前沟通。
3. 不把不同业务链路混在一个按钮里。
4. 不做只好看的空壳 UI，所有入口必须接真实 IPC。
5. 所有页面都必须显示当前 Project ID / Script Task ID / 当前阶段状态。
6. 所有页面都必须提供“返回项目库”的入口。
7. 用户不能靠猜按钮完成流程。
```

---

## 1. 技术边界

当前技术栈：

```text
Tauri v2
React
TypeScript
Vite
Zustand
Framer Motion
Lucide React
```

前端代码目录：

```text
frontend-src/src
```

主要路由：

```text
/              灵感枢纽 InspirationHub
/workflow      工作流 Step 1-8 WorkflowValley
/scripts       剧本任务 ScriptTasksPage
/assets        资产矩阵 AssetsForge
/image         图像 PromptLab
/video         视频 PromptLab
/seedance      SeedancePage
/projects      项目库 ProjectsPage
/settings      设置页 Settings
```

关键状态 store：

```text
frontend-src/src/store/useAppStore.ts
```

必须保留并正确维护：

```text
currentProjectId
currentTaskId
currentStep
scriptSeed
realm
```

Tauri IPC 调用入口：

```text
frontend-src/src/hooks/useTudouBridge.ts
```

前端团队可以重构页面和组件，但不要破坏 IPC action 名称和参数包装规则。

---

## 2. 全局产品结构需求

### 2.1 全局布局

需要一个稳定清晰的应用框架：

```text
左侧：主导航
顶部：当前上下文条
中间：当前模块主操作区
右侧或底部：日志 / 错误 / 审核 / 调试信息
```

全局导航至少包含：

```text
灵感枢纽
工作流
剧本
资产
图像
视频
Seedance
项目库
设置
```

每个导航项需要：

```text
图标
中文名称
当前激活状态
不可用时说明原因
```

### 2.2 全局上下文条

所有业务页面顶部必须显示：

```text
当前 Project ID
当前 Script Task ID
当前模块
当前状态
最近错误
返回项目库按钮
```

当 `currentProjectId` 为空但 `currentTaskId` 存在时，页面不能报死，应该提示：

```text
当前没有绑定 workflow project，但可以继续使用 script task 进入剧本、资产、Prompt、Seedance。
```

当 `currentProjectId` 失效时，必须显示恢复面板，而不是只弹 toast。

### 2.3 错误展示

所有错误统一用可读错误卡片展示：

```text
错误标题
错误详情
当前页面
当前 action
Project ID
Task ID
建议下一步
复制错误按钮
```

禁止只显示：

```text
[object Object]
undefined
IPC failed
```

---

## 3. 项目库 `/projects` 需求

项目库是全系统恢复入口，必须重新设计为“恢复控制台”。

### 3.1 项目卡片必须显示

每个项目卡片显示：

```text
项目名称
项目类型：workflow / sqlite / script / image / video / seedance
Project ID
绑定 Script Task ID
当前阶段
更新时间
资产数量 / Prompt 数量 / Seedance Unit 数量，如果能取到
```

### 3.2 项目卡片操作入口

每个项目卡片必须明确提供：

```text
打开工作流
打开剧本
打开资产
打开图像提示词
打开视频提示词
打开 Seedance
重命名
删除
```

如果没有 script task，则资产 / 图像 / 视频 / Seedance 按钮置灰，并说明：

```text
请先完成 workflow finalize，或进入剧本页导入/生成剧本。
```

### 3.3 项目库状态设置

点击入口时必须正确写入：

```text
setCurrentProjectId(projectId)
setCurrentTaskId(taskId)
setCurrentStep(stepIndex)
setScriptSeed(concept/name)
```

### 3.4 项目库验收

验收标准：

```text
从项目库能进入 workflow
从项目库能进入 scripts
从项目库能进入 assets
从项目库能进入 image
从项目库能进入 video
从项目库能进入 seedance
重启后项目库仍能恢复入口
没有用户不知道该点哪里的情况
```

---

## 4. 灵感枢纽 `/` 需求

灵感枢纽是新建 workflow 的入口。

### 4.1 表单字段

必须恢复完整项目配置：

```text
项目名称 name
核心概念 concept
时长 duration
格式 format
超短片模式 ultrashortMode
题材 genres
中文叙事 chinese
大师模板 master
导入剧本 importedScript
导入文件名 importedFileName
```

### 4.2 提交行为

点击新建后调用：

```text
project/create → screenplay_create_project
参数包装：{ init: payload }
```

成功后必须：

```text
setCurrentProjectId(projectId)
setScriptSeed(concept/name)
setCurrentStep(0)
navigate('/workflow')
```

### 4.3 验收

```text
新建项目后进入 workflow
刷新后项目能在项目库看到
项目配置能影响后续 Step 生成提示词
```

---

## 5. 工作流 `/workflow` 需求

工作流负责 Step 1-8 的生成、审核、覆写、批准、finalize。

### 5.1 页面结构

建议结构：

```text
左侧：Step 1-8 进度导航
顶部：当前项目上下文
中间：当前 Step 内容生成/编辑/版本
右侧：自检、checkpoint、AI doctor、错误日志
底部：上一步 / 保存覆写 / 自检 / 批准 / 下一步 / finalize
```

### 5.2 Step 状态

每一步必须显示：

```text
Step 编号
Step 名称
是否已完成
是否有 activeVersion
是否有 selfcheck
是否有人工覆写
```

完成状态只能来自后端 `doneSteps`，不能用 `currentStep > index` 伪造。

### 5.3 失效项目恢复

如果 `screenplay/get` 返回 null：

```text
清掉 stale currentProjectId
保留 currentTaskId
显示恢复面板
提供入口：项目库、灵感枢纽、剧本页、资产页
```

### 5.4 Finalize

Step 8 批准后：

```text
调用 workflow/finalize
拿到 scriptTaskId
setCurrentTaskId(scriptTaskId)
允许进入 scripts/assets/image/video/seedance
```

### 5.5 验收

```text
Step 1-8 能生成
切换 Step 不丢内容
刷新不丢内容
手动覆写保存后不丢
Step 6 checkpoint 正常
Step 8 finalize 得到 script task
重复 finalize 不创建重复 task
```

---

## 6. 剧本任务 `/scripts` 需求

剧本页是所有剧本来源的统一入口。

### 6.1 三条来源

必须支持：

```text
1. workflow finalize 得到的 script task
2. 直接生成剧本
3. 导入已有剧本
```

三条路线都必须得到统一结构：

```text
script_task + script_output
```

### 6.2 页面结构

建议结构：

```text
顶部：Project ID / Script Task ID / 正文长度 / 审核状态
左侧：最近 script task 列表
中间：生成 / 导入 / 正文编辑
右侧：审核结果 / 问题 / 建议 / 下一阶段入口
```

### 6.3 功能

必须接入：

```text
get_recent_script_tasks
load_script_task
save_script_draft
save_script_generation
import_existing_script
update_script_body
run_script_review
delete_script_task
```

### 6.4 审核展示

审核结果不能只 dump JSON，必须结构化显示：

```text
总分 score
状态 status
总结 summary
维度 dimensions
问题 issues
建议 suggestions
修改路径 / rewrite plan，如后端有返回
```

### 6.5 下一阶段入口

选中 script task 后必须直接能进入：

```text
资产
图像
视频
Seedance
```

### 6.6 验收

```text
导入已有剧本后能进入资产
直接生成剧本后能进入资产
workflow finalize 的剧本能被选中
编辑正文保存后刷新不丢
审核结果可读
```

---

## 7. 资产矩阵 `/assets` 需求

资产页只做资产，不混 PromptLab。

### 7.1 页面结构

建议结构：

```text
顶部：当前 Project / Script Task / 资产总数 / 状态
左侧：ScriptSelector + 扫描控制 + 事件日志
中间：角色 / 场景 / 道具 Tab
右侧或卡片：资产字段编辑
```

### 7.2 功能

必须接入：

```text
run_asset_extraction
get_assets_by_task
update_assets
```

监听事件：

```text
asset:scan-start
asset:scan-character
asset:scan-scene
asset:scan-prop
asset:scan-done
asset:scan-error
```

### 7.3 字段要求

角色卡片显示并可编辑：

```text
name
appearance
clothing
personality
visualAnchor
aiPrompt
```

场景卡片显示并可编辑：

```text
name
atmosphere
materials
landmarks
colorTemperature
aiPrompt
```

道具卡片显示并可编辑：

```text
name
dramaticFunction
form
material
surfaceState
aiPrompt
```

### 7.4 验收

```text
没有 currentTaskId 时明确提示选择 script task
扫描时有真实状态
扫描失败显示真实错误
扫描成功后角色/场景/道具数量正确
资产可编辑并保存
刷新后资产仍在
```

---

## 8. 图像 `/image` 与视频 `/video` PromptLab 需求

图像和视频页面负责旧独立提示词流程。

### 8.1 明确区分

`/image` 必须明确显示：

```text
独立图像提示词
prompt/image → run_image_generation
slug_image_prompt_generation.txt
prompt/image-review
```

`/video` 必须明确显示：

```text
独立视频提示词
prompt/video → run_video_generation
slug_video_prompt_generation.txt
prompt/video-review
```

### 8.2 页面结构

建议结构：

```text
顶部：Project / Source Script Task / Prompt Task / 审核状态
左侧：ScriptSelector + 源文本
中间：风格参数 + 生成按钮 + 审核按钮
右侧或下方：生成结果分段展示
```

### 8.3 图像 payload

必须传：

```text
mode
sourceScript
visualStyle
imageGoal
existingTaskId
sourceScriptTaskId
existingProjectId
```

### 8.4 视频 payload

必须传：

```text
mode
scriptBeats
videoStyle
motionFocus
existingTaskId
sourceScriptTaskId
existingProjectId
```

### 8.5 验收

```text
从 script task 能生成 image prompt
从 script task 能生成 video prompt
审核能跑
结果能结构化展示
错误能显示
不会出现 assetId 假链路
```

---

## 9. 逐镜分镜 Prompt 工作台需求

后端已有链路：

```text
generate_outline
confirm_outline
run_prompt_generation
run_prompt_group_generation
get_prompt_output_by_task
get_scene_count
get_segment_titles
run_prompt_quality_check
```

建议单独做一个页面或在 PromptLab 内加独立 Tab：

```text
逐镜分镜 Prompt
```

不要和旧独立图像/视频混在同一个按钮里。

### 9.1 页面结构

```text
左侧：ScriptSelector
顶部：当前 task / outline 状态 / scene count
中间：生成大纲 → 编辑大纲 → 确认大纲
下方：逐镜生成结果
右侧：单镜重跑 / 质量检查 / 错误日志
```

### 9.2 验收

```text
能生成 outline
能编辑并 confirm outline
能生成完整逐镜提示词
能单镜重跑
能质量检查
重启后能恢复 prompt_output_records
```

---

## 10. Seedance `/seedance` 需求

Seedance V5 固定两层：

```text
Phase A-D 分析
Unit E/F/G 生成
```

### 10.1 页面结构

建议结构：

```text
顶部：Project / Script Task / A-D 状态 / Unit 完成数量
左侧：ScriptSelector + 剧本预览 + seedance:progress 日志
中间：Phase A-D 分析
右侧：Unit 列表
底部：当前 Unit 详情 copyArea / noteAreaJson / error
```

### 10.2 功能

必须接入：

```text
seedance_run_phase_ad
seedance_get_analysis
seedance_list_units
seedance_get_unit
seedance_run_unit
seedance_run_all
```

监听：

```text
seedance:progress
```

### 10.3 Unit 展示

每个 Unit 显示：

```text
unitIndex
sceneType
durationSec
subShotCount
status
errorMessage
copyArea
noteAreaJson
retryCount
```

### 10.4 验收

```text
Phase A-D 能生成
units 能列出
单个 unit 能生成
全部生成能逐条更新
错误不被吞
重启后 analysis 和 units 可恢复
```

---

## 11. 设置页 `/settings` 需求

设置页必须合并为唯一入口，不再保留废弃 SettingsPage。

### 11.1 必须包含

```text
文本模型 endpoint
文本模型 key
文本模型 model
文本模型 mode: openai / anthropic / gemini 等
图像模型 endpoint
图像模型 key
图像模型 model
连接测试
数据库路径
App 版本号
本地保存开关
审核阈值
```

### 11.2 安全要求

```text
不显示完整 API key
错误信息不得泄露 API key
不把 key 写入 prompt dump
不把 key 写入日志
```

### 11.3 验收

```text
配置能保存
重启后配置还在
连接测试能返回成功/失败
失败信息脱敏
```

---

## 12. ScriptSelector 组件需求

`ScriptSelector` 是多个页面共用核心组件。

使用页面：

```text
/scripts
/assets
/image
/video
/seedance
逐镜分镜 Prompt 页面
```

必须能力：

```text
加载最近 script tasks
显示项目名 / taskId / 更新时间 / stage
搜索或过滤
选中后返回 task + script body
显示当前选中状态
空列表时引导用户去 /scripts 导入或生成
```

---

## 13. IPC 契约要求

前端必须继续通过：

```text
useTudouBridge.invoke(action, payload, options)
```

不要直接在页面里散落 `tauriInvoke`。

### 13.1 常用 action

项目与工作流：

```text
project/create
screenplay/list-recent
screenplay/get
screenplay/delete
workflow/generate
workflow/selfcheck
workflow/approve
workflow/finalize
workflow/get-checkpoint
workflow/regenerate-checkpoint
```

剧本：

```text
script/recent
script/load
script/save-draft
script/generate
script/import
script/update-body
script/review
script/delete
```

资产：

```text
asset/extract
asset/get-all
asset/update
```

图像/视频：

```text
prompt/image
prompt/video
prompt/image-review
prompt/video-review
```

逐镜分镜：

```text
prompt/generate-outline
prompt/confirm-outline
prompt/run-generation
prompt/run-group-generation
prompt/get-output
prompt/get-scene-count
prompt/get-segment-titles
prompt/quality-check
```

Seedance：

```text
seedance/phase-ad
seedance/get-analysis
seedance/list-units
seedance/get-unit
seedance/run-unit
seedance/run-all
```

设置：

```text
config/get
config/set
config/test
database/meta
app/version
```

---

## 14. 数据恢复与状态规则

### 14.1 主恢复主键

```text
workflow project 用 currentProjectId
script / assets / prompt / seedance 用 currentTaskId
```

### 14.2 允许没有 workflow project

用户可能导入已有剧本，此时没有 workflow project，但应该能继续：

```text
scripts → assets → image/video → seedance
```

### 14.3 stale 状态处理

如果 localStorage 里存的 currentProjectId 找不到：

```text
清掉 currentProjectId
保留 currentTaskId
提示用户从项目库恢复
不要让页面崩溃
```

如果 currentTaskId 找不到：

```text
清掉 currentTaskId
提示去剧本页选择或创建
```

---

## 15. 前端验收金线

最终必须能完成以下全流程：

```text
1. 灵感枢纽新建项目
2. 工作流 Step 1-8 生成
3. Step 6 checkpoint
4. Step 8 finalize 成 script task
5. 项目库能看到 workflow 和 script task
6. 剧本页能打开 script task
7. 剧本正文能编辑保存
8. 剧本审核能显示结构化结果
9. 资产页能扫描角色/场景/道具
10. 资产能编辑保存并刷新恢复
11. 图像页能生成独立 image prompt
12. 图像审核能显示结果
13. 视频页能生成独立 video prompt
14. 视频审核能显示结果
15. 逐镜分镜页能生成 outline、确认、生成逐镜 prompt、单镜重跑
16. Seedance 能跑 A-D、列 units、单个 unit、全部 unit
17. 重启应用后，项目库能恢复任意阶段
18. 所有错误都有可读提示
19. 用户不需要猜下一步点哪里
```

---

## 16. 视觉方向建议

视觉可以由 UI 团队自由发挥，但必须满足可用性。

建议方向：

```text
高级本地创作软件
深色背景
清晰卡片层级
少用过度 AI 蓝紫渐变
按钮主次分明
模块间路径明确
信息密度适中
```

禁止：

```text
按钮堆成一团
所有区域都像装饰面板
没有明确主操作按钮
错误只弹 toast
ID / 状态信息藏起来
用纯视觉效果牺牲可读性
```

---

## 17. 前端团队交付要求

前端团队每次提交必须说明：

```text
改了哪些页面
改了哪些组件
是否改了 IPC action
是否改了 store 字段
是否影响后端数据结构
如何验收
```

每次提交后必须跑：

```bash
npm run frontend:typecheck
npm run frontend:build
```

如果改了 IPC 或涉及后端启动，还要跑：

```bash
cd src-tauri && cargo check
```

---

## 18. 前端团队不要做的事

```text
不要改 src-tauri 后端逻辑
不要改 prompt 原文
不要改 original-prompt-archive
不要改 IPC command 名称
不要把旧独立图像/视频和逐镜分镜混成一个按钮
不要把 assetId 伪造成 prompt 链路
不要吞错误
不要删除现有业务能力
```

---

## 19. 一句话目标

```text
把剧本栈前端重建成一个“用户一眼能看懂当前在哪、下一步点哪里、数据有没有保存、错误该怎么恢复”的完整创作工作台。
```
