/** User-selected browser routes and image constraints. No browser or network side effects. */
export const BROWSER_PROVIDERS = Object.freeze({
  aistudio: {url: 'https://aistudio.google.com/prompts/new_chat', enabled: true},
  kimi: {url: 'https://www.kimi.com/', enabled: true},
  deepseek: {url: 'https://chat.deepseek.com/', enabled: true},
  zhipu: {url: 'https://chatglm.cn/', enabled: true},
  gemini_web: {url: 'https://gemini.google.com/app', enabled: false, reason: '用户已暂时禁用 Gemini 普通网页版；优先 AI Studio'},
  midjourney: {url: 'https://www.midjourney.com/', enabled: false, reason: '按用户避免封号的选择，仅准备材料、人工提交，不自动操作账号'},
});
export const IMAGE_MODEL = 'gemini-nano-banana-2.1';
export const IMAGE_SIZES = Object.freeze(['2K', '4K']);
export const IMAGE_RATIOS = Object.freeze(['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9', '4:1', '1:4', '8:1', '1:8']);

export function browserEntry(provider = 'aistudio') {
  const entry = BROWSER_PROVIDERS[provider];
  if (!entry) throw new Error('未知外部模型入口');
  if (!entry.enabled) throw new Error(entry.reason);
  return {...entry, provider};
}

export function geminiModelForTask(task) {
  if (['frontend', 'design', 'copywriting'].includes(task)) return 'gemini-3.1-pro-preview';
  if (task === 'chat') return 'gemini-3.8-flash';
  if (task === 'complex') return 'gemini-4-argon';
  if (task === 'image') return IMAGE_MODEL;
  throw new Error('未知 Gemini 任务类型');
}

export function taskRoute(task, {provider, model} = {}) {
  const defaults = {design:'aistudio',frontend:'deepseek',copywriting:'aistudio',code:'deepseek',complex:'deepseek',chat:'deepseek',image:'aistudio'};
  if (!Object.hasOwn(defaults, task)) throw new Error('未知任务类型');
  const selected = provider || defaults[task];
  if (task === 'image' && selected !== 'aistudio') throw new Error('生图只使用 AI Studio Nano Banana 2.1');
  browserEntry(selected);
  if (model && !(selected === 'aistudio' && task === 'copywriting' && ['gemini-3.1-pro-preview','gemini-3.8-flash'].includes(model))) throw new Error('该任务没有此显式型号选项');
  if (selected === 'deepseek') return {provider:selected,thinking:true,search:true,model:'current_web_model'};
  if (selected === 'kimi') return {provider:selected,model:'K3',thinking:'极致',search:'verify_tool_use_when_needed'};
  if (selected === 'zhipu') return {provider:selected,model:'GLM-5.3',thinking:'极致',search:'verify_switch_when_needed'};
  if (selected === 'aistudio') return {provider:selected,model:model || geminiModelForTask(task === 'code' ? 'complex' : task),thinking:'High'};
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
  const first = label.split('\n')[0].trim();
  const normalized = first.replace(/双子座/g, 'Gemini').replace(/闪光灯/g, 'Flash').replace(/预览/g, 'Preview').replace(/\s+/g, '').toLowerCase();
  return ({'nanobanana2.1': IMAGE_MODEL, 'gemini3.1propreview': 'gemini-3.1-pro-preview', 'gemini3.8flash': 'gemini-3.8-flash', 'gemini4argon': 'gemini-4-argon'})[normalized] || null;
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
