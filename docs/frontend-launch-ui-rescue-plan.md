# ScriptStack 上线前前端 UI 救火任务书

更新时间：2026-05-22

目标：今天上线前，把当前前端从“开发调试界面”收敛成“可公测产品界面”。本任务只允许调整页面结构、公共组件、视觉层级、导航入口和文案密度，不允许改业务命令、后端接口、23 提示词流程、资产/视觉/逐镜/Seedance 数据流。

## 一、当前问题判断

### 1. 页面顶部被吞

截图 1 中「长故事孵化器」标题被顶部状态栏压住。根因不是这个页面单独写错，而是：

- `ContextStatusBar` 使用 `absolute top-0 left-0 z-40`。
- `MainLayout` 里它视觉上盖住了页面，但不占据布局高度。
- `PageShell` 仍然从容器顶部开始排版，所以每页顶部都有被遮挡风险。

必须把状态栏改成正常文档流中的 `shrink-0` 顶栏，或给内容区统一增加精确安全区。推荐改成正常文档流。

### 2. 每页都有无意义说明文字

很多页面的 `ModuleHeader subtitle` 是开发期说明，例如“严格对应 xxx prompt”“这里不会覆盖 xxx”“每个页面入口必须对齐 xxx”。这些不是用户需要看的产品内容，会让软件显得像内部调试工具。

受影响页面包括：

- `InspirationHub.tsx`
- `LongformIncubator.tsx`
- `WorkflowValley.tsx`
- `ScriptTasksPage.tsx`
- `AssetsForge.tsx`
- `VisualPromptForge.tsx`
- `StoryboardPromptBuilder.tsx`
- `FramePromptLab.tsx`
- `SeedancePage.tsx`
- `PromptLab.tsx`
- `ProjectsPage.tsx`
- `Settings.tsx`
- `AdminDashboard.tsx`
- `FlowMapPage.tsx`

其中 `FlowMapPage` 是开发/校验页面，不应该暴露给普通用户。

### 3. 项目卡片信息密度和按钮可读性错误

截图 2 中项目卡片存在几个硬问题：

- 卡片高度过大，空白多。
- `Module / Task ID / Updated` 只有标签，没有明确值，像半成品。
- 大紫色按钮上文字不可读，轻主题下 primary button 被全局 CSS 把 `text-white` 覆盖成深色。
- 只有“工作流”一个巨大按钮，其他入口被挤到不可见或语义不清。
- 项目库应该像“项目队列 / 文件夹树 / 工程列表”，而不是营销卡片。

### 4. 公共组件没有产品边界

`ModuleHeader`、`Panel`、`EmptyState`、`ActionButton` 目前太自由，导致每个页面都能塞长解释、副标题、大卡片、大按钮。必须先统一公共组件，否则单页修完还会反复烂。

## 二、上线版设计原则

### 原则 A：页面第一屏必须是工具，不是说明书

每页只保留：

- 当前页面名称
- 当前项目/任务状态
- 1 个主操作
- 2-4 个必要跳转

禁止在页面顶部放长句解释。解释文字只允许放在：

- 空状态
- 错误状态
- 设置项 helper
- 高级折叠区

### 原则 B：顶栏和侧栏只做定位，不抢内容

顶部状态栏只显示：

- 当前模块名
- 当前项目/任务简短锚点
- 项目库入口

不要再显示开发 ID、prompt 对齐说明、大段状态解释。

### 原则 C：按钮必须有强可读性

Primary button 在亮色/暗色模式都必须是：

- 背景：品牌主色
- 文字：白色
- 图标：白色或 90% 白
- 高度：36-44px
- 不允许出现深紫背景 + 黑字

### 原则 D：卡片少而密，面板只框工具

不要把页面 section 都做成大卡片。只允许：

- 表单容器
- 列表项
- 结果查看器
- 模态框
- 真正的工作台面板

项目队列、分集列表、资产列表要更像工作流工具，而不是展示型卡片。

## 三、必须优先执行的 P0 改造

P0 必须先做，做完才能继续调整单页。

### P0-1：修复顶部安全区

涉及文件：

- `frontend-src/src/layouts/MainLayout.tsx`
- `frontend-src/src/components/layout/ContextStatusBar.tsx`
- `frontend-src/src/components/ui/PageShell.tsx`

具体要求：

1. `ContextStatusBar` 从绝对定位改为文档流顶栏。

当前错误形态：

```tsx
<header className="h-14 ... absolute top-0 left-0 z-40 ...">
```

改为：

```tsx
<header className="h-14 shrink-0 w-full flex items-center justify-between px-6 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
```

2. `MainLayout` 保持：

```tsx
<main className="relative z-10 flex-1 flex flex-col h-full min-w-0 ...">
  <ContextStatusBar />
  <div className="relative flex-1 min-h-0 overflow-hidden">
    <Outlet />
  </div>
</main>
```

重点是内容容器必须有 `min-h-0`，避免内部滚动失控。

3. `PageShell` 不要为了躲顶栏写魔法 padding。顶栏进入文档流后，`PageShell` 使用稳定间距即可：

```tsx
px-6 py-6 lg:px-8 lg:py-8
```

4. 验收：

- `/longform` 标题完整显示，不被顶栏遮挡。
- `/workflow`、`/projects`、`/assets` 顶部都不被吞。
- 窗口高度 768px 时不出现双层奇怪滚动。

### P0-2：让 ModuleHeader 变成真正的页面头

涉及文件：

- `frontend-src/src/components/ui/ModuleHeader.tsx`

改造目标：

- 默认不显示 `subtitle`。
- 页面头高度紧凑。
- 标题不超过一行，长标题截断。
- 图标尺寸更小。

建议接口：

```tsx
interface ModuleHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showSubtitle?: boolean;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}
```

默认：

```tsx
showSubtitle = false
compact = true
```

渲染规则：

- `subtitle && showSubtitle` 才显示副标题。
- 普通用户页面一律不传 `showSubtitle`。
- `AdminDashboard`、`Settings` 可以传 `showSubtitle`，但文案必须短。
- `FlowMapPage` 不给普通用户入口。

验收：

- `/longform` 顶部只看到“长故事孵化器”和右侧操作，不看到解释句。
- `/workflow` 顶部不再出现“严格对应 screenplay_step...”。
- `/assets` 顶部不再出现“英文 AIPROMPT 会在视觉提示词工坊派生...”。

### P0-3：修复 primary button 亮色模式文字

涉及文件：

- `frontend-src/src/components/ui/ActionBar.tsx`
- `frontend-src/src/styles.css`

根因：

`styles.css` 中亮色模式有全局规则：

```css
.scriptstack-root[data-theme="light"] [class*="text-white"] {
  color: rgba(15, 23, 42, 0.72) !important;
}
```

它会把 `ActionButton primary` 的白字改成深色。后面的修复规则只覆盖 `bg-indigo`，但当前按钮用的是 `bg-[var(--accent)]`，所以没有命中。

改法：

1. `ActionButton` 给按钮加属性：

```tsx
data-variant={variant}
```

2. CSS 加强制覆盖：

```css
.scriptstack-root[data-theme="light"] button[data-variant="primary"],
.scriptstack-root[data-theme="light"] button[data-variant="primary"] svg {
  color: #fff !important;
}
```

3. primary disabled 时不要变成看不清：

```tsx
disabled:opacity-50
```

不要低于 0.45。

验收：

- 项目库“工作流”按钮在亮色模式下是白字。
- “生成长故事”“保存配置”“Phase A-D”等主按钮在亮色模式下都可读。

### P0-4：项目库卡片改成工程列表

涉及文件：

- `frontend-src/src/pages/ProjectsPage.tsx`

当前卡片太大。上线版项目库要改成“项目队列”。

布局建议：

```text
项目名                                      状态       进度        更新时间       操作
Missrola 剧本集 V1                          推进中     Step 1/8    今天 12:30    打开 / 剧本 / 资产 / 更多
```

桌面端可以是列表行，非营销卡片。移动端再折叠为卡片。

每个项目行必须包含：

- 项目名
- 类型 chip：WORKFLOW / TASK
- 状态 chip：推进中 / 已成稿 / 草稿
- 进度：`Step x/8` 或 `Script ready`
- 更新时间
- 主操作：打开
- 次操作：剧本、资产、视觉、逐镜、Seedance，根据上下文启用/禁用

删除或改造：

- 删除大面积空白。
- 删除没有值的 `Module / Task ID / Updated` 标签。
- 不展示完整 ID，必要时只在 tooltip 或“更多”中显示。
- 不要用一个巨大横向紫色按钮占满底部。

验收：

- 一屏至少能看到 6 个项目。
- 主操作按钮文字清晰。
- 已完成项目和进行中项目区别清楚。

## 四、P1：统一页面信息结构

P1 是上线观感的主体。P0 做完后执行。

### P1-1：普通用户页面删除顶部说明

需要逐页处理这些 `ModuleHeader subtitle`：

| 页面 | 当前问题 | 上线处理 |
|---|---|---|
| `InspirationHub.tsx` | 解释“可恢复、可 finalize...” | 删除 subtitle |
| `LongformIncubator.tsx` | 解释“把一个想法扩展...” | 删除 subtitle，空状态里保留一句短提示 |
| `WorkflowValley.tsx` | 暴露 screenplay_step/selfcheck/checkpoint | 删除 subtitle |
| `ScriptTasksPage.tsx` | 暴露 script_planning/writing/review | 删除 subtitle |
| `AssetsForge.tsx` | 暴露 asset_character/scene/prop | 删除 subtitle |
| `VisualPromptForge.tsx` | 说明中文资产/英文 AIPROMPT | 移到页面内“高级说明”折叠，不放头部 |
| `StoryboardPromptBuilder.tsx` | 说明自动匹配角色图 | 删除 subtitle |
| `FramePromptLab.tsx` | 暴露 prompt_segment_planning | 删除 subtitle |
| `SeedancePage.tsx` | 暴露 seedance_phase_ad/unit_efg | 删除 subtitle |
| `ProjectsPage.tsx` | 解释“统一中枢...” | 删除 subtitle |
| `PromptLab.tsx` | 如果旧视频提示页保留，则删除 subtitle | 更推荐从侧栏移除 |

### P1-2：Panel subtitle 收敛为元信息

涉及文件：

- `frontend-src/src/components/ui/Panel.tsx`

规则：

- `Panel subtitle` 只能用于短元信息，如 `12 个单元`、`ready`、`Step 1/8`。
- 禁止用完整句子做 subtitle。
- 如果 subtitle 超过 24 个中文字符或 48 个英文字符，自动不显示或折叠到 info tooltip。

建议在 `Panel` 里加保护：

```tsx
const shouldRenderSubtitle =
  typeof subtitle !== 'string' || subtitle.length <= 48;
```

更好的方式是新增 `meta` prop，长期替代 `subtitle`。

### P1-3：EmptyState 只在必要时解释

涉及文件：

- `frontend-src/src/components/ui/EmptyState.tsx`

规则：

- 空状态说明最多 1 行。
- 不要出现“请先 xxx 页面，再 xxx”这种长流程说明。
- 复杂说明用按钮动作解决。

推荐视觉：

- 图标 40px，不要 64px 大图标。
- 最小高度从 `300px` 降到 `180px`。
- 背景透明或 `var(--surface-muted)`，不要显得像巨大占位广告。

## 五、P1：侧栏和页面入口收敛

涉及文件：

- `frontend-src/src/components/layout/GlobalSidebar.tsx`
- `frontend-src/src/App.tsx`
- `frontend-src/src/constants.ts`

### 普通用户侧栏保留顺序

普通用户只显示：

1. 灵感枢纽
2. 长故事
3. 工作流
4. 剧本
5. 资产
6. 视觉工坊
7. 故事版
8. 逐镜
9. Seedance
10. 项目库

### 普通用户隐藏

- `PromptLab` / `/video` 如果只是旧视频提示词页，先从侧栏隐藏。
- `FlowMapPage` 必须隐藏，只允许管理员或开发模式进入。
- `Settings` 只给管理员。
- `AdminDashboard` 只给管理员。

注意：隐藏侧栏入口不等于删除路由。如果其他页面还跳转到旧页，要同步清掉按钮。

### 需要清理的重复入口

`FramePromptLab.tsx` 顶部现在有多个“视觉工坊”按钮，其中至少有重复。保留一个即可：

- 项目库
- 剧本
- 资产
- 视觉工坊
- Seedance

不要同一行出现两个视觉工坊。

## 六、P1：长故事页具体改造

涉及文件：

- `frontend-src/src/pages/LongformIncubator.tsx`

### 当前问题

- 顶部被吞。
- 顶部解释句太多。
- 左侧表单像后台配置，不像创作入口。
- 空状态解释太重。
- 生成结果卡片信息层级偏散。

### 改造结构

```text
长故事
[项目库] [工作流] [生成]

左侧：创意输入
- 故事想法 textarea
- 形态 select
- 集数 select
- 单集长度 select 或 preset
- 题材 tags
- 高级设置折叠：受众、风格、补充约束

右侧：生成结果
- 故事名 + logline
- 分集列表
- 当前集详情
- 主按钮：进入八步工作流
```

### 具体要求

- 删除 `subtitle="把一个想法扩展成..."`。
- `创意输入 subtitle="Idea"` 删除。
- `等待长故事方案` 的 description 改成短句：“输入想法后生成分集方案。”
- `Series Project` ID 默认隐藏到详情折叠，不要第一屏展示。
- 分集列表最多 360px 宽，右侧当前集详情占主空间。
- “进入八步工作流”是当前集唯一主按钮。

## 七、P1：工作流页具体改造

涉及文件：

- `frontend-src/src/pages/WorkflowValley.tsx`
- `frontend-src/src/components/workflow/StepEngine.tsx`

### 当前问题

- 页面头暴露内部 prompt / checkpoint 说明。
- 左侧 Stepper 卡片太厚，下面 Genesis Seed 占位太大。
- 右侧 StepEngine 内容长时，底部下一步按钮需要滚很久才能到。

### 改造要求

1. 页面头只显示：

```text
八步工作流
[项目库] [剧本] [资产] [剧本诊断]
```

2. 左侧：

- Stepper 列表固定可滚。
- Genesis Seed 收起为 2 行摘要，点击展开。
- 不要用大卡片显示一长段种子。

3. 右侧 StepEngine：

- 头部固定在卡片顶部。
- 底部操作栏固定在卡片底部。
- 中间内容区独立滚动。

验收：

- 生成很长内容后，“批准本步并进入下一步”不需要滚到页面底部才能点。
- Step 1-8 切换时已生成内容可见。

## 八、P1：项目库具体改造

涉及文件：

- `frontend-src/src/pages/ProjectsPage.tsx`

### 页面结构

```text
项目库
[新建工作流] [长故事]

左侧窄栏：项目分组
- 全部
- 工作流
- 剧本任务
- 已成稿

右侧主区：项目队列
```

### 项目行样式

每行高度建议 72-92px。

```text
Missrola 剧本集 V1          WORKFLOW  推进中  Step 1/8  今天 12:30     [打开] [剧本] [资产] [...]
```

不要再使用现在这种 300px+ 高度卡片。

## 九、P1：设置页/管理员页边界

涉及文件：

- `frontend-src/src/pages/Settings.tsx`
- `frontend-src/src/pages/AdminDashboard.tsx`

### 普通用户

普通用户不应该看到模型 API、数据库路径、Prompt 流程校验。

### 管理员

管理员页面可以保留更技术化信息，但仍要整理：

- 模型池状态
- API Key 配置
- 用户数
- 活跃任务
- 最近错误
- 服务状态

`Settings` 的 subtitle 可以保留，但要短：

```text
服务端模型、视觉模型与安全配置。
```

不要写“API Key 只保存在后端配置中...”这种长句。

## 十、P2：视觉规范

### 间距

- 页面外边距：桌面 `32px`，窄屏 `24px`。
- 卡片内边距：普通 `20px`，密集列表 `14px`。
- 区块 gap：`20px`，不要动辄 `32px/48px`。

### 圆角

- 普通卡片：`rounded-lg` 或 `rounded-xl`。
- 不要大面积 `rounded-2xl/3xl`。
- 工具型界面不是 landing page。

### 文字

- 页面标题：24px / 700。
- 区块标题：16px / 700。
- 表单 label：12px / 700。
- 正文：14px。
- 说明文字：12-13px，且只在需要时出现。

### 色彩

- 主色可以继续用 `--accent`。
- Primary button 必须白字。
- 列表选中态不要整块高饱和紫，建议：

```css
background: color-mix(in srgb, var(--accent) 10%, transparent);
border-color: color-mix(in srgb, var(--accent) 35%, var(--border-subtle));
```

如果不用 `color-mix`，用低透明：

```tsx
bg-[var(--accent)]/10 border-[var(--accent)]/35
```

注意 Tailwind 对 CSS 变量透明度支持要实际验证。

## 十一、禁止修改范围

为了避免今天上线前把功能链路弄坏，下面内容不允许动：

- `useTudouBridge` 的命令映射，除非只是删除旧页面入口且确认无调用。
- 后端 `src-server` 业务逻辑。
- 23 原始提示词归档。
- 八步工作流命令。
- 资产扫描命令。
- 视觉工坊英文 AIPROMPT 生成命令。
- 逐镜 / 故事版 / Seedance 的数据来源逻辑。
- 登录、管理员鉴权。

本轮只改 UI 结构和展示。

## 十二、执行顺序

### 第一轮：1-2 小时，必须完成

1. 改 `ContextStatusBar`，修复顶部遮挡。
2. 改 `ModuleHeader`，默认隐藏 subtitle。
3. 改 `ActionButton` 和 CSS，修复 primary 亮色文字。
4. 快速过一遍 `/longform`、`/workflow`、`/projects`，确认第一屏正常。

### 第二轮：2-3 小时，核心观感

1. 重做 `ProjectsPage` 项目列表。
2. 清理普通用户侧栏入口，隐藏 `/video` 旧页和 `/flow-map`。
3. 清理每个页面头部副标题。
4. 清理重复顶部按钮。

### 第三轮：3-4 小时，主流程页面

1. 长故事页减法。
2. 工作流页底部操作固定。
3. 资产页和视觉工坊页删除开发说明。
4. 故事版/逐镜/Seedance 页统一按钮和空状态。

### 第四轮：验收

必须逐页截图验收：

- `/`
- `/longform`
- `/workflow`
- `/projects`
- `/scripts`
- `/assets`
- `/visual-prompts`
- `/storyboard`
- `/frame-prompt`
- `/seedance`
- `/admin` 管理员账号
- `/settings` 管理员账号

每页验收标准：

- 顶部没有被遮挡。
- 第一屏没有大段解释。
- 主按钮可读。
- 主要操作不用滚动才能找到。
- 亮色模式和暗色模式都能看。
- 没有重复入口。
- 普通用户看不到开发校验页。

## 十三、给前端执行者的最终口径

这不是重新设计品牌，也不是大改功能。你只需要把当前应用从“开发调试页”整理成“工作台软件”：

- 顶栏占位，不遮内容。
- 页面头只保留标题和操作。
- 说明文字移走。
- 卡片变密。
- 按钮可读。
- 项目库像项目队列。
- 普通用户不看内部 prompt / command / manifest 说明。

所有业务流保持原样。
