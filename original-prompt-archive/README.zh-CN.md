# 原始提示词归档说明

这个目录是从本机 Git 历史中恢复出的“可证明来源”的原始提示词档案。

## 先看这个目录

逐字逐句比对请只看：

`raw-original/`

这个目录里的文件是直接从 Git 对应提交取出的原始字节，已经做过 SHA256 校验。

不要用下面这个目录做逐字比对：

`readable-decoded-NOT_FOR_BYTE_COMPARE/`

它只是把部分原始文件里的字面量 `\n` 转成真实换行，方便人眼阅读。它不是原始字节。

## 来源边界

- 主原始来源：`5a04543`，提交信息是 `feat: initial commit — CineForge 创剧 Tauri 2 desktop app`，日期是 2026-05-14。
- `slug_image_prompt_generation.txt`、`slug_video_prompt_generation.txt`、`slug_prompt_review.txt` 在 `5a04543` 里不存在；它们在本机 Git 历史中首次出现于 `70c118d`，日期是 2026-05-15。
- 本次归档只使用本地仓库、Git 历史、本地 debug prompt 路径和本机浅层搜索中能合法访问的内容。没有对任何未授权服务器做抓取或提取。
- 如果之后拿到合法导出的远端提示词 dump，必须单独建来源目录，并生成独立 SHA256，不要混进 `raw-original/`。

## 分类和使用阶段

| 分类目录 | 文件 | 使用阶段 | 运行时 key | 来源 |
|---|---|---|---|---|
| `01_workflow_screenplay_steps` | `step1.txt` | 剧本工作流 Step 1，破题 / 概念生成 | `screenplay_step stepNumber=1` | `5a04543` |
| `01_workflow_screenplay_steps` | `step2.txt` | 剧本工作流 Step 2，人物 | `screenplay_step stepNumber=2` | `5a04543` |
| `01_workflow_screenplay_steps` | `step3.txt` | 剧本工作流 Step 3，世界观 | `screenplay_step stepNumber=3` | `5a04543` |
| `01_workflow_screenplay_steps` | `step4.txt` | 剧本工作流 Step 4，大纲 | `screenplay_step stepNumber=4` | `5a04543` |
| `01_workflow_screenplay_steps` | `step5.txt` | 剧本工作流 Step 5，分场 | `screenplay_step stepNumber=5` | `5a04543` |
| `01_workflow_screenplay_steps` | `step6.txt` | 剧本工作流 Step 6，对白 | `screenplay_step stepNumber=6` | `5a04543` |
| `01_workflow_screenplay_steps` | `step7.txt` | 剧本工作流 Step 7，成稿 | `screenplay_step stepNumber=7` | `5a04543` |
| `01_workflow_screenplay_steps` | `step8.txt` | 剧本工作流 Step 8，医生 / 收束 | `screenplay_step stepNumber=8` | `5a04543` |
| `02_workflow_support` | `selfcheck.txt` | 工作流单步自检 | `screenplay_selfcheck` | `5a04543` |
| `02_workflow_support` | `checkpoint.txt` | Step 6 后 checkpoint 压缩 | `screenplay_checkpoint` | `5a04543` |
| `03_script_tasks` | `slug_script_planning.txt` | 独立剧本任务，剧本规划 | `promptSlug=script_planning` | `5a04543` |
| `03_script_tasks` | `slug_script_writing.txt` | 独立剧本任务，剧本写作 | `promptSlug=script_writing` | `5a04543` |
| `03_script_tasks` | `slug_script_review.txt` | 独立剧本任务，剧本审核 | `promptSlug=script_review` | `5a04543` |
| `04_asset_extraction` | `slug_asset_character.txt` | 资产矩阵，角色提取 | `promptSlug=asset_character` | `5a04543` |
| `04_asset_extraction` | `slug_asset_scene.txt` | 资产矩阵，场景提取 | `promptSlug=asset_scene` | `5a04543` |
| `04_asset_extraction` | `slug_asset_prop.txt` | 资产矩阵，道具提取 | `promptSlug=asset_prop` | `5a04543` |
| `05_prompt_generation` | `slug_prompt_segment_planning.txt` | PromptLab，分镜大纲规划 | `promptSlug=prompt_segment_planning` | `5a04543` |
| `05_prompt_generation` | `slug_prompt_seedance_scene.txt` | PromptLab，逐镜提示词生成 | `promptSlug=prompt_seedance_scene` | `5a04543` |
| `06_seedance_v5` | `ctx_seedance_phase_ad.txt` | Seedance V5，Phase A-D 分析 | `contextType=seedance_phase_ad` | `5a04543` |
| `06_seedance_v5` | `ctx_seedance_unit_efg.txt` | Seedance V5，Unit E-F-G 生成 | `contextType=seedance_unit_efg` | `5a04543` |
| `07_v3_added_independent_image_video` | `slug_image_prompt_generation.txt` | V3 首次出现，独立图像提示词生成 | `promptSlug=image_prompt_generation` | `70c118d` |
| `07_v3_added_independent_image_video` | `slug_video_prompt_generation.txt` | V3 首次出现，独立视频提示词生成 | `promptSlug=video_prompt_generation` | `70c118d` |
| `07_v3_added_independent_image_video` | `slug_prompt_review.txt` | V3 首次出现，图像/视频提示词审核 | `promptSlug=prompt_review` | `70c118d` |

## 已完成的校验

`manifest.json` 中每个文件都有：

- `sourceCommit`
- `sourcePath`
- `archivePath`
- `byteSize`
- `lineCount`
- `sha256`
- `exactBytesFromGit`
- `hasLiteralEscapedNewlines`

校验结果：23 / 23 个提示词文件和 Git 原始字节一致。

## 路由参考

`source-code-routing-reference/` 里放的是原始代码路由快照，不是提示词正文。

重点看：

- `5a04543-prompts.rs`
- `5a04543-server_proxy.rs`
- `5a04543-prompt_generation.rs`
- `5a04543-asset_extraction.rs`
- `5a04543-seedance_service.rs`
- `70c118d-prompt_tasks.rs`

这些文件用于证明每个提示词在原始系统中具体由哪个 `contextType` 或 `promptSlug` 调用。
