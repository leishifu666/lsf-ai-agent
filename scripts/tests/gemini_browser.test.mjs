import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm, realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {browserRoute, recoveryPlan, browserWaitPlan, validateUploads, createGeminiBrowser, isFreshAnswer} from '../gemini_browser.mjs';

test('UI routes keep Pro in dialogue and Argon only in task', () => {
  for (const task of ['frontend', 'design', 'copywriting']) {
    assert.equal(browserRoute(task).entry, '对话');
    assert.equal(browserRoute(task).label, 'Pro 高点');
  }
  assert.equal(browserRoute('chat').label, 'Flash 高点');
  assert.equal(browserRoute('complex').entry, '任务');
  assert.equal(browserRoute('complex').high, false);
  assert.throws(() => browserRoute('anything'));
});

test('normal task refusal gets three retries then one clarified attempt', () => {
  let state = {retries: 0, rewrites: 0};
  for (let i = 1; i <= 3; i++) {
    state = recoveryPlan({kind: 'model_refusal', taskAllowed: true, ...state});
    assert.equal(state.action, 'retry_same_prompt');
    assert.equal(state.retries, i);
  }
  state = recoveryPlan({kind: 'model_refusal', taskAllowed: true, ...state});
  assert.equal(state.action, 'clarify_prompt_then_retry');
  assert.equal(recoveryPlan({kind: 'model_refusal', taskAllowed: true, ...state}).action, 'report');
});

test('technical errors and unvalidated tasks cannot be retried as refusals', () => {
  for (const kind of ['auth', 'quota', 'network', 'timeout', 'content_filter', 'missing_material', 'unknown'])
    assert.equal(recoveryPlan({kind, taskAllowed: true}).action, 'report');
  assert.equal(recoveryPlan({kind: 'model_refusal', taskAllowed: false}).action, 'report');
  assert.throws(() => recoveryPlan({kind: 'model_refusal', retries: -1}));
});

test('explicit continued-retry authorization extends refusal retries only', () => {
  assert.equal(recoveryPlan({kind: 'model_refusal', taskAllowed: true, retries: 3, rewrites: 1, continueRetrying: true}).action, 'retry_same_prompt');
  assert.equal(recoveryPlan({kind: 'network', taskAllowed: true, continueRetrying: true}).action, 'report');
  assert.equal(recoveryPlan({kind: 'model_refusal', taskAllowed: false, continueRetrying: true}).action, 'report');
});

test('browser silence requests stop-then-retry but thought or text progress continues', () => {
  const quiet = {generating: true, thinkingVisible: false, hasNewText: false};
  assert.equal(browserWaitPlan({...quiet, elapsedMs: 59000}).action, 'wait');
  assert.equal(browserWaitPlan({...quiet, elapsedMs: 60000}).action, 'stop_then_retry');
  assert.equal(browserWaitPlan({...quiet, elapsedMs: 180000, thinkingVisible: true}).action, 'wait');
  assert.equal(browserWaitPlan({...quiet, elapsedMs: 180000, hasNewText: true}).action, 'wait');
});

test('ended or unknown UI state never triggers a stop action', () => {
  assert.equal(browserWaitPlan({elapsedMs: 120000, generating: false, thinkingVisible: false, hasNewText: false}).action, 'inspect_completed');
  assert.equal(browserWaitPlan({elapsedMs: 120000}).action, 'inspect');
  assert.throws(() => browserWaitPlan({elapsedMs: -1}));
});

test('completed old response and incomplete new response are never fresh results', () => {
  assert.equal(isFreshAnswer({answerCount: 2, complete: true, answer: 'old'}, 2), false);
  assert.equal(isFreshAnswer({answerCount: 3, complete: false, answer: 'partial'}, 2), false);
  assert.equal(isFreshAnswer({answerCount: 3, complete: true, answer: ' '}, 2), false);
  assert.equal(isFreshAnswer({answerCount: 3, complete: true, answer: 'new'}, 2), true);
});

test('regeneration may replace the answer without increasing its count', () => {
  const state = {answerCount: 1, answerId: 'new', complete: true, answer: 'new response'};
  assert.equal(isFreshAnswer(state, 1, 'old'), true);
  assert.equal(isFreshAnswer({...state, answerId: 'old', answerCount: 2}, 1, 'old'), false);
  assert.equal(isFreshAnswer({...state, complete: false}, 1, 'old'), false);
  assert.equal(isFreshAnswer({...state, answer: ''}, 1, 'old'), false);
});

test('credential names and credentials in ordinary source files are blocked', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lsf-browser-test-'));
  try {
    const secret = path.join(root, '.env.local');
    const source = path.join(root, 'ordinary.tsx');
    const safe = path.join(root, '组件.txt');
    await writeFile(secret, 'fixture');
    await writeFile(source, 'const key = "sk-' + 'X'.repeat(40) + '";');
    await writeFile(safe, 'non-sensitive fixture');
    await assert.rejects(validateUploads([secret]), /凭据/);
    await assert.rejects(validateUploads([source]), /凭据/);
    await assert.rejects(validateUploads([root]), /文件/);
    await assert.rejects(validateUploads(['relative.txt']), /绝对/);
    assert.equal((await validateUploads([safe])).length, 1);
  } finally {
    const cleanupTarget = await realpath(root);
    const tempParent = await realpath(os.tmpdir());
    assert.equal(path.dirname(cleanupTarget), tempParent);
    assert.ok(path.basename(cleanupTarget).startsWith('lsf-browser-test-'));
    await rm(cleanupTarget, {recursive: true});
  }
});

test('disabled Gemini website factory rejects before any browser interaction', () => {
  const page = new Proxy({}, {get() {throw new Error('browser was touched');}});
  assert.throws(() => createGeminiBrowser(page), /禁用.*AI Studio/);
});
