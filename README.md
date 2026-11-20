# LSF-AI 调度 Skill

<p align="center">
  <img src="./assets/lsf-ai-agent-cover.webp" alt="LSF-AI调度 Skill：视觉设计、文案写作、前端开发、根因分析、图像生成与结果验证" width="540">
</p>

平时写项目，我会把活分给趁手的模型。重构前先让 Gemini 4 Neon 过一遍方案，写前端和改 bug 找 DeepSeek，做代码视频或强动效就去 Hark 找 Claude Opus 5.5。这个技能把这些用法记下来，省得每次都手动换渠道、再解释一遍项目。

把这个技能装到支持 [SKILL.md](SKILL.md) 的编程助手里，直接说要做什么。助手会整理本轮用得上的材料，发给对应的模型，再把结果带回原项目验证。

## 平时怎么分工

| 任务 | 渠道 | 模型与设置 |
|---|---|---|
| 文案、文档与评审 | Antigravity CLI（默认）<br>Hark（点名 Claude） | Gemini 4 Hydrogen / High，额度用完切 AI Studio Hydrogen / High<br>Claude Opus 5.5 |
| 前端实现、常规编码和修复 | DeepSeek（默认）<br>Codex CLI（点名 GPT） | DeepSeek 开启深度思考和智能搜索<br>GPT-6.2 Sol / 极高 `xhigh`，也负责疑难问题的排查与跟进 |
| 复杂编程方案 | Antigravity CLI | Gemini 4 Neon / High，[额度用尽时按顺序切换](references/antigravity.md#额度用尽时) |
| 复杂架构设计、技术方案权衡和 3D 建模方案 | Codex CLI（点名 GPT） | GPT-6.2 Astra / 极高 `xhigh` |
| 批量抽取字段、分类和固定格式整理 | Codex CLI（默认） | GPT-6 Luna / 低 `low` |
| 代码视频和强动效 | Hark | Claude Opus 5.5，[新项目优先，普通聊天兜底](references/hark.md) |
| 前端审美与视觉设计 | AI Studio 或 Hark | Gemini 3.1 Pro / High 或 Claude Opus 5.5 |
| 生图和图片编辑 | AI Studio | Nano Banana 2.1，支持 2K / 4K 和指定比例 |
| 指定的设计或综合分析 | Kimi 或智谱 | Kimi K3 或 GLM-5.3，均用极致档 |

点名 Claude 做设计或代码也走 Hark。同一任务改稿沿用原项目。 [Codex CLI 调用方式](references/codex-cli.md)

## 环境准备

先装好默认浏览器流程需要的 Ego Lite 和 `ego-browser`。其他工具按用途准备。

| 安装要求 | 工具或账号 | 什么时候需要 | 官方入口 |
|---|---|---|---|
| **必装** | Ego Lite | 让助手操作 AI Studio、Hark 等网页 | [下载 Ego Lite](https://lite.ego.app/download) · [Windows 安装指南](https://lite.ego.app/document/en/docs/windows/quick-start) |
| **必装** | `ego-browser` 技能 | 随 Ego Lite 首次设置安装。完成后重开助手，确认能选到 `ego-browser` | [启用浏览器技能](https://lite.ego.app/document/en/docs/skills#load-the-browser-skill) |
| **推荐选装** | Antigravity CLI（`agy`） | 账号支持推荐模型时，优先用 CLI 做文案、评审和复杂编程。装好后运行 `agy` 登录 | [CLI 官方安装步骤](https://antigravity.google/docs/getting-started?tab=cli#download-and-install) |
| 按需安装 | Codex CLI（`codex`） | 选择 GPT 渠道或使用 Luna 整理数据时需要。安装后运行 `codex login`，用 `codex login status` 核对登录 | [Codex CLI 官方文档](https://learn.chatgpt.com/docs/codex/cli) |
| 按需账号 | Google AI Pro / Ultra | 使用推荐的 CLI Gemini 4 模型时，个人账号建议用正式付费的 Pro 或 Ultra。用 `agy models` 确认可用型号 | [Google AI 会员方案](https://one.google.com/about/google-ai-plans/) · [CLI 模型权限](https://antigravity.google/docs/models) |
| 按需安装 | Git | 用下方的 `git clone` 安装技能时需要 | [下载 Git](https://git-scm.com/downloads/) |
| 按需安装 | Node.js 18+ | 运行本地 JavaScript 脚本或测试，脚本只用 Node.js 内置模块 | [下载 Node.js](https://nodejs.org/en/download) |
| 按需安装 | Python 3.10+ | 使用可选的贞贞 API 或运行 Python 测试 | [下载 Python](https://www.python.org/downloads/) |

没有 Pro / Ultra 的个人账号可以先跳过 CLI，按任务直接指定 [AI Studio](https://aistudio.google.com/prompts/new_chat) 或 [Hark](https://hark.com/projects/new)，需要时在网页里登录。

## 安装与使用

想一次装齐，可以把这句话发给编程助手。

```text
帮我从 https://github.com/leishifu666/lsf-ai-agent 安装这个技能，再按 README 的官方下载链接一次装齐 Git、Ego Lite、ego-browser、Antigravity CLI、Node.js 和 Python。已装的跳过，需要登录时叫我。
```

把仓库克隆到助手的技能目录，保留仓库内的文件结构。

```powershell
git clone https://github.com/leishifu666/lsf-ai-agent.git "$HOME/.agents/skills/lsf-ai-agent"
```

Codex 也可以放在 `$HOME/.codex/skills/lsf-ai-agent`。本地如果已经改过旧版本，先克隆到别的目录对比，别直接覆盖。装好后刷新技能或新开对话，就可以这样用。

```text
使用 $lsf-ai-agent，让 Gemini 4 Neon 给出当前项目的重构方案。
使用 $lsf-ai-agent，让 Codex CLI 用 Sol 排查这次回归，用 Astra 给出复杂架构方案。
使用 $lsf-ai-agent，这次我复制粘贴中转，请给我一份完整的 Gemini 交接提示。
使用 $lsf-ai-agent，在 AI Studio 生成 16:9、2K 的图片。
```

### 贞贞 API（可选）

只在你明确要求走贞贞 API 时启用。需自备账号和密钥。Windows 可以在仓库根目录运行以下命令，输入时密钥会隐藏。

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
