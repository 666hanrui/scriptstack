# 远端服务器提示词状态

本次没有把任何未授权服务器里的内容抓取到本地。

已经检查过的本地来源：

- 当前仓库的 `src-tauri/src/llm/prompts/`
- Git 全历史中的提示词文件
- Git 全历史中的提示词路由代码
- 本项目本地 `data/debug-prompts`
- 本机浅层搜索到的 prompt archive / prompt dump 类目录

结果：

- 没有发现合法导出的远端服务器提示词 dump。
- 没有发现 `data/debug-prompts` 里已有真实模型调用审计文件。
- 当前归档里的“原始提示词”均来自本地 Git 可证明来源。

如果之后要加入远端服务器来源，必须满足：

1. 提供合法授权或合法导出的文件。
2. 单独放到 `remote-authorized-export/` 之类的新目录。
3. 每个文件记录来源、导出时间、原始文件名、SHA256。
4. 不要覆盖 `raw-original/`，否则会污染 Git 原始版。
