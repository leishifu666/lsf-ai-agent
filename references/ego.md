# Ego Lite 公共操作

先读取当前已安装的 `ego-browser/SKILL.md`，执行 `ego-browser skill` 并读完指南，使用其公开 API。本仓库不包含 Ego Lite 或浏览器登录资料；未安装时使用用户中转，或用户明确选择的宿主浏览器工具。

- 同一目标只建立一个 TaskSpace，记录数值 spaceId；后续恢复同一空间和页面。不同模型可用空间中的不同页面，不打开用户其他历史会话。
- 每条 CLI 是新 Node 进程，变量与模块确认状态不跨进程保留，页面可保留。每轮写新的 UTF-8 `.mjs`，不重跑含发送动作的旧脚本。
- 按当前指南使用 Page 的原生点击、输入、键盘和状态等待；`evaluate` 仅检查可见 DOM，不读隐藏接口、令牌或网络内部状态，不用 DOM 赋值和合成事件替代原生操作。
- 同轮完成展开菜单、读取选项、选择与等待回读。翻译或框架更新可能产生短暂空标签；不把空值立即判失败，也不在缺少回读时宣称成功。
- 新截图/快照后使用当前 ref；可访问标签缺失时先看截图，再选择可用定位方式。
- 保留人的草稿，填入自己的提示后比较全文再发送。短时不见结果先查本轮身份与 Stop 状态，不重复 Enter。
- 登录、验证码或用户接管时交还控制，停止浏览器操作；可继续独立的本地工作。
- 整个目标完成后按指南结束一次任务空间；等待用户或仍需操作时不提前结束。

页面辅助模块示意（在宿主已提供 `taskSpace` 的执行环境中；ID 与安装路径由当前环境决定）：

```javascript
import {pathToFileURL} from 'node:url';

const space = await taskSpace(currentSpaceId);
const page = space.page('p1');
const {createAIStudioBrowser} = await import(pathToFileURL(
  `${skillRoot}/scripts/aistudio_browser.mjs`
).href);
const studio = createAIStudioBrowser(page, {task: 'copywriting'});
await studio.selectModel('gemini-3.1-pro-preview');
await studio.selectSetting('Thinking Level', 'High');
```

使用其他宿主浏览器时读取其自己的工具文档，不套用 Ego 的 TaskSpace、Page 或 CLI。这里的页面辅助模块只适用于其所需 Page 接口，不保证兼容其他浏览器工具。
