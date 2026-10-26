import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {browserEntry,geminiModelForTask,taskRoute,validateDeepSeekSettings,IMAGE_MODEL,BROWSER_PROVIDERS,validateImageSettings,optionIndex,modelIdFromLabel,freshStudioResult,freshDeepSeekResult} from '../browser_policy.mjs';
import {createAIStudioBrowser} from '../aistudio_browser.mjs';

test('Gemini defaults to AI Studio and disabled websites cannot be automated',()=>{
  assert.match(browserEntry().url,/aistudio\.google\.com/);
  assert.throws(()=>browserEntry('gemini_web'),/禁用/);
  assert.throws(()=>browserEntry('midjourney'),/人工/);
  assert.throws(()=>browserEntry('unknown'));
  for(const provider of ['kimi','deepseek','zhipu'])assert.equal(browserEntry(provider).enabled,true);
});
test('Gemini task models retain the user choices',()=>{
  for(const task of ['frontend','design','copywriting'])assert.equal(geminiModelForTask(task),'gemini-3.1-pro-preview');
  assert.equal(geminiModelForTask('chat'),'gemini-3.8-flash');
  assert.equal(geminiModelForTask('complex'),'gemini-4-argon');
  assert.equal(geminiModelForTask('image'),IMAGE_MODEL);
});
test('Image policy rejects other models, 1K and unspecified ratios',()=>{
  const good={model:IMAGE_MODEL,resolution:'2K',aspectRatio:'16:9'};
  assert.deepEqual(validateImageSettings(good),good);
  assert.equal(validateImageSettings({...good,resolution:'4K'}).resolution,'4K');
  assert.throws(()=>validateImageSettings({...good,model:'gemini-3-pro-image'}),/2.1/);
  assert.throws(()=>validateImageSettings({...good,resolution:'1K'}),/2K/);
  assert.throws(()=>validateImageSettings({...good,aspectRatio:'Auto'}),/比例/);
});
test('Visible option matching handles observed translation without guessing an unavailable value',()=>{
  assert.equal(optionIndex(['低的','中等的','高的'],'High'),2);
  assert.equal(optionIndex(['1K','2K','4K'],'4K'),2);
  assert.throws(()=>optionIndex(['Minimal','Medium'],'High'),/换值/);
});
test('Canonical image label does not accept similarly named image models',()=>{
  assert.equal(modelIdFromLabel('Nano Banana 2.1\n双子座纳米香蕉 2.1'),IMAGE_MODEL);
  assert.equal(modelIdFromLabel('Nano Banana 2 Lite'),null);
  assert.equal(modelIdFromLabel('Nano Banana Pro'),null);
  assert.equal(modelIdFromLabel('Gemini 3.1 Pro 预览'),'gemini-3.1-pro-preview');
});
test('A streaming preview, stale body, or completed error cannot be delivered',()=>{
  const done={responseCount:2,complete:true,error:false,answer:'answer',images:[]};
  assert.equal(freshStudioResult(done,1),true);
  assert.equal(freshStudioResult(done,2),false);
  assert.equal(freshStudioResult({...done,complete:false},1),false);
  assert.equal(freshStudioResult({...done,error:true},1),false);
  assert.equal(freshStudioResult({...done,answer:'',images:[{width:2752,loaded:true}]},1),true);
});
test('Image helper refuses another model before browser interaction',async()=>{
  const studio=createAIStudioBrowser({}, {task:'image'});
  await assert.rejects(studio.selectModel('gemini-3-pro-image'),/不允许/);
  await assert.rejects(studio.configureImage({resolution:'1K'}),/2K/);
});

test('Virtualized conversation counts do not hide a new answer or accept an old one',()=>{
  const done={responseCount:2,responseId:'8',complete:true,error:false,answer:'new',images:[]};
  for(const check of [freshStudioResult,freshDeepSeekResult]){
    assert.equal(check(done,3,'6'),true);
    assert.equal(check(done,1,'8'),false);
    assert.equal(check({...done,complete:false},3,'6'),false);
  }
});

test('User task routing separates visual design, implementation and copywriting',()=>{
  assert.equal(taskRoute('design').model,'gemini-3.1-pro-preview');
  assert.equal(taskRoute('frontend').provider,'deepseek');
  assert.equal(taskRoute('code').provider,'deepseek');
  assert.equal(taskRoute('copywriting').provider,'aistudio');
  assert.equal(taskRoute('copywriting').model,'gemini-3.1-pro-preview');
  assert.equal(taskRoute('copywriting',{model:'gemini-3.8-flash'}).model,'gemini-3.8-flash');
  assert.throws(()=>taskRoute('copywriting',{model:'gemini-4-argon'}),/型号/);
  assert.throws(()=>taskRoute('image',{provider:'kimi'}),/生图/);
  assert.throws(()=>taskRoute('unknown'),/未知任务/);
  assert.equal(taskRoute('design',{provider:'kimi'}).model,'K3');
  assert.equal(taskRoute('copywriting',{provider:'zhipu'}).model,'GLM-5.3');
  assert.equal(taskRoute('copywriting',{provider:'zhipu'}).thinking,'极致');
  assert.equal(taskRoute('copywriting',{provider:'zhipu'}).search,'verify_switch_when_needed');
});

test('Public browser routes expose only the supported provider set',()=>{
  assert.deepEqual(Object.keys(BROWSER_PROVIDERS).filter(key=>BROWSER_PROVIDERS[key].enabled).sort(),
    ['aistudio','deepseek','kimi','zhipu']);
  assert.deepEqual(Object.keys(BROWSER_PROVIDERS).filter(key=>!BROWSER_PROVIDERS[key].enabled).sort(),
    ['gemini_web','midjourney']);
  assert.throws(()=>taskRoute('code',{provider:'unsupported-provider'}),/未知外部模型入口/);
  assert.throws(()=>taskRoute('copywriting',{model:'unsupported-model'}),/型号/);
});

test('Unsupported media tasks fail instead of silently switching providers',()=>{
  for(const task of ['video','motion']){
    assert.throws(()=>taskRoute(task),/未知任务/);
    assert.throws(()=>taskRoute(task,{provider:'deepseek'}),/未知任务/);
  }
});

test('AI Studio waits for setting and switch readback instead of rejecting a transient label',async()=>{
  let settled=false;
  const calls=[];
  const page={
    async click(selector){calls.push(selector);settled=false;},
    async waitForFunction(fn,args){
      calls.push('wait');
      if(args.accepted)assert.ok(args.accepted.includes('高的'));
      settled=true;
    },
    async evaluate(fn){
      if(String(fn).includes("querySelectorAll('mat-option')"))return ['Low','Medium','High'];
      return {settings:{'Thinking Level':settled?'高的':''},switches:{'Grounding with Google Search':settled}};
    },
  };
  const studio=createAIStudioBrowser(page);
  assert.equal((await studio.selectSetting('Thinking Level','High')).settings['Thinking Level'],'高的');
  settled=false;
  assert.equal((await studio.setSwitch('Grounding with Google Search',true)).switches['Grounding with Google Search'],true);
  assert.equal(calls.filter(c=>c==='wait').length,2);
});
test('DeepSeek routes require both switches before submission',()=>{
  assert.deepEqual(validateDeepSeekSettings(taskRoute('code')),{thinking:true,search:true});
  assert.throws(()=>validateDeepSeekSettings({thinking:true,search:false}),/同时/);
  assert.throws(()=>validateDeepSeekSettings({thinking:false,search:true}),/同时/);
});

test('AI Studio does not call a returning Run button with an unfinished body complete',async()=>{
  let footer=false;
  let answer='';
  const last={
    innerText:'',
    querySelector(selector){return selector==='.turn-footer'?(footer?{}:null):{innerText:answer};},
    querySelectorAll(){return [];},
    closest(){return {id:'turn-new'};},
  };
  const run={innerText:'Run\nkeyboard_return',disabled:false,getAttribute(){return null;},getClientRects(){return [{}];}};
  const document={
    querySelector(){return null;},
    querySelectorAll(selector){
      if(selector==='button')return [run];
      if(selector.includes('ms-chat-turn'))return [last];
      return [];
    },
  };
  const page={async evaluate(fn,args){return vm.runInNewContext(`(${fn.toString()})(args)`,{document,args,getComputedStyle(){return {visibility:'visible'};}});}};
  const studio=createAIStudioBrowser(page);
  assert.equal((await studio.inspect()).complete,false);
  answer='ready';
  assert.equal((await studio.inspect()).complete,false);
  footer=true;
  assert.equal((await studio.inspect()).complete,true);
});
