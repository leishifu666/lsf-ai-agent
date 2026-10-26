/** Public ego-browser Page operations; run each dropdown open/select/verify in one Node round. */
import {browserEntry, IMAGE_MODEL, validateImageSettings, optionIndex, optionValues, modelIdFromLabel, freshStudioResult} from './browser_policy.mjs';

export function createAIStudioBrowser(page, {task = 'chat'} = {}) {
  browserEntry('aistudio');
  let selectedModel = null;
  let lastPrompt = null;
  const editor = 'textarea[aria-label="Enter a prompt"]';

  async function inspect({readAnswer = false} = {}) {
    return page.evaluate(({readAnswer}) => {
      const visible = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
      const buttons = [...document.querySelectorAll('button')].filter(visible);
      const modelText = document.querySelector('button.model-selector-card')?.innerText || '';
      const settings = Object.fromEntries([...document.querySelectorAll('[role="combobox"]')].map(e => [e.getAttribute('aria-label'), e.innerText.trim()]));
      const switches = Object.fromEntries([...document.querySelectorAll('[role="switch"]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('aria-checked') === 'true']));
      // Thought activity is a separate turn: never read it or expand its panel.
      const finals = [...document.querySelectorAll('ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model')];
      const last = finals.at(-1);
      const body = last?.querySelector('ms-cmark-node.cmark-node');
      const responseId = last?.closest('ms-chat-turn')?.id || null;
      const footerPresent = !!last?.querySelector('.turn-footer');
      const generating = buttons.some(e => /^(?:progress_activity\s*)?(?:Stop|停止)$/.test((e.getAttribute('aria-label') || e.innerText).trim()));
      const runAvailable = buttons.some(e => /^Run\s+keyboard_return$/.test(e.innerText.trim()) && !e.disabled);
      const error = !!last && /发生内部错误|An internal error|Something went wrong|RESOURCE_EXHAUSTED/i.test(last.innerText);
      const images = [...(last?.querySelectorAll('img.loaded-image') || [])].map(e => ({width: e.naturalWidth, height: e.naturalHeight, loaded: e.complete}));
      return {modelText, settings, switches, responseCount: finals.length, responseId, footerPresent, generating, runAvailable, error, images,
        complete: !generating && runAvailable && footerPresent && !error && (!!body?.innerText.trim() || images.some(i => i.width >= 1000 && i.loaded)),
        draftPresent: !!document.querySelector('textarea[aria-label="Enter a prompt"]')?.value.trim(),
        apiKeySelected: !document.querySelector('button[aria-label="No API key selected"]'),
        ...(readAnswer ? {answer: body?.innerText || '', errorText: error ? last.innerText.slice(0,800) : null} : {})};
    }, {readAnswer});
  }

  async function selectSetting(label, value) {
    await page.click(`loc=role:combobox[name=${JSON.stringify(label)}]`, {label: `展开 ${label} 设置`});
    const options = await page.evaluate(() => [...document.querySelectorAll('mat-option')].filter(e => e.getClientRects().length > 0).map(e => e.innerText.trim()));
    const index = optionIndex(options, value);
    await page.click(`mat-option >> nth=${index}`, {label: `选择 ${label} 参数`});
    // Angular clears or briefly retains the old label while applying a choice.
    // Wait for the requested value, rather than treating that transient as failure.
    await page.waitForFunction(({label, accepted}) => [...document.querySelectorAll('[role="combobox"]')].some(e => e.getAttribute('aria-label') === label && accepted.includes(e.innerText.trim())), {label, accepted: optionValues(value)}, {timeout: 5000});
    const state = await inspect();
    optionIndex([state.settings[label] || ''], value);
    return state;
  }

  return {
    inspect, selectSetting,
    async waitForResult({previousCount, previousId}, {timeout = 50000} = {}) {
      await page.waitForFunction(({previousCount, previousId}) => {
        const finals = [...document.querySelectorAll('ms-chat-turn:not(.thought-activity-host) .chat-turn-container.model')];
        const last = finals.at(-1);
        const id = last?.closest('ms-chat-turn')?.id;
        const fresh = previousId && id ? id !== previousId : finals.length > previousCount;
        const buttons = [...document.querySelectorAll('button')].filter(e => e.getClientRects().length > 0);
        const stop = buttons.some(e => /^(?:progress_activity\s*)?(?:Stop|停止)$/.test((e.getAttribute('aria-label') || e.innerText).trim()));
        const error = /发生内部错误|An internal error|Something went wrong|RESOURCE_EXHAUSTED/i.test(last?.innerText || '');
        const content = last?.querySelector('ms-cmark-node.cmark-node')?.innerText.trim() || [...(last?.querySelectorAll('img.loaded-image') || [])].some(e => e.complete && e.naturalWidth >= 1000);
        return fresh && !stop && (error || (content && !!last?.querySelector('.turn-footer')));
      }, {previousCount, previousId}, {timeout});
      const result = await inspect({readAnswer: true});
      if (!freshStudioResult(result, previousCount, previousId)) throw new Error(result.error ? 'AI Studio 本轮生成返回错误' : '本轮最终回答未通过新鲜度和完成检查');
      return result;
    },
    async selectModel(id) {
      if (!/^[a-z0-9.-]+$/.test(id)) throw new Error('需要明确的模型 ID');
      if (task === 'image' && id !== IMAGE_MODEL) throw new Error('生图不允许切换到其他型号');
      await page.click('button.model-selector-card', {label: '打开 AI Studio 模型选择'});
      await page.fill('input[placeholder="Search for a model or agent"]', id);
      await page.click(`[id=${JSON.stringify('model-carousel-row-models/' + id)}]`, {label: '选择明确指定的 Gemini 模型'});
      const state = await inspect();
      if (modelIdFromLabel(state.modelText) !== id) throw new Error('模型标签与所选 ID 不符；停止并核对翻译或界面变化');
      selectedModel = id;
      return state;
    },
    async setSwitch(label, enabled) {
      if (typeof enabled !== 'boolean') throw new Error('开关目标必须明确为 true 或 false');
      const before = await inspect();
      if (!Object.hasOwn(before.switches, label)) throw new Error('当前模型未提供该工具开关');
      if (before.switches[label] !== enabled) await page.click(`button[aria-label=${JSON.stringify(label)}]`, {label: `调整 ${label} 开关`});
      await page.waitForFunction(({label, enabled}) => [...document.querySelectorAll('[role="switch"]')].some(e => e.getAttribute('aria-label') === label && e.getAttribute('aria-checked') === String(enabled)), {label, enabled}, {timeout: 5000});
      const state = await inspect();
      if (state.switches[label] !== enabled) throw new Error('工具开关状态未生效');
      return state;
    },
    async configureImage({resolution = '2K', aspectRatio = '1:1', thinking = 'High'} = {}) {
      validateImageSettings({model: IMAGE_MODEL, resolution, aspectRatio});
      await this.selectModel(IMAGE_MODEL);
      await selectSetting('Resolution', resolution);
      await selectSetting('Aspect ratio', aspectRatio);
      return selectSetting('Thinking Level', thinking);
    },
    async fillPrompt(prompt) {
      if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('提示不能为空');
      if (/sk-[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9._-]{24,}/.test(prompt)) throw new Error('提示疑似包含凭据');
      const draft = await page.evaluate(() => document.querySelector('textarea[aria-label="Enter a prompt"]')?.value);
      if (typeof draft !== 'string' || draft.trim()) throw new Error('输入框缺失或已有草稿；不覆盖');
      await page.click(editor, {label: '聚焦本轮 AI Studio 提示'});
      await page.keyboard.insertText(prompt);
      lastPrompt = prompt;
    },
    async send() {
      const state = await inspect();
      if (!selectedModel || modelIdFromLabel(state.modelText) !== selectedModel) throw new Error('本轮尚未确认模型');
      if (task === 'image') validateImageSettings({model: selectedModel, resolution: state.settings.Resolution, aspectRatio: state.settings['Aspect ratio']});
      const actual = await page.evaluate(() => document.querySelector('textarea[aria-label="Enter a prompt"]')?.value);
      if (!lastPrompt || actual !== lastPrompt || state.generating) throw new Error('提示全文不符或已有生成，未重复发送');
      const submittedAt = Date.now();
      await page.click('button:has-text("Run")', {label: '提交已核对的 AI Studio 任务'});
      lastPrompt = null;
      return {previousCount: state.responseCount, previousId: state.responseId, submittedAt};
    },
  };
}
