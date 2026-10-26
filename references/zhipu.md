# 智谱清言

入口：<https://chatglm.cn/>。本技能预设 GLM-5.3 / 极致。下面是原有页面适配提示，具体菜单与权限每次重新检查。

## 模型与思考

- 从 `.think-mode-trigger` 展开 `.think-mode-list > .think-mode-item`，读取可选型号后选择 GLM-5.3；不把隐藏菜单文字当当前选择。
- 思考菜单原有 `.has-submenu`、`.think-submenu`；若提供快速/深度/极致，选择极致并回读完整触发器文字。
- 同轮完成展开、读取、选择与回读；没有有效结果时不静默改为 GLM-Flash 或降低思考。

## 联网与工具

- 原有工具入口为 `.model-select-icon-container`，展开 `.model-select-list` 后查找“联网模式”。
- `.online-item [role="switch"]` 以 `aria-checked` 回读，原生点击 `.online-item .el-switch__core` 后等待状态生效。以实际 DOM 为准，不猜测当前值。
- 需要当前资料时启用联网并核对实际引用；ON 不等于检索成功。其他工具仅在任务需要且已有授权时使用。

## 输入与回收

- 先检查 `textarea` 中的草稿，原生输入后比较全文。原有发送控件为 `.enter-icon-container`；发送后观察输入框清空，勿重复提交。
- 最终正文范围：`.answer .answer-content-wrap .markdown-body`。`.interact-operate` 出现且 `.answer-loading`、`.enter.searching` 不存在后再检查非空最终正文；不读取内部推理。
- 不同 URL/cid 的回答行可能复用相同 ID。记录提交前 URL/cid、行 ID、提示和完成状态，先比较对话身份，再判断新回答。
- 登录或配置成功不代表生成成功。拒绝正文与普通链接不能当任务完成或联网证据。

没有当前生成证据时只报告已观察到的配置和限制，不把技术故障、拒绝或账号状态混为一谈，不无限重试、付费或自动切产品。
