# 剧本栈 V4 前端重构架构蓝图

> 结论：第一阶段必须先做 A：全局基建。先统一状态、路由守卫、上下文条和全局错误，再重构具体页面。

---

## 1. 核心状态隔离与持久化策略 Zustand V4

过去最大的痛点是状态混乱。V4 的状态机必须将 Workflow 阶段 Project 和后期阶段 Task 彻底解耦，并引入全局错误寄存器。

```ts
interface AppState {
  // 1. 核心业务 ID：持久化白名单
  currentProjectId: string | null;  // 仅在 /workflow 阶段有效
  currentTaskId: string | null;     // 在 /scripts 及之后所有阶段通用
  scriptSeed: string;               // 灵感种子
  currentStep: number;              // 仅针对 workflow

  // 2. 全局环境与 UI：持久化
  language: 'zh' | 'en';
  theme: 'dark' | 'light';

  // 3. 全局错误寄存器：瞬态，不持久化
  globalError: {
    title: string;
    details: string;
    action: string;
    suggestion: string;
  } | null;
  setGlobalError: (error: AppState['globalError']) => void;
  clearError: () => void;

  // 4. Stale 状态清洗函数
  validateAndCleanIds: (backendExists: boolean, type: 'project' | 'task') => void;
}
```

### 防迷航设计

`validateAndCleanIds` 在页面加载时静默校验 ID。

如果 `currentProjectId` 在后端已失效：

```text
自动置空 currentProjectId
保留 currentTaskId
引导用户去 /projects 恢复
绝不白屏或崩溃
```

如果 `currentTaskId` 在后端已失效：

```text
自动置空 currentTaskId
提示用户去 /scripts 或 ScriptTaskSelector 重新选择
```

---

## 2. 路由矩阵与防卫边界 Routing & Guards

必须抛弃随便乱跳的路由逻辑。V4 引入严格的 `RouteGuard` 组件。

### 路由规则

```text
/                灵感枢纽：任何状态可进，生成后强制写 currentProjectId
/workflow        工作流：无 currentProjectId 则拦截，提示从项目库恢复或新建项目
/projects        项目库：全局控制台，上帝视角，负责分发入口
/scripts         剧本任务：统一枢纽，可承接 workflow finalize，也可直接导入/生成
/assets          后期页：依赖 currentTaskId，无 task 时显示选择任务引导
/image           后期页：依赖 currentTaskId，无 task 时显示选择任务引导
/video           后期页：依赖 currentTaskId，无 task 时显示选择任务引导
/seedance        后期页：依赖 currentTaskId，无 task 时显示选择任务引导
/frame-prompt    逐镜页：依赖 currentTaskId，无 task 时显示选择任务引导
```

### RouteGuard 行为

```text
project-required：只检查 currentProjectId
script-task-required：只检查 currentTaskId
none：不拦截
```

守卫不能直接跳空白页，必须显示全屏引导卡：

```text
当前缺少什么 ID
为什么不能进入
去项目库
去剧本页
打开任务选择器
返回灵感枢纽
```

---

## 3. 全局布局解构 The Spatial Layout

`MainLayout.tsx` 拆分为三大刚性区域。

### 3.1 左侧 GlobalSidebar

显示主导航：

```text
灵感枢纽
项目库
工作流
剧本
资产
图像
视频
逐镜
Seedance
设置
```

每个导航项需要：

```text
图标
中文名称
当前激活状态
不可用时 tooltip 说明原因
```

### 3.2 顶部 ContextStatusBar

顶部必须始终显示：

```text
PID: currentProjectId 或 未绑定
TID: currentTaskId 或 未选择
当前模块名
当前阶段状态
返回项目库按钮
错误指示灯
```

### 3.3 悬浮层 GlobalErrorCard

`GlobalErrorCard` 读取 `useAppStore.globalError`。

展示字段：

```text
错误标题
错误详情
触发 action
建议下一步
复制错误按钮
关闭按钮
```

它替代原先的：

```text
alert
[object Object]
普通 toast
控制台孤立错误
```

---

## 4. 核心组件拆分计划

### 4.1 ProjectRecoveryConsole

重构 `/projects`。

不再是简单列表，而是恢复控制台。

每个项目卡片根据阶段自动点亮：

```text
工作流
剧本
资产
图像
视频
Seedance
```

灰置按钮必须有 tooltip 说明阻断原因。

### 4.2 ScriptTaskSelector

这是 `/scripts` 之后所有页面共用的核心选择器。

形态可以是：

```text
Modal
Drawer
左侧面板
```

职责：

```text
调用 script/recent
显示 script task 列表
支持搜索
选中后写入 currentTaskId
返回 task + script body
空列表时引导去 /scripts 导入或生成
```

### 4.3 FrameByFramePrompt

新增逐镜分镜工作台，严格独立于旧版 `/image` 和 `/video`。

三段式 UI：

```text
大纲生成区
确认区
逐镜单元流列表
```

禁止和旧独立图像/视频提示词混成一个按钮。

---

## 5. IPC 契约底座强化

`useTudouBridge.ts` 必须拦截所有底层错误并格式化。

```ts
catch (err: any) {
  const structuredError = {
    title: 'IPC 通信断裂',
    action,
    details: err.message || JSON.stringify(err),
    suggestion: '请检查后端引擎是否正常运行，或返回项目库重试。'
  };
  useAppStore.getState().setGlobalError(structuredError);
  throw err;
}
```

页面级仍可继续细粒度处理，但全局错误必须有统一展示。

---

## 6. 第一阶段行动指令

选择：A，全局基建。

第一阶段交付范围：

```text
1. 重写 useAppStore.ts
   - Project 和 Task 解耦
   - language/theme
   - globalError
   - validateAndCleanIds
   - 持久化白名单

2. 重构 MainLayout.tsx
   - GlobalSidebar
   - ContextStatusBar
   - 页面容器区域
   - GlobalErrorCard 挂载

3. 新增组件
   - GlobalSidebar.tsx
   - ContextStatusBar.tsx
   - GlobalErrorCard.tsx
   - RouteGuard.tsx
   - EmptyStateGuide.tsx

4. 强化 useTudouBridge.ts
   - 所有错误结构化写入 globalError
   - 保留 action、backend command、details、suggestion
   - 不改变现有 action 名称和参数包装规则

5. 路由接入 RouteGuard
   - /workflow 使用 project-required
   - /assets /image /video /seedance /frame-prompt 使用 script-task-required
   - / /projects /scripts /settings 不拦截
```

---

## 7. 第一阶段验收标准

必须通过：

```bash
npm run frontend:typecheck
npm run frontend:build
```

如果改动影响 Tauri IPC 入口，再跑：

```bash
cd src-tauri && cargo check
```

功能验收：

```text
1. 无 currentProjectId 进入 /workflow，不白屏，显示恢复引导
2. 无 currentTaskId 进入 /assets，不白屏，显示任务选择引导
3. 所有页面顶部能看到 PID/TID
4. IPC 报错时出现 GlobalErrorCard
5. 点击返回项目库始终可用
6. currentProjectId 失效时能清洗，不影响 currentTaskId
7. currentTaskId 失效时能清洗，并引导去 /scripts
```

---

## 8. 明确禁止事项

前端团队第一阶段不要做：

```text
不要改 src-tauri 后端逻辑
不要改 prompt 原文
不要改 original-prompt-archive
不要改 IPC command 名称
不要动数据库结构
不要把旧独立图像/视频和逐镜链路混在一起
不要把业务功能删除再说后面补
不要只做视觉皮肤而不做状态和错误处理
```

---

## 9. 给前端负责人的最终指令

```text
先做选项 A：全局基建。

不要先重写 /projects，也不要先重写 workflow。因为如果 store、RouteGuard、ContextStatusBar、GlobalErrorCard 没统一，后面所有页面还会继续状态混乱。

第一阶段只交付：
useAppStore.ts
MainLayout.tsx
GlobalSidebar.tsx
ContextStatusBar.tsx
GlobalErrorCard.tsx
RouteGuard.tsx
EmptyStateGuide.tsx
useTudouBridge.ts 错误结构化
路由守卫接入

提交后必须跑：
npm run frontend:typecheck
npm run frontend:build

不要动 Rust 后端。
```
