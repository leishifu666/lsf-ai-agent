# Codex CLI / GPT

点名 GPT、Astra、Sol、Luna 或 Codex CLI 时，以及处理分配给 Luna 的批量整理任务时，用 PATH 上已有的 `codex`。用 `codex login status` 核对 ChatGPT 登录态。需要重新确认型号时用交互会话的 `/model`，或本机 `codex app-server` 的 `model/list`。型号和档位以本机返回为准。

## 按任务选型号

| 任务 | 型号 ID | 推理档位 |
|---|---|---|
| 常规编码、前端实现、修 Bug、疑难故障的根因排查与跟进 | `gpt-6.2-sol` | 极高 `xhigh` |
| 复杂架构、跨模块设计、技术方案权衡与 3D 建模方案 | `gpt-6.2-astra` | 极高 `xhigh` |
| 批量抽取字段、分类和固定格式整理 | `gpt-6-luna` | 低 `low` |

定架构和 3D 方案用 Astra，后续实施和疑难排查用 Sol。文案和文档的撰写、改写与评审交给 Gemini 或 Claude。Codex 的技术意见可作为文档写作的输入。GPT-6.1 Sol 仅保留为点名时的编码对照选项。

用户点名的已配置型号及其支持的推理档位优先。额度用尽或型号不可用时说明当前状态，保留用户指定的型号和渠道。为 GPT 提供参考图时，可用 `--image <文件>` 传入本轮授权的图片。图像生成沿用主技能的图片渠道。 [Codex 模型指南](https://learn.chatgpt.com/docs/models?surface=cli)

X 上的早期反馈有分歧。Artificial Analysis 在最高推理档的 Codex 编程专项中测得 6.2 Astra 和上一代 Astra 持平，6.2 Sol 比 6.1 Sol 低 3 分。它对 6.2 Astra 的交互式 3D 测试评价较高。Theo 的早测也认可 Astra 的代码审查与 3D 能力，同时报告长任务中出现干扰性追问。这些结果适合指导对照测试，具体仓库仍以本地审查和验证为准。[Artificial Analysis 编程结果](https://x.com/ArtificialAnlys/status/2122750637041693183) · [Artificial Analysis 综合结果](https://x.com/ArtificialAnlys/status/2122750634210529569) · [Theo 早测](https://x.com/theo/status/2122760447103484410)

## 直接调用

由 `taskRoute(task, {provider:'codex'})` 取得 `model` 和 `thinking`。复杂架构选 `architecture`，3D 方案选 `design`，疑难排查选 `complex`，批量抽取、分类与格式整理选 `extraction`。PowerShell 示例假定 `$model`、`$thinking`、`$projectDir`、`$prompt` 已按本轮设置。提示写明要回传的建议、代码或审查结论，以及允许读取的项目文件。当前工作路径用原项目目录。非 Git 目录可在 `$codexArgs` 中的 `'-'` 前加 `--skip-git-repo-check`。

```powershell
$resultFile = New-TemporaryFile
try {
    $codexArgs = @(
        '-a', 'never', '--disable', 'hooks', 'exec',
        '-C', $projectDir, '-m', $model,
        '-c', 'model_provider=openai',
        '-c', "model_reasoning_effort=$thinking",
        '-c', 'web_search=disabled',
        '--sandbox', 'read-only', '--ephemeral', '--json',
        '--output-last-message', $resultFile.FullName, '-'
    )
    & {
        $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
        $prompt | & codex @codexArgs | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Codex CLI 退出码 $LASTEXITCODE"
        }
    }
    $result = Get-Content -LiteralPath $resultFile.FullName -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($result)) {
        throw 'Codex CLI 未返回最终答复'
    }
    $result
} finally {
    Remove-Item -LiteralPath $resultFile.FullName
}
```

需要联网时，将 `web_search=disabled` 换成 `web_search=live`，并将 `Out-Null` 替换为 JSONL 事件筛选，只保留 `item.completed` 中 `item.type` 为 `web_search` 的事件，核对实际检索与最终答复引用的来源。仅传本轮必要内容，回收最终答复。CLI 委派保持只读，写入、测试和交付由主会话按用户授权完成。只修改技能时核对登录、型号目录、命令参数和本地任务路由，等用户要求试用或委派时再提交提示。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) · [CLI 配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)

失败时核对退出码和终端错误。需要查看 JSONL 诊断时，在原调用中用筛选 `error` 或 `turn.failed` 事件代替 `Out-Null`。登录失效、额度用尽、型号或档位不可用时报告具体原因。超时先确认该进程或本轮请求是否结束，再按恢复规则处理，避免重复提交。
