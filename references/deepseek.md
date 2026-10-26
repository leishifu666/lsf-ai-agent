# DeepSeek

入口：<https://chat.deepseek.com/>。本技能预设**深度思考与智能搜索同时开启**。具体模型版本以当前页面为准；没有独立版本选择器时记录“当前网页模型＋深度思考＋智能搜索”，不声称已选某个 V/R 型号。

- 输入框：`textarea[name="search"]`。
- 既有模式控件为 `DIV[aria-pressed]`；使用 `[aria-pressed]:has-text("深度思考")` 和 `[aria-pressed]:has-text("智能搜索")`，原生点击后确认两者为 true。页面变化时重新定位。
- `createDeepSeekBrowser(page).configure()` 打开必要开关并校验；`send()` 再检查双开关和提示全文，不静默降低配置。
- 原生输入、Enter 发送；不覆盖人的草稿，每轮只提交一次。
- 最终答案：`.ds-assistant-message-main-content`；不读取 `.ds-think-content` 的内部推理正文。
- 答案附近的完成操作区与非空正文共同判断完成。优先比较最近的 `[data-virtual-list-item-key]` 身份，不能只看虚拟列表数量增长。
- `send()` 返回提交身份，`waitForResult(submission)` 等待新身份和完成区。
- 联网任务检查实际来源引用；普通超链接不证明发生检索。

登录、限流、网络与工具故障按真实原因记录，不自动重发、切产品或付费。无法核实检索时说明本轮未证实检索。选择器适配与离线测试不等于真实网页当前可用。
