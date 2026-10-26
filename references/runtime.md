# 贞贞 API 调用契约

## 依赖与凭据

Python 3.10+，脚本只用标准库。接口固定为 `https://ai.t8star.org/v1`，不通过环境变量替换到其他站点。只允许 `/models` 和 `/chat/completions`，认证使用 `Authorization: Bearer`；阻止 HTTP 重定向，保留 TLS 证书验证。

密钥读取顺序：当前进程的 `T8STAR_API_KEY` → Windows 凭据管理器 `LSF-Gemini-Agent:T8Star`。使用者需自行配置凭据；不生成明文密钥文件、全局环境变量或项目配置。其他平台用进程环境变量，不回退明文存储。

设置/检查入口：

```powershell
python -B -X utf8 scripts/credential_store.py --set
python -B -X utf8 scripts/credential_store.py --status
```

设置通过 `getpass` 的隐藏输入；不在 shell 命令、argv、提示文件或回复里写密钥。脚本错误不回传原始服务商响应、Authorization、内部推理或请求详情。当前密钥出现在输入或回答里时拒绝发送/输出。

代理优先沿用进程已有代理变量；没有时读取已启用的 Windows 系统代理，仅构造该客户端的代理处理器，不修改系统设置。代理、地区、账号权限与额度由使用者当前环境决定；本仓库不包含代理地址或账号配置。

## 输入、输出与边界

`route --task` 是纯本地路由。`doctor [--task design]` 使用 GET `/models`，检查精确模型 ID；不接受 `thinking-*` 通配记录代替具体 high 型号。模型列表通过不代表生成渠道可用。

`ask` 接收 `--prompt-file` 或 stdin 文本，允许重复 `--file` 和 `--image`：

- UTF-8 文本与提示总量上限 2 MiB。文件必须在原项目目录内，解析软链接后的路径也不得越界；敏感配置、凭据、缓存和二进制不能当作文本发送。
- 图片总量上限 12 MiB，必须在原项目内，为 PNG/JPEG/WebP；读取文件头后嵌入图像字节。需另保存的本次截图应放在明确的项目临时截图路径，用完清理，不默认纳入 Git。
- `--timeout` 默认 300 秒，为网络连接/读取超时；不是上游任务取消保证。`--preflight-timeout` 默认 30 秒。任何失败均不自动重发。
- `--max-tokens` 默认 16384，可按任务调整到 1～65536。它限制生成长度，可能包括思考 token；截断不视为完整结果，不自动提高上限重发。
- 请求不设置低温度，不提供命令、文件操作或函数工具。Gemini 返回回答/补丁，Codex 负责已授权工程操作。

成功 JSON 含 `ok/task/provider/model/effort/observed_model/model_verification/conversation_id/response/usage/elapsed_seconds`。`model_verification=provider_reported`，只证明服务商回传同一型号。API 通常不回显有效思考参数，不能声称已独立验证上游的实际 high；脚本发 high 并使用经过联调的 high 模型 ID。

`ok=false` 或非零退出不能当作完整交付。`finish_reason` 必须为 `stop`，空回答、截断、过滤、工具请求、换型号或缺少型号均失败。响应只保留正文与数值用量；不返回内部推理或原始提供商元数据。

## 常驻 worker

```powershell
python -B -X utf8 scripts/gemini_agent.py worker --task frontend --cwd '项目绝对路径'
```

通过宿主可写 session 保持进程。等待 `ready`，按顺序每行发一条 JSON：

```json
{"id":"layout-1","prompt":"按已确认方向检查弹窗，返回必要补丁","files":["components/example.tsx"],"images":["screenshots/desktop.png"]}
{"id":"layout-2","prompt":"继续上一版，只修正手机按钮与标题对齐"}
{"op":"close"}
```

每轮先返回 `started`，再返回含请求 id 的 `result`。前一轮结束后再提交下一轮。task、模型、思考、接口和项目固定，不接受请求 JSON 覆盖。

复用指同一进程保存 `system/user/assistant` 历史并随下一轮请求发送，不是服务端持久会话或跨进程自动续聊。UUID 是本地会话标签，不能用它恢复已经关闭的会话。历史只在内存，最多 32 MiB；超限不自动压缩、截断或删除，提供已确认摘要另开会话。失败清理该会话，不能重发不确定是否已执行的轮次。

## 使用与验证边界

上面的命令均从技能根目录执行；`--cwd` 应指向实际原项目目录。`route` 不联网、不读取凭据，可用于检查配置：

```powershell
python -B -X utf8 scripts/gemini_agent.py route --task design
python -B -X utf8 -m unittest discover -s scripts/tests -v
```

本仓库不提供密钥、账号权限、余额或登录态。API 路由中的型号是固定配置；`doctor` 仅验证使用者当前密钥能否看到指定精确型号，不保证实际生成可用。不支持时如实返回错误，不自动降低型号。

离线测试覆盖路由、型号响应、思考参数、内存会话、凭据保护、文件边界、图片附件、代理与重定向；不证明上游模型身份、实际计费、浏览器登录或真实生成。需要在线验证时，由使用者明确选择 API 并使用自己的账号。

维护接口前核对当前服务商契约与官方文档，不根据模型名字推断支持情况：

- [贞贞作者节点仓库](https://github.com/T8mars/Comfyui-zhenzhen)
- [服务商接口入口](https://ai.t8star.org/api-set)
- [Google OpenAI 兼容文档](https://ai.google.dev/gemini-api/docs/openai)
