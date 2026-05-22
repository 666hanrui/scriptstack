# Original Prompt Archive

This folder is the byte-exact archive of the earliest prompt files recoverable from local Git history.

Important boundaries:
- The primary original source is commit `5a04543` (CineForge initial commit, 2026-05-14).
- `slug_image_prompt_generation.txt`, `slug_video_prompt_generation.txt`, and `slug_prompt_review.txt` did not exist in `5a04543`; their first local Git appearance is `70c118d` (2026-05-15), so they are archived from there.
- No unauthorized remote server extraction was performed. If a legally exported remote prompt dump is provided, add it under a separate provenance folder and hash it.
- Files under `raw-original/` are the comparison source. Do byte/sha256 comparison against those files.
- Files under `readable-decoded-NOT_FOR_BYTE_COMPARE/` are only readability copies for prompts that originally stored literal `\n` characters. Do not use that folder for byte comparison.

## Prompt Usage Map

| Category | File | Stage Used | Runtime Key | Source Commit | Bytes | SHA256 | Literal \\n |
|---|---|---|---|---:|---:|---|---|
| 01_workflow_screenplay_steps | step1.txt | Step 1 / 破题 / 概念生成 | screenplay_step stepNumber=1 | 5a04543 | 6979 | 72eec3d18fd25725e1b55369db7fd632a2128ff80dd8b6f74c43614af980ed0c | no |
| 01_workflow_screenplay_steps | step2.txt | Step 2 / 人物 | screenplay_step stepNumber=2 | 5a04543 | 7602 | fffd070e6ae71d667b6c8fefcdce93f5fde9edaee4bf5bb3c2a454f2211590d8 | no |
| 01_workflow_screenplay_steps | step3.txt | Step 3 / 世界观 | screenplay_step stepNumber=3 | 5a04543 | 11287 | c76a96e4d50c98cfda745d0d3acdd8f862b08c2623580b931854d020ba31f7fa | no |
| 01_workflow_screenplay_steps | step4.txt | Step 4 / 大纲 | screenplay_step stepNumber=4 | 5a04543 | 6905 | 79df3a2ac6147d5bc5ccdd5f69c47855a0e1bf18d9e41acb47baa8c5d6b55fee | no |
| 01_workflow_screenplay_steps | step5.txt | Step 5 / 分场 | screenplay_step stepNumber=5 | 5a04543 | 17729 | 3b8e966f50e1bd6232a48f5db1571369a72624b41c0e7c75ac01f95a924e6c7d | no |
| 01_workflow_screenplay_steps | step6.txt | Step 6 / 对白 | screenplay_step stepNumber=6 | 5a04543 | 14754 | 585ca13ade02a877afab79edde841105c3d3c2cbf926d9752819c5ff34a19aad | no |
| 01_workflow_screenplay_steps | step7.txt | Step 7 / 成稿 | screenplay_step stepNumber=7 | 5a04543 | 34157 | 4910b437045f09c03cc00989762c01394d02aa1bedfd411d309be7cc715f7677 | yes |
| 01_workflow_screenplay_steps | step8.txt | Step 8 / 医生收束 | screenplay_step stepNumber=8 | 5a04543 | 15653 | 82c027800fdf612c063e2cea2327f9c8bef707a1008243f9d110f52daf12bd2e | no |
| 02_workflow_support | selfcheck.txt | 工作流单步自检 | screenplay_selfcheck | 5a04543 | 2396 | 960be9431244b22d4afbdbfb048c8e1c83ff0fc0ddbdecbf0b003cb6a3c2bb8c | no |
| 02_workflow_support | checkpoint.txt | Step 6 后 checkpoint 压缩 | screenplay_checkpoint | 5a04543 | 6100 | db45dbc95d3a9a85303571fe87a4d12edab64e7892dab7c4b6eeee39a43b22f1 | no |
| 03_script_tasks | slug_script_planning.txt | 独立剧本任务 / 剧本规划 | promptSlug=script_planning | 5a04543 | 15609 | 138c85ef2a9596aa8c75928d0a9ffa1161f363e4163aa036d34a7461b7e45ada | no |
| 03_script_tasks | slug_script_writing.txt | 独立剧本任务 / 剧本写作 | promptSlug=script_writing | 5a04543 | 9773 | debc3551250ebb92ff7b44aee3cfa21b1c5c238e0476cb0caa5cb2c3438727ab | no |
| 03_script_tasks | slug_script_review.txt | 独立剧本任务 / 剧本审核 | promptSlug=script_review | 5a04543 | 18806 | 9593e35e078279b534555c3aaafe758245d8cf227e40dc564cb3190fdd9f18a6 | yes |
| 04_asset_extraction | slug_asset_character.txt | 资产矩阵 / 角色提取 | promptSlug=asset_character | 5a04543 | 4270 | 6fb35d57fcf7f6ea677068d3b5118ae3f7c3dda5a35c94aa28810238f69b2a8a | yes |
| 04_asset_extraction | slug_asset_scene.txt | 资产矩阵 / 场景提取 | promptSlug=asset_scene | 5a04543 | 4793 | a320a39f87375920b1fa75f55b0987edf8454847b25cb04aea3696450ac1d90f | yes |
| 04_asset_extraction | slug_asset_prop.txt | 资产矩阵 / 道具提取 | promptSlug=asset_prop | 5a04543 | 3859 | 133cf0f36d1e7608ca46160edcd8876ac93dcda24c78c45db2de9182232501ca | yes |
| 05_prompt_generation | slug_prompt_segment_planning.txt | PromptLab / 分镜大纲规划 | promptSlug=prompt_segment_planning | 5a04543 | 2509 | e3c4e65a9c39b6c3c5786f2ace518fcfcd77b01a9e57f9b3f7f0350960da5d15 | no |
| 05_prompt_generation | slug_prompt_seedance_scene.txt | PromptLab / 逐镜提示词生成 | promptSlug=prompt_seedance_scene | 5a04543 | 16615 | 614f39c0db6334765adf1290726ca1b271ba9bd392d019dccd131d3a25ce103a | yes |
| 06_seedance_v5 | ctx_seedance_phase_ad.txt | Seedance V5 / Phase A-D 分析 | contextType=seedance_phase_ad | 5a04543 | 36803 | 96c20861cd49ba0fac5deb1c71837722229395bb93ba4838c8ae7e1a129a135c | no |
| 06_seedance_v5 | ctx_seedance_unit_efg.txt | Seedance V5 / Unit E-F-G 生成 | contextType=seedance_unit_efg | 5a04543 | 92806 | e86f9c0b4c84668c59d7353ae131cf35a8d3f7f7676573b6c9cafd4f95963c55 | yes |
| 07_v3_added_independent_image_video | slug_image_prompt_generation.txt | V3 首次出现 / 独立图像提示词生成 | promptSlug=image_prompt_generation | 70c118d | 1026 | 92cf83575fcc2560673152c496b490f27862e9c4f66cef1fd2e7746452890b39 | no |
| 07_v3_added_independent_image_video | slug_video_prompt_generation.txt | V3 首次出现 / 独立视频提示词生成 | promptSlug=video_prompt_generation | 70c118d | 1016 | 9dd70602dbef3c42e791caeb882352c71b3988d8bd59f39b087cf3d7457f15b4 | no |
| 07_v3_added_independent_image_video | slug_prompt_review.txt | V3 首次出现 / 图像视频提示词审核 | promptSlug=prompt_review | 70c118d | 568 | 9981fcff1b76290f0562af736d19515148c8c7336ef256b4a2be5baadbf53e03 | no |

## Runtime Routing Reference

Source-code snapshots copied into `source-code-routing-reference/` show how these prompts were wired in the original code. The most important one is `5a04543-prompts.rs`, which maps `contextType` and `promptSlug` to prompt files.
