import {browserEntry,validateDeepSeekSettings,freshDeepSeekResult} from './browser_policy.mjs';

/** Ego Lite Page only. Final answers and controls are read separately from reasoning. */
export function createDeepSeekBrowser(page) {
  browserEntry('deepseek');
  let lastPrompt = null;
  const editor='textarea[name="search"]';
  async function inspect({readAnswer=false}={}) {
    return page.evaluate(({readAnswer})=>{
      const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';
      const toggles=[...document.querySelectorAll('[aria-pressed]')].filter(visible);
      const enabled=label=>toggles.find(e=>e.innerText.trim()===label)?.getAttribute('aria-pressed')==='true';
      const finals=[...document.querySelectorAll('.ds-assistant-message-main-content')];
      const last=finals.at(-1);
      const footerButtons=last?.closest('.ds-message')?.nextElementSibling?.querySelectorAll('button,[role=button]').length||0;
      const draft=document.querySelector('textarea[name="search"]')?.value;
      const responseId=last?.closest('[data-virtual-list-item-key]')?.getAttribute('data-virtual-list-item-key')||null;
      return {thinking:enabled('深度思考'),search:enabled('智能搜索'),responseCount:finals.length,responseId,draftPresent:!!draft?.trim(),complete:!!last?.innerText.trim()&&footerButtons>=2,footerButtons,
        thinkingVisible:[...document.querySelectorAll('.ds-think-content')].filter(visible).some(e=>!e.closest('.ds-message')?.nextElementSibling?.querySelector('button,[role=button]')),
        ...(readAnswer?{answer:last?.innerText||'',links:[...(last?.querySelectorAll('a[href]')||[])].map(e=>({text:e.innerText,href:e.getAttribute('href')}))}:{})};
    },{readAnswer});
  }
  return {
    inspect,
    async waitForResult({previousCount,previousId},{timeout=50000}={}){
      await page.waitForFunction(({previousCount,previousId})=>{
        const finals=[...document.querySelectorAll('.ds-assistant-message-main-content')];
        const last=finals.at(-1);
        const id=last?.closest('[data-virtual-list-item-key]')?.getAttribute('data-virtual-list-item-key');
        const fresh=previousId&&id?id!==previousId:finals.length>previousCount;
        return fresh&&!!last?.innerText.trim()&&last.closest('.ds-message')?.nextElementSibling?.querySelectorAll('button,[role=button]').length>=2;
      },{previousCount,previousId},{timeout});
      const result=await inspect({readAnswer:true});
      if(!freshDeepSeekResult(result,previousCount,previousId))throw new Error('DeepSeek 本轮回答未通过完成检查');
      return result;
    },
    async configure(){
      for(const [key,label] of [['thinking','深度思考'],['search','智能搜索']]){
        const before=await inspect();
        if(!before[key])await page.click(`[aria-pressed]:has-text(${JSON.stringify(label)})`,{label:`开启 DeepSeek ${label}`});
        await page.waitForFunction(({label})=>[...document.querySelectorAll('[aria-pressed]')].some(e=>e.innerText.trim()===label&&e.getAttribute('aria-pressed')==='true'),{label},{timeout:5000});
      }
      const state=await inspect();
      validateDeepSeekSettings(state);
      return state;
    },
    async fillPrompt(prompt){
      if(typeof prompt!=='string'||!prompt.trim())throw new Error('提示不能为空');
      if(/sk-[A-Za-z0-9_-]{24,}|Bearer\s+[A-Za-z0-9._-]{24,}/.test(prompt))throw new Error('提示疑似包含凭据');
      const draft=await page.evaluate(()=>document.querySelector('textarea[name="search"]')?.value);
      if(typeof draft!=='string'||draft.trim())throw new Error('输入框缺失或已有草稿，不覆盖');
      await page.click(editor,{label:'聚焦本轮 DeepSeek 提示'});
      await page.keyboard.insertText(prompt);
      lastPrompt=prompt;
    },
    async send(){
      const state=await inspect();
      validateDeepSeekSettings(state);
      const actual=await page.evaluate(()=>document.querySelector('textarea[name="search"]')?.value);
      if(!lastPrompt||actual!==lastPrompt)throw new Error('本轮提示全文不符，未发送');
      const submittedAt=Date.now();
      await page.keyboard.press('Enter');
      lastPrompt=null;
      return {previousCount:state.responseCount,previousId:state.responseId,submittedAt};
    },
  };
}
