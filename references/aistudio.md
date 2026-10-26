# Google AI Studio

入口：<https://aistudio.google.com/prompts/new_chat>。以下选择器来自本技能原有界面适配，使用时先核对实际页面；账号、额度和型号可用性由使用者当前环境决定。

## 模型与思考

点击 `button.model-selector-card`，在 `input[placeholder="Search for a model or agent"]` 搜索精确 ID，选择目录项并回读模型标签。

| 用途 | 配置的目录 ID | 思考 |
|---|---|---|
| 设计、文案 | `gemini-3.1-pro-preview` | High |
| 明确选择的快速文案、普通问答 | `gemini-3.8-flash` | High |
| 图片 | `gemini-nano-banana-2.1` | High |
| 明确选择 Gemini 的复杂任务 | `gemini-4-argon` | 按实际界面核对；不替代默认 DeepSeek 工程路由 |

目录项示例：`[id="model-carousel-row-models/gemini-3.1-pro-preview"]`。没有指定目录项时不选择近似名字或自动降级。

展开 `role=combobox`、名称 `Thinking Level`，读取可见 `mat-option`，选择 High 并等待回读。辅助脚本支持已记录的“高/高的”等翻译标签，不据此猜测未知选项。

## 工具

工具开关按可见名称定位，使用 `aria-checked` 回读。需要当前资料时检查 `Grounding with Google Search`，最终核对本轮实际来源引用；开关打开不等于已完成检索。

`Grounding with Google Maps`、`Browse the url context`、`Code execution`、`Structured outputs`、`Function calling`、`Image search` 只按具体任务与实际权限使用，不因页面可见就默认启用。切模型后重新检查工具。

## 图片

`createAIStudioBrowser(page,{task:'image'})` 的 `configureImage` 接收 `resolution`、`aspectRatio` 和 `thinking`；例如 `{resolution:'2K',aspectRatio:'16:9',thinking:'High'}`。

- 精确型号：`gemini-nano-banana-2.1`。
- `Resolution`：仅 2K / 4K，不接受 1K。
- `Aspect ratio`：明确选择脚本允许的比例，不使用 Auto。
- 最终像素随比例变化；分辨率选项和最终文件都要核对，预览图不能当原图。

## 提交、完成与保存

- 输入框：`textarea[aria-label="Enter a prompt"]`；原生输入后比较全文。Run 只点一次，生成中观察 Stop。
- 最终内容：`ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model`，正文 `ms-cmark-node.cmark-node`。排除思考活动容器。
- 提交前记录回答数量与 turn ID；虚拟列表数量可能不增长，优先比较新回答身份。新正文/最终图片、`.turn-footer`、Stop 消失和 Run 可用共同确认完成。错误容器和提前恢复的 Run 不算成功。
- `send()` 返回本轮提交身份，`waitForResult(submission)` 检查新回答与完成状态。
- 图片读取本轮最终 `img.loaded-image`，检查 `naturalWidth/naturalHeight/complete`，排除小图标与预览。
- 优先使用图片上的 Download 或 View full image。点击下载不等于文件已保存。
- 若当前浏览器文档允许，可保存最终图片 DOM 已展示的 `currentSrc` 资源；不得拼内部接口或提取凭据。Ego 的 `page.fetch(observedSrc,{saveAs: absolutePath})` 仅在其当前指南明确支持时使用。
- 保存后检查文件存在、MIME、扩展名、真实像素和画面；失败如实说明。

本仓库离线测试不证明真实账号、联网、附件上传、多图编辑或上游生成已通过。
