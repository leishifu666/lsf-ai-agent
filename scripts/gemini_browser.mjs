/** Ego Lite step helpers. Pass an ego-browser Page; no private APIs or browser launch. */
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const PRO = Object.freeze({entry: '对话', menu: '3.1 Pro 高级推理', label: 'Pro 高点', high: true});
const FLASH = Object.freeze({entry: '对话', menu: '3.8 Flash 全方位帮助', label: 'Flash 高点', high: true});
const ARGON = Object.freeze({entry: '任务', menu: '4 Argon 复杂任务', label: 'Gemini Argon', high: false});
const ROUTES = Object.freeze({frontend: PRO, design: PRO, copywriting: PRO, chat: FLASH, complex: ARGON});
export const VERIFIED_ON = '2026-10-20';

export function isFreshAnswer(state, previousAnswerCount, previousAnswerId = null) {
  const comparableIds = typeof previousAnswerId === 'string' && previousAnswerId.length > 0
    && typeof state.answerId === 'string' && state.answerId.length > 0;
  const freshIdentity = comparableIds ? state.answerId !== previousAnswerId : state.answerCount > previousAnswerCount;
  return Number.isInteger(previousAnswerCount) && previousAnswerCount >= 0
    && freshIdentity && state.complete === true
    && typeof state.answer === 'string' && state.answer.trim().length > 0;
}

/** Plan only; caller rechecks the UI before clicking Stop, then the current Retry. */
export function browserWaitPlan({elapsedMs, generating, thinkingVisible, hasNewText, idleLimitMs = 60000}) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(idleLimitMs) || idleLimitMs <= 0)
    throw new Error('等待时间与阈值必须有效');
  if ([generating, thinkingVisible, hasNewText].some(value => typeof value !== 'boolean'))
    return {action: 'inspect'};
  if (!generating) return {action: 'inspect_completed'};
  if (thinkingVisible || hasNewText || elapsedMs < idleLimitMs) return {action: 'wait'};
  return {action: 'stop_then_retry'};
}

export function browserRoute(task) {
  if (!Object.hasOwn(ROUTES, task)) throw new Error('未知 Gemini task');
  return {...ROUTES[task], task};
}

/** Classification is a Codex judgment about the authorized task, never a keyword heuristic. */
export function recoveryPlan({kind, retries = 0, rewrites = 0, taskAllowed = false, continueRetrying = false}) {
  if (!Number.isInteger(retries) || retries < 0 || !Number.isInteger(rewrites) || rewrites < 0)
    throw new Error('重试计数必须是非负整数');
  if (kind !== 'model_refusal' || !taskAllowed) return {action: 'report', retries, rewrites};
  if (continueRetrying === true || retries < 3) return {action: 'retry_same_prompt', retries: retries + 1, rewrites};
  if (rewrites === 0) return {action: 'clarify_prompt_then_retry', retries, rewrites: 1};
  return {action: 'report', retries, rewrites};
}

function checkPrompt(prompt) {
  if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('提示不能为空');
  if (/sk-[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9._-]{24,}/.test(prompt))
    throw new Error('提示疑似包含凭据；禁止上传');
}

export async function validateUploads(files) {
  if (!Array.isArray(files) || files.length === 0 || files.some(f => typeof f !== 'string' || !path.isAbsolute(f)))
    throw new Error('上传仅接受明确选择的绝对文件路径');
  const resolved = [];
  let total = 0;
  for (const file of files) {
    const actual = await realpath(file);
    const basename = path.basename(actual).toLowerCase();
    const extension = path.extname(actual).toLowerCase();
    if (basename.startsWith('.env') || /^(?:密钥(?:\.txt)?|api_key(?:\.txt)?|credentials\.json|oauth_creds\.json|google_accounts\.json)$/.test(basename)
        || ['.pem', '.key', '.p12', '.pfx'].includes(extension)) throw new Error('不上传凭据文件');
    const info = await stat(actual);
    if (!info.isFile()) throw new Error('只上传文件，不遍历目录');
    total += info.size;
    if (total > 16 * 1024 * 1024) throw new Error('辅助脚本本次上传上限 16 MiB；缩小材料范围');
    if (['.txt', '.md', '.markdown', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.css', '.html', '.json', '.yaml', '.yml', '.py', '.diff', '.patch'].includes(extension)) {
      const text = await readFile(actual, 'utf8');
      if (/sk-[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9._-]{24,}/.test(text)) throw new Error('上传文本疑似包含凭据');
    }
    resolved.push(actual);
  }
  return resolved;
}

function requireState(state) {
  if (!state || typeof state.observedAt !== 'number' || Date.now() - state.observedAt > 90000)
    throw new Error('需要当前页签的最新 inspect 结果');
}

export function createGeminiBrowser() {
  throw new Error('用户已暂时禁用普通 Gemini 网页；请使用 AI Studio');
}

// Historical implementation is deliberately not exported or called.
function createLegacyGeminiBrowser(page, {task = 'chat'} = {}) {
  const selection = browserRoute(task);
  const button = name => `loc=role:button[name=${JSON.stringify(name)}]`;
  const modelButton = () => 'button[aria-label^="打开模式选择器，当前模式为"]';
  const editor = '[role="textbox"][aria-label="为 Gemini 输入提示"]';
  const menuItem = text => `[role="menuitem"]:has-text(${JSON.stringify(text)})`;
  const readDraft = () => page.evaluate(() => {
    const el = document.querySelector('[role="textbox"][aria-label="为 Gemini 输入提示"]');
    if (!el) throw new Error('未找到当前 Gemini 输入框');
    return el.innerText;
  });
  let entryConfirmed = false;
  let knownModel = false;
  let lastPrompt = null;
  let recovery = {retries: 0, rewrites: 0};

  async function inspect({readAnswer = false} = {}) {
    const state = await page.evaluate(({readAnswer}) => {
      const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const buttons = Array.from(document.querySelectorAll('button')).filter(visible);
      const model = buttons.find(el => (el.getAttribute('aria-label') || '').startsWith('打开模式选择器，当前模式为'));
      const modelLabel = model?.getAttribute('aria-label') || null;
      const modelName = modelLabel?.match(/^打开模式选择器，当前模式为“(.+)”$/)?.[1];
      const textbox = document.querySelector('[role="textbox"][aria-label="为 Gemini 输入提示"]');
      const bodies = Array.from(document.querySelectorAll('model-response-content')).filter(visible);
      const lastBody = bodies.at(-1);
      const response = lastBody?.closest('.response-content');
      const footer = response?.querySelector('.response-footer');
      const menus = Array.from(document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"]')).filter(visible);
      const stopButtons = buttons.filter(el => /停止|stop/i.test(el.getAttribute('aria-label') || ''));
      return {
        modelLabel,
        modelText: modelName || model?.textContent.trim() || null,
        menuItems: menus.map(el => el.innerText.trim().replace(/\s+/g, ' ')),
        draftPresent: !!textbox?.innerText.trim(),
        sendingAvailable: buttons.some(el => el.getAttribute('aria-label') === '发送' && !el.disabled),
        toolsOpen: buttons.find(el => el.getAttribute('aria-label') === '上传和工具')?.getAttribute('aria-expanded') === 'true',
        answerCount: bodies.length,
        answerId: lastBody?.id || lastBody?.querySelector('[id^="model-response-message-content"]')?.id
          || lastBody?.closest('[id^="model-response-message-content"]')?.id || null,
        generating: stopButtons.length > 0,
        // A visible status/control is enough; never collect reasoning text.
        thinkingVisible: buttons.some(el => el.textContent.trim() === '立即回答'),
        complete: !!footer?.classList.contains('complete') && stopButtons.length === 0,
        ...(readAnswer ? {answer: lastBody?.innerText || ''} : {}),
        // Only frame metadata; no user filenames, file contents, account or history inventory.
        pickerFrames: Array.from(document.querySelectorAll('iframe')).filter(el => el.src.startsWith('https://docs.google.com') && visible(el))
          .map(el => ({id: el.id, title: el.title})),
      };
    }, {readAnswer});
    const observed = {...state, observedAt: Date.now(), selection};
    if (knownModel && state.modelText?.replace(/\s/g, '') !== selection.label.replace(/\s/g, '')) knownModel = false;
    return {...observed, configurationConfirmed: entryConfirmed && knownModel};
  }

  async function actionAndInspect(selector) {
    await page.click(selector, {label: '操作 Gemini 当前任务控件'});
    return inspect();
  }

  function modelMenuRequired(state) {
    requireState(state);
    const hasModel = state.menuItems.some(label => label.includes(selection.menu));
    const hasPro = state.menuItems.some(label => label.includes('3.1 Pro'));
    if (!hasModel || (selection.entry === '任务' && hasPro)) throw new Error('型号菜单与指定任务入口不匹配；重新核对');
  }

  return {
    selection, inspect,
    async chooseEntry(state) {
      requireState(state);
      if (state.draftPresent) throw new Error('当前有未发送草稿；不自动切换入口');
      const result = await actionAndInspect(button(selection.entry));
      entryConfirmed = true;
      knownModel = false; // Entry switches reset model/thinking in the verified UI.
      return result;
    },
    async openModels() { return actionAndInspect(modelButton()); },
    async chooseModel(state) {
      modelMenuRequired(state);
      // Pro exists only in the verified dialogue menu; Argon is selected only in task menu.
      const result = await actionAndInspect(menuItem(selection.menu.split(' ').slice(0, 2).join(' ')));
      entryConfirmed = selection.entry === '对话' ? state.menuItems.some(label => label.includes('思考等级')) : !state.menuItems.some(label => label.includes('思考等级'));
      knownModel = result.modelText?.replace(/\s/g, '') === selection.label.replace(/\s/g, '');
      return {...result, configurationConfirmed: entryConfirmed && knownModel};
    },
    async expandThinking(state) {
      requireState(state);
      if (!selection.high) throw new Error('任务 Argon 菜单没有思考档位，不伪造 high');
      if (!state.menuItems.some(label => label.startsWith('思考等级'))) throw new Error('当前菜单没有思考等级入口');
      return actionAndInspect(menuItem('思考等级'));
    },
    async chooseHigh(state) {
      requireState(state);
      if (!selection.high) throw new Error('任务入口未提供最高思考选项');
      if (!state.menuItems.some(label => label.includes('高点'))) throw new Error('尚未展开高点选项');
      const result = await actionAndInspect(menuItem('高点'));
      knownModel = result.modelText?.replace(/\s/g, '') === selection.label.replace(/\s/g, '');
      return result;
    },
    async confirmExisting(state, {entry}) {
      requireState(state);
      if (entry !== selection.entry || state.modelText?.replace(/\s/g, '') !== selection.label.replace(/\s/g, ''))
        throw new Error('现有入口或型号/思考档位不符合当前任务');
      entryConfirmed = true;
      knownModel = true;
      return {reused: true, selection};
    },
    async openTools() { return actionAndInspect(button('上传和工具')); },
    async openFileChooser(files) {
      const checked = await validateUploads(files);
      const waiting = page.waitForFileChooser({timeout: 10000});
      await page.click(button('文件'), {label: '选择本轮 Gemini 上传文件'});
      const chooser = await waiting;
      return {chooser, files: checked};
    },
    async attachChosen({chooser, files}) {
      await chooser.setFiles(files);
      return inspect(); // Caller additionally checks filenames/chips in a focused snapshot.
    },
    async fillPrompt(prompt) {
      checkPrompt(prompt);
      const existing = await readDraft();
      if (existing.trim()) throw new Error('输入框已有草稿；拒绝覆盖');
      await page.click(editor, {label: '聚焦 Gemini 本轮提示输入'});
      await page.keyboard.insertText(prompt);
      lastPrompt = prompt;
      recovery = {retries: 0, rewrites: 0};
      return {filled: true, requiresInspection: true};
    },
    async send(state) {
      requireState(state);
      if (!entryConfirmed || !knownModel || !state.draftPresent || !state.sendingAvailable || !lastPrompt)
        throw new Error('发送前须确认入口、型号、思考、自己的提示和附件状态');
      const normalize = value => value.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
      const actualPrompt = await readDraft();
      if (normalize(actualPrompt) !== normalize(lastPrompt))
        throw new Error('输入框全文与本次提示不一致；复查恢复的草稿，不自动发送');
      const count = state.answerCount;
      const result = await actionAndInspect(button('发送'));
      return {...result, previousAnswerCount: count, previousAnswerId: state.answerId || null};
    },
    async readAnswer() { return inspect({readAnswer: true}); },
    planRecovery({kind, taskAllowed, continueRetrying = false}) {
      const plan = recoveryPlan({kind, taskAllowed, continueRetrying, ...recovery});
      if (plan.action !== 'report') recovery = {retries: plan.retries, rewrites: plan.rewrites};
      return {...plan, sameModel: selection.menu};
    },
    async openRegenerate(state) {
      requireState(state);
      if (state.answerCount < 1 || !state.complete) throw new Error('没有当前完整回答，不能定位重做');
      if (!entryConfirmed || !knownModel) throw new Error('重试前先核对本轮入口、型号和思考');
      const result = await actionAndInspect('button[aria-label="重做"] >> nth=-1');
      if (result.answerCount < state.answerCount) throw new Error('重做后回答区或页面发生变化；停止并核对，不能自动重发');
      return result;
    },
  };
}
