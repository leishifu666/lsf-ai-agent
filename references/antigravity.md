# Antigravity CLI

本机运行 `agy models` 核对当前账号可用型号。每次委派用完整的 High 型号 ID 锁定档位。

| 用途 | 型号 ID |
|---|---|
| 复杂编程方案、架构、技术方向与疑难工程分析 | `gemini-4-neon-high` |
| 日常文案、改写与文案评审 | `gemini-4-hydrogen-high` |
| 复杂编程的首个额度兜底 | `gemini-4-argon-high` |

## 直接调用

直接调用本机 PATH 上已登录的 `agy`。文本委派用 `--mode plan`，并在提示中明确只回传建议。PowerShell 示例通过 UTF-8 标准输入传提示，保留中文、引号和多行内容。

```powershell
$agyMessage = @{event = 'user'; message = @{content = $prompt}} | ConvertTo-Json -Compress
$agyArgs = @('--model', $model, '--mode', 'plan', '--input-format', 'stream-json', '--output-format', 'stream-json', '--disable-slash-commands')
$result = & {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $agyMessage | & agy @agyArgs | Where-Object { $_ -match '^\{\s*"event"\s*:\s*"result"' } | ConvertFrom-Json
}
$exitCode = $LASTEXITCODE
$result = $result.result
```

需要用文件或截图时按本轮已授权范围提供材料。按 CLI 的 [会话参数](https://antigravity.google/docs/cli/reference/#command-line-flags)及 [AI credits 设置](https://antigravity.google/docs/cli/reference/#configuration-keys-settingsjson)保持本轮使用套餐额度，若当前会话配置允许超额扣费，用本机 `agy --help` 显示的 `--settings` 会话参数覆盖 `useG1Credits: false`。数据格式见 [官方 stdin JSON 流说明](https://antigravity.google/docs/cli/headless/#stream-prompts-from-stdin)。

退出码为 0、终态 `SUCCESS` 且 `response` 有正文才交付。遇到错误时同时看退出码、终态、错误消息和生成是否已结束。保留最终回答与必要的错误摘要，不读取或转发思考过程。

## 额度用尽时

- 文案和文案评审使用 **CLI Hydrogen / High → AI Studio Hydrogen / High**。AI Studio 的目录 ID 为 `gemini-4-hydrogen`。
- 复杂编程使用 **CLI Neon / High → CLI Argon / High → AI Studio Neon / High → AI Studio Argon / High → CLI Hydrogen / High**。工作流每次切换前先核对当前型号结果与下一个型号的可用性。
- 只有型号额度用尽或确认该型号不可用时继续尝试。AI Studio 界面明确只接受额外付费时，将该选项视为当前不可用。登录、验证码、取消、内容拒绝或超时状态不明时走相应恢复流程。切换时只携带本轮所需材料，记录实际使用的渠道和型号。

AI Studio 操作见 [文本型号和 High 回读](aistudio.md#模型与思考)。只修改技能时用 `agy models` 和 `agy --model <ID> -p /model` 核对本地配置。
