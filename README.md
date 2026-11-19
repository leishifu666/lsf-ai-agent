# LSF-AI 调度 Skill

<p align="center">
  <img src="./assets/lsf-ai-agent-cover.webp" alt="LSF-AI调度 Skill：视觉设计、文案写作、前端开发、根因分析、图像生成与结果验证" width="540">
</p>

平时写项目，我会把活分给趁手的模型。重构前先让 Gemini 4 Neon 过一遍方案，写前端和改 bug 找 DeepSeek，做代码视频或强动效就去 Hark 找 Claude Opus 5.5。这个技能把这些用法记下来，省得每次都手动换渠道、再解释一遍项目。

把这个技能装到支持 [SKILL.md](SKILL.md) 的编程助手里，直接说要做什么。助手会整理本轮用得上的材料，发给对应的模型，再把结果带回原项目验证。

## 平时怎么分工

- **文案和评审** 用 Antigravity CLI 的 Gemini 4 Hydrogen / High，额度用完切到 AI Studio Hydrogen / High。
- **复杂编程** 先用 CLI 的 Neon / High。遇到额度用尽或型号不可用，依次尝试 CLI Argon、AI Studio Neon、AI Studio Argon、CLI Hydrogen，全程用 High。见 [Antigravity CLI 说明](references/antigravity.md)。
- **前端审美** 用 AI Studio 的 Gemini 3.1 Pro / High，或者 Hark 的 Claude Opus 5.5。
- **常规实现、前端编码和修复** 用 DeepSeek，打开深度思考和智能搜索。
- **代码视频和强动效** 默认走 Hark 的 Claude Opus 5.5。新任务开新项目，改稿留在原项目，确认没提交成功时切普通聊天。点名 Claude 做设计、代码、文案或评审，也走这个入口。见 [Hark 说明](references/hark.md)。
- **生图** 用 AI Studio 的 Nano Banana 2.1，支持 2K / 4K 和指定比例。
- 也可以点名 Kimi K3 或智谱 GLM-5.3，两者都用极致档。

## 安装与使用

把仓库克隆到助手的技能目录，保留仓库内的文件结构。

```powershell
git clone https://github.com/leishifu666/lsf-ai-agent.git "$HOME/.agents/skills/lsf-ai-agent"
```

Codex 也可以放在 `$HOME/.codex/skills/lsf-ai-agent`。本地如果已经改过旧版本，先克隆到别的目录对比，别直接覆盖。装好后刷新技能或新开对话，就可以这样用。

```text
使用 $lsf-ai-agent，让 Gemini 4 Neon 给出当前项目的重构方案。
使用 $lsf-ai-agent，这次我复制粘贴中转，请给我一份完整的 Gemini 交接提示。
使用 $lsf-ai-agent，在 AI Studio 生成 16:9、2K 的图片。
```

## 环境准备

- **Antigravity CLI** 本机装好并登录 `agy`，用 `agy models` 看当前账号能用的档位。
- **浏览器操作** 需要另装 Ego Lite（搭配 `ego-browser` 技能）或使用宿主支持的浏览器工具。页面辅助脚本使用助手已经打开的浏览器。有时只想自己操作页面，也可以让助手准备一份提示词，手动粘贴。
- **JS 脚本** Node.js 18+，只用内置模块，不用 `npm install`。
- **可选贞贞 API** 端点固定为 `https://ai.t8star.org/v1`，基于 Python 3.10+ 标准库，只在你明确要求走 API 时启用。需自备账号和密钥。Windows 可以在仓库根目录运行以下命令，输入时密钥会隐藏。

```powershell
python -B -X utf8 scripts/credential_store.py --set
python -B -X utf8 scripts/credential_store.py --status
```

其他系统在当前进程里设置 `T8STAR_API_KEY` 环境变量，仓库里不存密钥。详情看 [API 契约](references/runtime.md)。

## 本地验证

改了脚本或路由，可以在仓库根目录跑离线检查。

```powershell
node --test scripts/tests/browser_policy.test.mjs scripts/tests/gemini_browser.test.mjs
python -B -X utf8 -m unittest discover -s scripts/tests -v
python -B -X utf8 scripts/gemini_agent.py route --task design
```

## 许可证

[MIT](LICENSE)。外部网站、浏览器工具和模型服务各自遵循它们自己的使用条款。
