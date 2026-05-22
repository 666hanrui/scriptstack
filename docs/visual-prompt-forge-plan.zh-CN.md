# ScriptStack 视觉提示词工坊完整方案

更新时间：2026-05-18

## 1. 目标

本方案定义 ScriptStack 后续新增的「视觉提示词工坊」模块。

它的目标不是直接接入 OpenAI、Gemini、ComfyUI 或任何官方生图/生视频 API，也不是在应用内生成图片或视频。

它的目标是：

> 将剧本、资产矩阵、分镜、故事版和逐镜结构，转换成可直接复制到网页 AI 工具中的高质量图片提示词与视频提示词。

用户最终拿到的是一组可复制文本：

- 角色三视图提示词
- 角色定妆照提示词
- 角色表情表提示词
- 角色动作姿态表提示词
- 场景概念图提示词
- 道具设定图提示词
- 海报/封面提示词
- 分镜关键帧提示词
- 故事版 storyboard 提示词
- 视频生成提示词
- 视频首帧/尾帧提示词
- 镜头运动提示词
- Seedance / 可灵 / 即梦 / Gemini / ChatGPT 网页可用的复制版提示词

## 2. 明确不做的事情

第一版不做以下内容：

- 不调用 OpenAI 官方 API。
- 不调用 Google Gemini 官方 API。
- 不调用 ComfyUI。
- 不调用 Midjourney、即梦、可灵、Runway、Pika 或其他服务。
- 不在本地生成图片。
- 不在本地生成视频。
- 不保存实际生成出来的图片或视频。
- 不做模型计费。
- 不做生成队列。
- 不做失败重试。
- 不做接口适配。

第一版只做：

- 模板库导入。
- 资产字段整理。
- 提示词生成。
- 提示词套用。
- 提示词编辑。
- 提示词复制。
- 提示词保存。
- 提示词批量导出。

## 3. 核心定位

模块名称建议：

```text
视觉提示词工坊
```

英文内部名建议：

```text
Visual Prompt Forge
```

这个名称比「图片生成」更准确。

因为本模块的职责是：

```text
把剧本资产和分镜结构翻译成专业视觉提示词，让用户复制到任意网页 AI 工具中使用。
```

## 4. 与现有流程的关系

当前 ScriptStack 的正本流程是：

```text
灵感输入
→ 23 个原始提示词正本流程
→ 剧本工作流
→ 资产矩阵
→ 图像提示词 / 视频提示词 / 逐镜提示词
→ Seedance / 视频链路
```

视觉提示词工坊不能替代 23 个原始提示词流程。

它应该位于资产矩阵和分镜链路之后：

```text
剧本
→ 资产矩阵
  → 角色资产
  → 场景资产
  → 道具资产
→ 逐镜提示词 / 故事版分镜
→ 视觉提示词工坊
  → 图片提示词
  → 视频提示词
  → 批量复制
```

## 5. awesome-gpt-image-2 的角色

目标仓库：

```text
https://github.com/YouMind-OpenLab/awesome-gpt-image-2
```

该仓库本质是一个大型 prompt gallery，不是模型服务。

它对我们有三类价值：

1. 作为高质量视觉 prompt 模板库。
2. 作为分类和风格参考体系。
3. 作为动态参数 prompt 的范例来源。

它不应该被当成：

- 生图后端。
- 远程 API。
- 必须在线访问的服务。
- 我们应用的运行依赖。

## 6. 版权和归因

awesome-gpt-image-2 当前声明为 CC BY 4.0。

因此可以复制、改编、商用，但必须做归因。

导入模板时必须保存：

- sourceRepo
- sourceUrl
- sourceLicense
- author
- originalSourceUrl
- importedAt
- sourceCommit

在 UI 中需要显示：

```text
模板来源：YouMind-OpenLab/awesome-gpt-image-2
许可证：CC BY 4.0
作者：xxx
原始来源：xxx
```

复制导出 Markdown 时，也需要在文末追加 attribution。

## 7. 产品结构

新增一级页面：

```text
/visual-prompts
```

建议页面中文名：

```text
视觉提示词工坊
```

页面内部拆成 5 个工作区：

```text
1. 项目资产树
2. 模板库
3. 提示词生成器
4. 故事版 / 分镜视频提示词
5. 提示词库与批量导出
```

### 7.1 项目资产树

左侧展示当前项目内可用于生成提示词的内容。

结构示例：

```text
当前项目
  角色
    男主
      三视图
      定妆照
      表情表
      动作姿态表
      海报主视觉
    反派
      三视图
      定妆照
  场景
    小镇纸嫁衣铺
      场景概念图
      广角环境图
      室内空间图
    河边灵堂
      场景概念图
  道具
    纸嫁衣
      道具设定图
      材质细节图
    半成品纸人
      道具设定图
  分镜
    Scene 01
      关键帧图片提示词
      视频提示词
      首帧/尾帧提示词
    Scene 02
      关键帧图片提示词
      视频提示词
```

### 7.2 模板库

模板库包含两类模板：

1. 内置业务模板。
2. 从 awesome-gpt-image-2 导入的外部模板。

模板分类建议：

```text
角色设计
  角色三视图
  角色定妆照
  表情九宫格
  动作姿态表
  角色设定卡
  角色关系图

场景设计
  场景概念图
  广角环境图
  室内空间设定
  氛围图
  地图 / 平面图

道具设计
  道具设定图
  材质细节图
  爆炸图
  使用状态图
  电商主图

故事版分镜
  故事版四格
  故事版九宫格
  镜头关键帧
  镜头运动说明图
  首帧/尾帧对照图

视频提示词
  单镜头视频
  连续镜头视频
  镜头运动
  转场提示词
  Seedance 风格提示词
  可灵/即梦网页提示词

宣传物料
  海报
  封面
  社媒图
  字体排版图
```

### 7.3 提示词生成器

右侧主工作区负责生成最终提示词。

输入来源：

- 当前选中的角色。
- 当前选中的场景。
- 当前选中的道具。
- 当前选中的镜头。
- 当前选中的故事版分镜。
- 当前选中的模板。

输出形式：

- 中文提示词。
- 英文提示词。
- 中英双语提示词。
- JSON 结构提示词。
- ChatGPT 网页版提示词。
- Gemini 网页版提示词。
- Midjourney 风格提示词。
- 即梦/可灵/Seedance 风格提示词。

第一版先支持中文、英文、JSON 三种。

## 8. 资产提示词类型

### 8.1 角色资产提示词

每个角色至少支持以下提示词：

```text
角色三视图
角色定妆照
角色表情表
角色动作姿态表
角色服装细节图
角色道具绑定图
角色海报主视觉
角色关系图
```

角色字段建议标准化为：

```json
{
  "name": "男主",
  "age": "三十岁左右",
  "gender": "男性",
  "identity": "回乡奔丧的城里男人",
  "bodyType": "消瘦疲惫",
  "face": "长期失眠，眼神阴郁",
  "hair": "凌乱短发",
  "costume": "旧夹克，深色长裤",
  "signatureProp": "纸嫁衣",
  "colorPalette": "灰白，暗红，纸黄",
  "emotion": "不信鬼神但逐渐崩溃",
  "visualKeywords": ["中式恐怖", "乡镇", "纸扎", "阴湿"]
}
```

角色三视图提示词必须强调：

- 正面、侧面、背面。
- 同一人物。
- 五官一致。
- 服装一致。
- 发型一致。
- 干净背景。
- 角色设定图风格。
- 不要水印。
- 不要额外文字，除非用户需要标注。

### 8.2 场景资产提示词

每个场景至少支持：

```text
场景概念图
广角环境图
室内空间图
氛围图
场景平面图
场景色彩板
场景入口镜头图
场景危险点示意图
```

场景字段建议标准化为：

```json
{
  "name": "小镇纸嫁衣铺",
  "type": "乡镇老店",
  "time": "头七前夜",
  "weather": "阴雨",
  "lighting": "昏黄灯泡和冷色月光",
  "visualElements": ["纸人", "纸嫁衣", "香灰", "老木柜", "红纸"],
  "mood": "潮湿，压抑，民俗恐怖",
  "colorPalette": "暗红，纸黄，灰黑",
  "camera": "广角，低机位，轻微畸变"
}
```

### 8.3 道具资产提示词

每个道具至少支持：

```text
道具设定图
材质细节图
爆炸图
手持使用图
陈列展示图
旧化版本图
道具功能说明图
```

道具字段建议标准化为：

```json
{
  "name": "纸嫁衣",
  "material": "扎纸，红纸，金箔，细竹篾",
  "condition": "半烧毁，边缘发黑",
  "symbol": "逝者婚嫁仪式",
  "scale": "真人大小",
  "details": ["纸面褶皱", "暗红花纹", "烧焦边缘", "手工糊纸痕迹"],
  "mood": "阴森，民俗，禁忌"
}
```

## 9. 分镜与视频提示词类型

用户特别强调：后续还要做分镜，以故事版分镜形式帮助用户直接生成视频。

因此视觉提示词工坊必须同时支持视频提示词。

### 9.1 分镜图片提示词

每个镜头应能生成：

```text
关键帧图片提示词
首帧图片提示词
尾帧图片提示词
故事版单格提示词
故事版四格提示词
故事版九宫格提示词
镜头连续性提示词
```

镜头字段建议标准化：

```json
{
  "sceneId": "scene_01",
  "shotId": "shot_01_03",
  "shotTitle": "男人推开纸嫁衣铺的门",
  "location": "小镇纸嫁衣铺门口",
  "time": "夜晚",
  "characters": ["男主"],
  "props": ["纸嫁衣", "纸人"],
  "action": "男主推门进入，门缝里露出挂满纸嫁衣的暗室",
  "emotion": "迟疑，压抑，不安",
  "camera": "低机位缓慢推入",
  "composition": "门框形成前景遮挡，人物位于画面左三分之一",
  "lighting": "门内昏黄，门外冷蓝雨夜",
  "continuity": "角色服装和纸嫁衣形态必须与前后镜头一致"
}
```

### 9.2 视频生成提示词

每个镜头应能生成：

```text
单镜头视频提示词
首帧到尾帧视频提示词
镜头运动提示词
动作连续性提示词
情绪变化提示词
转场提示词
平台适配提示词
```

视频提示词字段：

```json
{
  "duration": "5 seconds",
  "aspectRatio": "16:9",
  "cameraMovement": "slow dolly-in",
  "subjectAction": "the man slowly pushes the old wooden door open",
  "environmentMotion": "rain drips from the eaves, paper talismans tremble in the wind",
  "transitionIn": "cut from black",
  "transitionOut": "hold on the hanging paper wedding dress",
  "style": "cinematic Chinese folk horror, realistic, low saturation",
  "negative": "no watermark, no subtitles, no text overlay, no extra characters"
}
```

### 9.3 故事版 storyboard 提示词

故事版提示词不是视频提示词，而是帮助用户先生成一张可视化分镜板。

支持三种输出：

```text
四格故事版
六格故事版
九宫格故事版
```

故事版 prompt 必须包含：

- 每格镜头编号。
- 每格画面描述。
- 每格构图。
- 每格角色动作。
- 每格镜头运动标注。
- 每格情绪。
- 每格画幅一致。
- 黑白线稿版或电影概念彩图版。

示例结构：

```text
Create a 6-panel cinematic storyboard sheet for a Chinese folk horror short film.
Use clean black-and-white storyboard line art.
Each panel must include a small shot number label.
Panel 1: ...
Panel 2: ...
Panel 3: ...
Keep the same protagonist design across all panels.
No watermark. No extra text except shot numbers.
```

### 9.4 平台适配版本

同一镜头可以导出不同平台版本：

```text
通用视频提示词
ChatGPT 网页版视频/图像提示词
Gemini / Nano Banana 网页版提示词
即梦提示词
可灵提示词
Seedance 提示词
Midjourney 风格提示词
ComfyUI 正向/反向 prompt
```

第一版只需要：

```text
通用中文版
通用英文版
Seedance 风格版
故事版 storyboard 版
```

## 10. 模板系统设计

模板分为两类：

```text
system_template
external_template
```

### 10.1 system_template

我们自己写的模板，强绑定 ScriptStack 业务。

示例：

```text
character_turnaround
character_expression_sheet
scene_concept_art
prop_design_sheet
shot_keyframe
shot_video_prompt
storyboard_6_panel
seedance_shot_prompt
```

### 10.2 external_template

从 awesome-gpt-image-2 导入的模板。

外部模板要保留原文，不直接改写。

当用户套用到项目资产时，生成一个派生版本：

```text
originalTemplate
→ resolvedTemplate
→ finalPrompt
```

## 11. Raycast 参数解析

awesome-gpt-image-2 中有类似：

```text
{argument name="city name" default="成都"}
```

需要解析成：

```json
{
  "key": "city name",
  "label": "city name",
  "default": "成都",
  "type": "text"
}
```

UI 应自动生成表单。

如果字段能从资产中推断，就自动填入。

例如：

```text
city name ← scene.location
character name ← character.name
product name ← prop.name
background color ← project.colorPalette
```

不能推断的字段，让用户手填。

## 12. 数据库建议

新增表：

```sql
CREATE TABLE IF NOT EXISTS visual_prompt_templates (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_repo TEXT,
  source_url TEXT,
  source_license TEXT,
  source_commit TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  style_tags_json TEXT,
  subject_tags_json TEXT,
  language TEXT,
  prompt_text TEXT NOT NULL,
  arguments_json TEXT,
  preview_images_json TEXT,
  author TEXT,
  original_source_url TEXT,
  published_at TEXT,
  imported_at TEXT NOT NULL
);
```

```sql
CREATE TABLE IF NOT EXISTS visual_prompt_outputs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  script_task_id TEXT,
  asset_id TEXT,
  shot_id TEXT,
  output_type TEXT NOT NULL,
  template_id TEXT,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_language TEXT,
  platform_preset TEXT,
  params_json TEXT,
  attribution_json TEXT,
  version INTEGER DEFAULT 1,
  favorite INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE IF NOT EXISTS visual_prompt_batches (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  script_task_id TEXT,
  batch_type TEXT NOT NULL,
  output_ids_json TEXT,
  created_at TEXT NOT NULL
);
```

## 13. 后端命令建议

新增 Tauri commands：

```text
visual/import-awesome-gpt-image-templates
visual/list-templates
visual/get-template
visual/search-templates
visual/generate-asset-prompt
visual/generate-shot-prompt
visual/generate-storyboard-prompt
visual/generate-video-prompt
visual/save-output
visual/list-outputs
visual/update-output
visual/delete-output
visual/export-markdown
```

第一阶段可以先实现：

```text
visual/list-templates
visual/generate-asset-prompt
visual/generate-shot-prompt
visual/save-output
visual/list-outputs
visual/export-markdown
```

导入器可以先做脚本，不必做成 UI 按钮。

## 14. 前端页面建议

新增页面：

```text
frontend-src/src/pages/VisualPromptForge.tsx
```

新增组件：

```text
frontend-src/src/components/visual/AssetPromptTree.tsx
frontend-src/src/components/visual/TemplateGallery.tsx
frontend-src/src/components/visual/TemplateArgumentForm.tsx
frontend-src/src/components/visual/PromptOutputPanel.tsx
frontend-src/src/components/visual/PromptCopyToolbar.tsx
frontend-src/src/components/visual/StoryboardPromptPanel.tsx
frontend-src/src/components/visual/BatchPromptExporter.tsx
```

路由：

```text
/visual-prompts
```

导航：

```text
视觉提示词
```

## 15. 页面布局

建议三栏布局：

```text
左：项目资产树
中：模板库 / 类型选择
右：最终提示词
```

左栏：

- 当前项目。
- 角色。
- 场景。
- 道具。
- 分镜。

中栏：

- 提示词类型。
- 模板筛选。
- 参数表单。
- 平台预设。

右栏：

- 最终提示词。
- 复制按钮。
- 保存按钮。
- 批量导出按钮。
- attribution。

## 16. 复制格式

每条输出至少支持：

```text
复制提示词
复制英文版
复制 JSON
复制 Markdown
保存到项目
```

批量导出 Markdown 示例：

```markdown
# 项目视觉提示词包

## 角色：男主

### 三视图

```text
...
```

### 定妆照

```text
...
```

## 场景：小镇纸嫁衣铺

...

## 分镜：Scene 01 / Shot 03

### 关键帧

...

### 视频提示词

...

## Attribution

部分模板来源：YouMind-OpenLab/awesome-gpt-image-2，CC BY 4.0。
```

## 17. 第一版内置模板清单

第一版必须先写死一批业务模板，不要完全依赖外部模板。

### 17.1 角色模板

```text
character_turnaround_3_view
character_portrait_costume
character_expression_sheet_9
character_action_pose_sheet
character_poster_main_visual
```

### 17.2 场景模板

```text
scene_concept_wide_shot
scene_interior_design
scene_mood_board
scene_map_top_down
scene_horror_atmosphere
```

### 17.3 道具模板

```text
prop_design_sheet
prop_material_detail
prop_exploded_view
prop_in_hand_usage
prop_product_display
```

### 17.4 分镜图片模板

```text
shot_keyframe_image
shot_first_frame
shot_last_frame
shot_before_after_frame
shot_continuity_frame
```

### 17.5 故事版模板

```text
storyboard_4_panel
storyboard_6_panel
storyboard_9_panel
storyboard_black_white_lineart
storyboard_cinematic_color
```

### 17.6 视频提示词模板

```text
video_single_shot
video_first_to_last_frame
video_camera_movement
video_seedance_style
video_jimeng_kling_style
video_transition
```

## 18. 和现有页面的入口关系

### 18.1 资产矩阵 AssetsForge

每个角色卡增加：

```text
生成三视图提示词
生成定妆照提示词
生成表情表提示词
```

每个场景卡增加：

```text
生成场景概念图提示词
生成环境图提示词
```

每个道具卡增加：

```text
生成道具设定图提示词
生成材质细节图提示词
```

点击后跳转：

```text
/visual-prompts?assetId=xxx&type=character_turnaround_3_view
```

### 18.2 图像提示词 PromptLab(image)

每个生成结果段落旁边增加：

```text
发送到视觉提示词工坊
```

### 18.3 逐镜提示词 FramePromptLab

每个 scene / shot 增加：

```text
关键帧提示词
故事版提示词
视频提示词
```

点击后跳转：

```text
/visual-prompts?shotId=xxx&type=video_single_shot
```

### 18.4 Seedance 页面

Seedance 页面不直接改。

只加一个入口：

```text
复制 Seedance 风格提示词
```

## 19. 实施阶段

### 阶段 1：基础文档与内置模板

目标：

- 先不接 awesome-gpt-image-2。
- 先建立我们自己的业务模板体系。
- 让角色、场景、道具、分镜都能生成提示词。

任务：

1. 新建 `visual_prompt_outputs` 表。
2. 新建内置模板常量文件。
3. 新建 `/visual-prompts` 页面。
4. 从当前项目读取资产。
5. 从当前项目读取分镜。
6. 生成角色/场景/道具/镜头提示词。
7. 支持复制和保存。

验收：

- 一个项目里任意角色可以生成三视图提示词。
- 任意场景可以生成概念图提示词。
- 任意道具可以生成设定图提示词。
- 任意镜头可以生成关键帧和视频提示词。
- 不需要任何 API key。

### 阶段 2：awesome-gpt-image-2 模板导入

目标：

- 把外部 prompt gallery 作为模板库接进来。

任务：

1. 写 README 解析脚本。
2. 解析 title、description、prompt、images、author、source、published、language。
3. 解析 Raycast arguments。
4. 写入 `visual_prompt_templates`。
5. 做模板库搜索和筛选。
6. UI 显示 CC BY 4.0 attribution。

验收：

- 本地能看到导入模板。
- 可按类别筛选。
- 可搜索关键词。
- 可复制原始模板。
- 可套用到角色/场景/道具/镜头。

### 阶段 3：故事版和视频提示词增强

目标：

- 补齐用户后续直接生成视频需要的提示词。

任务：

1. 故事版四格/六格/九宫格模板。
2. 单镜头视频模板。
3. 首帧/尾帧模板。
4. 镜头运动模板。
5. Seedance 风格模板。
6. 批量生成所有镜头提示词。

验收：

- 可以为一个 scene 生成故事版六格提示词。
- 可以为一个 shot 生成视频提示词。
- 可以为所有 shot 批量生成 Markdown。

### 阶段 4：批量导出

目标：

- 让用户一次拿走整个项目的视觉提示词包。

任务：

1. 批量选择角色/场景/道具/镜头。
2. 批量生成提示词。
3. 批量保存。
4. 导出 Markdown。
5. 导出 JSON。

验收：

- 一个完整项目可以导出：
  - 角色视觉提示词包。
  - 场景视觉提示词包。
  - 道具视觉提示词包。
  - 故事版分镜提示词包。
  - 视频提示词包。

### 阶段 5：质量打磨

目标：

- 提高可用性和长期沉淀。

任务：

1. 提示词收藏。
2. 版本历史。
3. 用户备注。
4. 复制历史。
5. 平台效果备注。
6. 中英自动转换策略。

验收：

- 用户能看到同一资产的多个提示词版本。
- 用户能标记哪个版本适合 ChatGPT，哪个适合 Gemini，哪个适合即梦/可灵。

## 20. 开发注意事项

1. 不要把这个模块命名成图片生成。
2. 不要在第一版接任何生图 API。
3. 不要要求用户配置模型。
4. 不要依赖外网运行。
5. awesome-gpt-image-2 只作为可导入数据源。
6. 外部模板必须保留 attribution。
7. 内置业务模板必须优先服务 ScriptStack 的剧本资产和分镜。
8. 分镜视频提示词和图片资产提示词同等重要。
9. 每条提示词都必须可以一键复制。
10. 批量导出必须是核心功能，不是附加功能。

## 21. 推荐优先级

最高优先级：

```text
角色三视图
场景概念图
道具设定图
镜头关键帧
单镜头视频提示词
故事版六格
批量 Markdown 导出
```

第二优先级：

```text
awesome-gpt-image-2 导入
模板搜索
Raycast 参数表单
平台适配复制
```

第三优先级：

```text
版本管理
收藏
备注
复制历史
多语言翻译
```

## 22. 最终验收标准

一个完整项目完成后，用户应该能做到：

1. 打开视觉提示词工坊。
2. 看到项目里的角色、场景、道具、分镜。
3. 点一个角色，生成三视图提示词。
4. 点一个场景，生成概念图提示词。
5. 点一个道具，生成设定图提示词。
6. 点一个镜头，生成关键帧提示词。
7. 点一个镜头，生成视频提示词。
8. 点一个 scene，生成故事版六格提示词。
9. 一键复制任意提示词。
10. 一键导出整个项目的 Markdown 提示词包。
11. 全程不需要配置模型 API。
12. 全程不实际生成图片或视频。

## 23. 参考资料

- YouMind-OpenLab/awesome-gpt-image-2: https://github.com/YouMind-OpenLab/awesome-gpt-image-2
- awesome-gpt-image-2 License: https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/LICENSE
- OpenAI Image Generation docs: https://platform.openai.com/docs/guides/images/image-generation
- Google Nano Banana image generation docs: https://ai.google.dev/gemini-api/docs/image-generation
- ComfyUI docs: https://docs.comfy.org/index

