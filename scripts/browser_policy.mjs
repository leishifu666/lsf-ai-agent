/** User-selected task routes and image constraints. No browser or network side effects. */
export const BROWSER_PROVIDERS = Object.freeze({
  aistudio: {url: 'https://aistudio.google.com/prompts/new_chat', enabled: true},
  flow: {url: 'https://flow.google.com/', enabled: true},
  kimi: {url: 'https://www.kimi.com/', enabled: true},
  deepseek: {url: 'https://chat.deepseek.com/', enabled: true},
  zhipu: {url: 'https://chatglm.cn/', enabled: true},
  hark: {
    url: 'https://hark.com/projects/new',
    fallbackUrl: 'https://hark.com/chat',
    enabled: true,
    newProjectPerConversation: true,
  },
  gemini_web: {url: 'https://gemini.google.com/app', enabled: false, reason: '用户已暂时禁用 Gemini 普通网页版；按任务使用 Antigravity CLI 或 AI Studio'},
  midjourney: {url: 'https://www.midjourney.com/', enabled: false, reason: '按用户避免封号的选择，仅准备材料、人工提交，不自动操作账号'},
});
// User-confirmed Hark default; no model selection or identity check required.
export const HARK_MODEL = 'Claude Opus 5.5';
export const ANTIGRAVITY_MODELS = Object.freeze({
  neon: 'gemini-4-neon-high',
  hydrogen: 'gemini-4-hydrogen-high',
  argon: 'gemini-4-argon-high',
});
const ANTIGRAVITY_TASK_MODELS = Object.freeze({
  code: ANTIGRAVITY_MODELS.neon,
  complex: ANTIGRAVITY_MODELS.neon,
  architecture: ANTIGRAVITY_MODELS.neon,
  copywriting: ANTIGRAVITY_MODELS.hydrogen,
  copy_review: ANTIGRAVITY_MODELS.hydrogen,
  document: ANTIGRAVITY_MODELS.hydrogen,
  chat: ANTIGRAVITY_MODELS.hydrogen,
});
const CODEX_MODELS = Object.freeze({
  astra: 'gpt-6.2-astra',
  sol: 'gpt-6.2-sol',
  luna: 'gpt-6-luna',
  previousSol: 'gpt-6.1-sol',
});
const CODEX_TASKS = Object.freeze({
  chat: CODEX_MODELS.sol,
  code: CODEX_MODELS.sol,
  frontend: CODEX_MODELS.sol,
  complex: CODEX_MODELS.sol,
  design: CODEX_MODELS.astra,
  architecture: CODEX_MODELS.astra,
  extraction: CODEX_MODELS.luna,
});
export const AISTUDIO_MODELS = Object.freeze({
  pro: 'gemini-3.1-pro-preview',
  hydrogen: 'gemini-4-hydrogen',
  neon: 'gemini-4-neon',
  argon: 'gemini-4-argon',
});
export const IMAGE_MODEL = 'gemini-nano-banana-2.1';
export const IMAGE_SIZES = Object.freeze(['2K', '4K']);
export const IMAGE_RATIOS = Object.freeze(['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9', '4:1', '1:4', '8:1', '1:8']);
// Flow exposes a display label, not AI Studio's model-ID selector.
export const FLOW_IMAGE_MODEL_LABEL = 'Nano Banana 2.1';
export const FLOW_IMAGE_RATIOS = Object.freeze(['16:9', '4:3', '1:1', '3:4', '9:16']);
export const FLOW_IMAGE_COUNTS = Object.freeze([2, 3, 4]);

export function browserEntry(provider = 'aistudio') {
  const entry = BROWSER_PROVIDERS[provider];
  if (!entry) throw new Error('未知外部模型入口');
  if (!entry.enabled) throw new Error(entry.reason);
  return {...entry, provider};
}

// AI Studio catalog IDs; the CLI uses its own High model IDs.
export function geminiModelForTask(task) {
  if (['frontend', 'design'].includes(task)) return AISTUDIO_MODELS.pro;
  if (['chat', 'copywriting', 'copy_review', 'document'].includes(task)) return AISTUDIO_MODELS.hydrogen;
  if (['code', 'complex', 'architecture'].includes(task)) return AISTUDIO_MODELS.neon;
  if (task === 'image') return IMAGE_MODEL;
  throw new Error('未知 Gemini 任务类型');
}

export function taskRoute(task, {provider, model} = {}) {
  const defaults = {
    design: 'aistudio',
    frontend: 'deepseek',
    copywriting: 'antigravity',
    copy_review: 'antigravity',
    document: 'antigravity',
    code: 'deepseek',
    complex: 'antigravity',
    architecture: 'antigravity',
    extraction: 'codex',
    chat: 'deepseek',
    image: 'aistudio',
    video: 'hark',
    motion: 'hark',
  };
  if (!Object.hasOwn(defaults, task)) throw new Error('未知任务类型');
  const antigravityModel = Object.values(ANTIGRAVITY_MODELS).includes(model);
  const studioTextModel = Object.values(AISTUDIO_MODELS).includes(model);
  const codexModel = Object.values(CODEX_MODELS).includes(model);
  let selected = provider;
  if (!selected && model === HARK_MODEL) selected = 'hark';
  if (!selected && antigravityModel) selected = 'antigravity';
  if (!selected && studioTextModel) selected = 'aistudio';
  if (!selected && codexModel) selected = 'codex';
  selected ||= defaults[task];
  if (task === 'image' && !['aistudio', 'flow'].includes(selected)) {
    throw new Error('生图只使用 AI Studio 或 Flow 的 Nano Banana 2.1');
  }
  if (task === 'image' && model && model !== IMAGE_MODEL) {
    throw new Error('生图任务没有此型号选项：仅支持 Nano Banana 2.1');
  }
  if (['video', 'motion'].includes(task) && selected !== 'hark') {
    throw new Error('代码视频和强动效的委派入口为 Hark');
  }
  if (['copywriting', 'copy_review', 'document'].includes(task) && !['antigravity', 'aistudio', 'hark'].includes(selected)) {
    throw new Error('文案和文档请指定 Gemini 或 Claude 的入口和型号');
  }
  if (selected === 'codex') {
    if (!Object.hasOwn(CODEX_TASKS, task)) throw new Error('这类任务未配置 Codex CLI');
    if (model && !codexModel) throw new Error('Codex CLI 未配置此 GPT 型号');
    const primary = model || CODEX_TASKS[task];
    return {
      provider: selected,
      model: primary,
      thinking: primary === CODEX_MODELS.luna ? 'low' : 'xhigh',
    };
  }
  if (selected === 'antigravity') {
    if (!Object.hasOwn(ANTIGRAVITY_TASK_MODELS, task)) throw new Error('这类任务未配置 Antigravity CLI');
    if (model && !antigravityModel) throw new Error('Antigravity CLI 只使用已配置的 High 型号');
    const primary = model || ANTIGRAVITY_TASK_MODELS[task];
    const fallbacks = ANTIGRAVITY_TASK_MODELS[task] === ANTIGRAVITY_MODELS.neon
      ? [
          {provider: 'antigravity', model: ANTIGRAVITY_MODELS.argon},
          {provider: 'aistudio', model: AISTUDIO_MODELS.neon},
          {provider: 'aistudio', model: AISTUDIO_MODELS.argon},
          {provider: 'antigravity', model: ANTIGRAVITY_MODELS.hydrogen},
        ]
      : [{provider: 'aistudio', model: AISTUDIO_MODELS.hydrogen}];
    return {
      provider: selected,
      model: primary,
      thinking: 'High',
      fallbacks: fallbacks
        .filter(candidate => candidate.model !== primary)
        .map(candidate => ({...candidate, thinking: 'High'})),
    };
  }
  if (selected === 'flow' && task !== 'image') throw new Error('Flow 渠道仅用于图片任务');
  const entry = browserEntry(selected);
  if (model && !((selected === 'aistudio' && studioTextModel) || (task === 'image' && ['aistudio', 'flow'].includes(selected) && model === IMAGE_MODEL) || (selected === 'hark' && model === HARK_MODEL))) throw new Error('该任务没有此显式型号选项');
  if (selected === 'flow') return {provider: selected, model: IMAGE_MODEL, modelLabel: FLOW_IMAGE_MODEL_LABEL, count: 2, aspectRatios: FLOW_IMAGE_RATIOS};
  if (selected === 'hark') {
    return {
      provider: selected,
      model: HARK_MODEL,
      modelSelection: 'site_default',
      thinking: 'site_default',
      search: 'verify_tool_use_when_needed',
      newProjectPerConversation: entry.newProjectPerConversation,
      fallbackUrl: entry.fallbackUrl,
    };
  }
  if (selected === 'deepseek') return {provider:selected,thinking:true,search:true,model:'current_web_model'};
  if (selected === 'kimi') return {provider:selected,model:'K3',thinking:'极致',search:'verify_tool_use_when_needed'};
  if (selected === 'zhipu') return {provider:selected,model:'GLM-5.3',thinking:'极致',search:'verify_switch_when_needed'};
  if (selected === 'aistudio') return {provider:selected,model:model || geminiModelForTask(task),thinking:'High'};
  throw new Error('该入口没有已验证的任务路由');
}

export function validateDeepSeekSettings({thinking,search}) {
  if (thinking !== true || search !== true) throw new Error('按用户当前偏好，DeepSeek 必须同时开启深度思考与智能搜索');
  return {thinking:true,search:true};
}

export function validateImageSettings({model, resolution, aspectRatio}) {
  if (model !== IMAGE_MODEL) throw new Error('AI Studio 生图只允许 Nano Banana 2.1');
  if (!IMAGE_SIZES.includes(resolution)) throw new Error('AI Studio 生图分辨率只允许 2K 或 4K');
  if (!IMAGE_RATIOS.includes(aspectRatio)) throw new Error('生图必须明确选择已核对的比例，不使用 Auto');
  return {model, resolution, aspectRatio};
}

export function validateFlowImageSettings({model, aspectRatio, count = 2, resolution, thinking}) {
  if (model !== IMAGE_MODEL) throw new Error('Flow 生图只允许 Nano Banana 2.1');
  if (!FLOW_IMAGE_RATIOS.includes(aspectRatio)) throw new Error('Flow 必须从五种比例中明确选择：16:9、4:3、1:1、3:4、9:16');
  if (!FLOW_IMAGE_COUNTS.includes(count)) throw new Error('Flow 按用户要求每批只允许 2、3 或 4 张');
  if (resolution !== undefined || thinking !== undefined) throw new Error('Flow 当前没有生成分辨率或思考等级控件；2K/4K 是下载高清重塑选项');
  return {model, aspectRatio, count};
}

export function optionValues(requested) {
  const equivalents = {High: ['High', '高', '高的'], Medium: ['Medium', '中等', '中等的'], Low: ['Low', '低', '低的'], Minimal: ['Minimal', '最小', '最低']};
  return equivalents[requested] || [requested];
}

export function optionIndex(options, requested) {
  const accepted = optionValues(requested);
  const index = options.findIndex(value => accepted.includes(value.trim()));
  if (index < 0) throw new Error(`当前面板没有指定选项 ${requested}；重新核对，不自动换值`);
  return index;
}

export function modelIdFromLabel(label = '') {
  const lines = label.split('\n').map(line => line.trim()).filter(Boolean);
  const shownId = lines.find(line => /^gemini-[\w.-]+$/.test(line));
  if (shownId) return [...Object.values(AISTUDIO_MODELS), IMAGE_MODEL].includes(shownId) ? shownId : null;
  const normalized = (lines[0] || '').replace(/双子座/g, 'Gemini').replace(/预览/g, 'Preview').replace(/\s+/g, '').toLowerCase();
  return ({
    'nanobanana2.1': IMAGE_MODEL,
    'gemini3.1propreview': AISTUDIO_MODELS.pro,
    'gemini4neon': AISTUDIO_MODELS.neon,
    'gemini4argon': AISTUDIO_MODELS.argon,
    'gemini4hydrogen': AISTUDIO_MODELS.hydrogen,
    'gemini4号氢': AISTUDIO_MODELS.hydrogen,
  })[normalized] || null;
}

function hasNewIdentity(state, previousCount, previousId) {
  return previousId != null && state.responseId != null ? state.responseId !== previousId : Number.isInteger(previousCount) && state.responseCount > previousCount;
}

export function freshStudioResult(state, previousCount, previousId = null) {
  return hasNewIdentity(state, previousCount, previousId)
    && state.complete === true && state.error === false
    && (Boolean(state.answer?.trim()) || state.images?.some(image => image.width >= 1000 && image.loaded));
}

export function freshDeepSeekResult(state, previousCount, previousId = null) {
  return hasNewIdentity(state, previousCount, previousId) && state.complete === true && Boolean(state.answer?.trim());
}
