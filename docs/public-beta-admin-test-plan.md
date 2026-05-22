# ScriptStack 公测前管理员与全流程测试说明

更新时间：2026-05-21

## 1. 当前管理员账号

本机服务端配置文件已经写入管理员账号：

- 账号 / 用户名：`zhia2805769@gmail.com`
- 邮箱：`zhia2805769@gmail.com`
- 密码：已按你本轮指定的管理员密码写入 `/Users/hanrui/rerust/src-server/.env`

为了避免以后误把密码提交到仓库或发给别人，本文档不再明文重复密码。实际生效位置是：

```env
SCRIPTSTACK_ADMIN_USERNAME=zhia2805769@gmail.com
SCRIPTSTACK_ADMIN_PASSWORD=<你本轮指定的管理员密码>
SCRIPTSTACK_ADMIN_EMAIL=zhia2805769@gmail.com
```

服务端每次启动时都会读取这三项。如果用户名已存在，会把这个账号强制更新为 `admin` 角色，并用 `.env` 里的密码覆盖旧密码。因此修改管理员密码的正确方式是：

1. 修改 `/Users/hanrui/rerust/src-server/.env` 里的 `SCRIPTSTACK_ADMIN_PASSWORD`
2. 重启服务端
3. 用新密码登录

不要把真实 `.env` 上传到服务器之外的公开仓库、截图或聊天窗口里。

## 2. 当前系统结构理解

我对现在项目的理解如下：

ScriptStack 现在已经从“纯本地 Tauri 后端”迁移成“前端壳 + 服务端核心”的公测架构。

- 前端：`/Users/hanrui/rerust/frontend-src`
  - React / Vite / Framer Motion / Zustand
  - Tauri 桌面端现在主要是外壳
  - 普通用户只看到产品页面，不应该看到提示词、API Key、服务端内部配置

- 服务端：`/Users/hanrui/rerust/src-server`
  - Axum HTTP 服务
  - SQLite 初期数据库
  - JWT 认证
  - `/api/auth/*` 负责登录注册刷新
  - `/api/invoke` 是统一 RPC 网关，承接原来的 Tauri invoke 命令
  - `/api/stream` 承接剧本生成、自检、重生成等 SSE 流式任务
  - 原始提示词、LLM 调用、业务流程都应留在服务端

- Tauri：`/Users/hanrui/rerust/src-tauri`
  - 未来应保持薄壳，只保留本机文件选择等少量能力
  - 不应再承载核心提示词和业务秘密

- 原始 23 个提示词：
  - 仍是剧本正本流程的核心契约
  - 审计命令 `npm run audit:canonical-flow` 必须长期保持通过
  - 后续 UI、视觉提示词、故事版、Seedance 都不能破坏这条正本流程

- 资产与视觉提示词：
  - `/assets` 里的角色、场景、道具仍以中文资产为创作源
  - 英文 AIPROMPT 是派生产物，用于生图、生视频、Seedance 等消费链路
  - 用户审阅时应看到中文镜像或中文说明，不应被迫直接编辑英文模板

## 3. 本轮已经完成的关键改动

### 3.1 服务端管理员能力

涉及文件：

- `/Users/hanrui/rerust/src-server/src/config.rs`
- `/Users/hanrui/rerust/src-server/src/db/schema.rs`
- `/Users/hanrui/rerust/src-server/src/auth/jwt.rs`
- `/Users/hanrui/rerust/src-server/src/auth/middleware.rs`
- `/Users/hanrui/rerust/src-server/src/routes/auth.rs`
- `/Users/hanrui/rerust/src-server/src/routes/invoke.rs`
- `/Users/hanrui/rerust/src-server/src/main.rs`
- `/Users/hanrui/rerust/src-server/.env.example`

完成内容：

- 新增 `SCRIPTSTACK_ADMIN_USERNAME / PASSWORD / EMAIL`
- 服务端启动时自动创建或更新管理员账号
- `users` 表新增：
  - `role`
  - `last_login_at`
  - `last_seen_at`
- JWT claims 新增 `role`
- `AuthUser` 新增：
  - `role`
  - `is_admin`
- 每次认证请求都会刷新 `last_seen_at`
- `admin_summary` 新增服务端运营概览
- 以下命令已改为管理员权限：
  - `get_app_settings`
  - `save_app_settings`
  - `get_database_meta`
  - `test_connection`
  - `admin_summary`

### 3.2 前端管理员入口

涉及文件：

- `/Users/hanrui/rerust/frontend-src/src/App.tsx`
- `/Users/hanrui/rerust/frontend-src/src/pages/AdminDashboard.tsx`
- `/Users/hanrui/rerust/frontend-src/src/components/router/RouteGuard.tsx`
- `/Users/hanrui/rerust/frontend-src/src/components/layout/GlobalSidebar.tsx`
- `/Users/hanrui/rerust/frontend-src/src/components/layout/ContextStatusBar.tsx`
- `/Users/hanrui/rerust/frontend-src/src/pages/Settings.tsx`
- `/Users/hanrui/rerust/frontend-src/src/types/tudou.d.ts`
- `/Users/hanrui/rerust/frontend-src/src/constants.ts`

完成内容：

- 新增 `/admin` 管理员后台
- `/settings` 改为管理员权限页面
- 普通用户侧栏不显示“管理员后台”和“模型/API”
- 普通用户即使手动输入 `#/admin` 或 `#/settings`，也会看到“需要管理员权限”
- 设置页文案从“本地配置”改为“服务端管理员配置”
- 管理员后台展示：
  - 用户总数
  - 管理员数量
  - 15 分钟活跃用户
  - 24 小时活跃用户
  - 最近用户
  - 剧本项目 / 项目 / 任务 / 资产 / 视觉提示词 / Seedance 单元数量
  - 文本模型、视觉模型、API Key 配置状态
  - 服务端监听地址、数据库路径、上传目录

### 3.3 API 配置安全边界

现在的安全边界是：

- 普通用户不能读取 API Key
- 普通用户不能测试 API 连接
- 普通用户不能修改模型配置
- 管理员能在 `/settings` 修改服务端配置
- 管理员后台只显示 mask 后的 Key，例如 `sk-••••xxxx`
- 如果服务端通过环境变量配置 Key，后台会显示 env 配置状态
- 如果服务端通过数据库配置 Key，后台会显示 DB 配置状态

这符合公测目标：用户拿到的是产品壳和功能体验，不拿到提示词与 API 密钥。

## 4. 一会儿你应该怎么测试

建议按下面顺序测试，不要跳着测。

### 4.1 启动服务端

终端 1：

```bash
cd /Users/hanrui/rerust/src-server
cargo run -p scriptstack-server
```

启动后先确认没有这些错误：

- 端口占用
- 数据库迁移失败
- JWT secret 为空
- `.env` 没读到

如果 3000 端口被占用，先查：

```bash
lsof -iTCP:3000 -sTCP:LISTEN
```

### 4.2 启动前端 / Tauri

终端 2：

```bash
cd /Users/hanrui/rerust
npm run tauri dev
```

正常情况：

- Vite 在 `127.0.0.1:5173` 起
- Tauri 窗口打开
- 前端业务请求走 `http://127.0.0.1:3000`

### 4.3 管理员登录测试

在登录弹窗中输入：

- 用户名：`zhia2805769@gmail.com`
- 密码：使用 `/Users/hanrui/rerust/src-server/.env` 里的 `SCRIPTSTACK_ADMIN_PASSWORD`

登录成功后检查：

- 左侧侧栏应该出现“管理员后台”入口
- 左侧侧栏应该出现“模型/API”入口
- 进入 `#/admin` 应能看到管理面板
- 进入 `#/settings` 应能看到模型配置页

管理员后台重点看：

- 用户总数是否正常
- 15 分钟活跃用户是否至少包含当前管理员
- 文本模型配置是否显示 endpoint/model/key 状态
- 服务端数据库路径是否是 `src-server/data/scriptstack.db`

### 4.4 普通用户权限测试

退出登录后，注册一个普通测试用户，例如：

- 用户名：`normal_test_001`
- 密码：随便设一个测试密码

普通用户登录后检查：

- 左侧侧栏不应该出现“管理员后台”
- 左侧侧栏不应该出现“模型/API”
- 手动访问 `#/admin` 应显示“需要管理员权限”
- 手动访问 `#/settings` 应显示“需要管理员权限”

这一步非常重要，它验证公测用户拿不到 API 配置入口。

### 4.5 后端权限接口测试

如果你愿意用命令测，可以先用管理员登录拿 token，再访问：

```bash
curl -X POST http://127.0.0.1:3000/api/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <管理员 token>" \
  -d '{"cmd":"admin_summary","args":{}}'
```

管理员应该返回 summary。

普通用户 token 访问同一接口应该返回：

```json
{"error":"Admin privileges required"}
```

HTTP 状态码应该是 `403`。

### 4.6 模型/API 配置测试

用管理员进入 `#/settings`。

检查这些点：

- 供应商选择 DeepSeek / OpenAI / Claude / Gemini / OpenRouter / 通义时，endpoint 会自动填
- 用户不需要手填主流服务商的网址
- Access Key 只在管理员页面填写
- 保存后返回管理员后台，Key 状态应显示“已配置”
- 普通用户无法看到这个页面

注意：

当前是单主 API 配置，不是 Key 池。

公测初期可以接受；后续如果同时很多用户使用，应该升级：

- API Key 池
- 并发队列
- 每用户限流
- 失败重试
- 熔断与冷却
- 管理员后台查看错误率和 token 消耗

### 4.7 正本 23 提示词流程回归

在根目录跑：

```bash
cd /Users/hanrui/rerust
npm run audit:canonical-flow
```

必须看到：

```text
canonical flow audit passed: 23/23
```

然后在软件里测：

1. 新建工作流
2. 输入种子
3. 进入 8 步工作流
4. 生成第 1 步
5. 切到第 2 步再切回第 1 步
6. 刷新或重启软件后再进入同一个项目

重点观察：

- 不再出现 `Command 'screenplay_generate_step' not found`
- 已生成步骤不能丢
- 回到旧步骤不能空白
- 顶部种子与项目绑定正确
- SSE 流式输出正常

### 4.8 资产矩阵测试

工作流至少跑到能生成剧本任务后，进入资产矩阵：

1. 打开 `/assets`
2. 点击资产提取
3. 检查角色、场景、道具是否出现
4. 编辑资产中文描述并保存
5. 刷新页面

重点观察：

- 中文资产描述不能被英文覆盖
- assetId 应稳定
- 参考图和视觉提示词不要因为保存资产而失联

### 4.9 视觉提示词测试

进入 `/visual-prompts`：

1. 选择一个中文角色资产
2. 生成智能视觉提示词
3. 检查英文 AIPROMPT
4. 检查中文镜像

重点观察：

- 英文 AIPROMPT 应尽量纯英文
- 中文镜像给用户审阅
- 中文资产本体不应被改成英文
- 缺少英文标准件时，后续生图/生视频页面要提示先补齐

### 4.10 图像提示词页面测试

进入 `/image`：

1. 查看资产对应英文 AIPROMPT
2. 复制提示词
3. 粘贴到外部生图网页
4. 生成图片后上传回资产图库

重点观察：

- `/image` 是消费英文标准件的位置
- 不应该重新把中文资产粗暴拼进去
- 这里不直接调用官方图像生成 API

### 4.11 故事版 / 逐镜 / Seedance 测试

进入 `/storyboard`、`/frame-prompt`、`/seedance`。

你要重点看这件事：

故事版不能只是“资产说明书”，必须是：

- 每个镜头的剧情动作
- 每个镜头的场景
- 每个镜头的人物状态
- 上一镜到下一镜发生了什么
- 同时挂上角色 / 场景 / 道具资产锚点

也就是说，它应该是“剧情镜头 + 资产锚点”的结合，不是单独堆道具说明。

逐镜链路给用户看的应是中文；生视频最终消费时再使用英文视觉标准件。

## 5. 当前已验证结果

我本轮已经跑过这些检查：

```bash
cargo check -p scriptstack-server
cargo test -p scriptstack-server
npm run frontend:typecheck
npm run frontend:build
npm run audit:canonical-flow
```

结果：

- Rust 服务端编译通过
- 服务端单测通过，4/4
- 前端 TypeScript 通过
- 前端生产构建通过
- 23 个原始提示词契约审计通过，23/23
- 临时管理员运行时测试通过
- 普通用户访问 `admin_summary` 会被 403 拦截

## 6. 目前仍需后续增强的系统级事项

这些不是今天必须阻塞公测的点，但我建议排进后续：

1. API Key 池
   - 当前是单主 Key
   - 公测初期可用
   - 并发上来后要做 Key 池、队列和限流

2. 管理员后台二期
   - 每日活跃用户
   - 总请求量
   - LLM 成功率 / 失败率
   - 平均响应耗时
   - 每个用户的任务数量
   - token 消耗估算

3. 生产安全
   - 生产环境必须更换 `SCRIPTSTACK_JWT_SECRET`
   - 必须使用 HTTPS
   - Nginx 层做 request body size 限制
   - 管理员密码不要复用其他平台密码

4. 数据库升级路径
   - 初期 SQLite 可以
   - 用户量上来后迁移 PostgreSQL
   - `screenplay_projects`、任务表、资产表都已经适合后续迁移

5. 错误观测
   - 服务端增加结构化日志
   - 管理员后台展示最近错误
   - 生成失败能看到是哪一步、哪个模型、哪个用户、哪类错误

## 7. 最短测试清单

如果你只想快速判断这版是否能继续往下测，就按这个最短清单：

1. 启动服务端
2. 启动 Tauri
3. 用管理员账号登录
4. 确认侧栏出现管理员后台
5. 打开 `#/admin`
6. 打开 `#/settings`
7. 退出，注册普通用户
8. 普通用户确认看不到管理员入口
9. 跑一遍工作流第 1 步生成
10. 确认没有 `screenplay_generate_step not found`
11. 跑 `npm run audit:canonical-flow`

如果这 11 项都过，说明现在可以进入下一轮深度产品流程测试。
