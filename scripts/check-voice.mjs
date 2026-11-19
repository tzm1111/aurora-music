import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../src/lib/voiceInput.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { startVoiceInput } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
let recognition;
class FakeRecognition {
  constructor() { recognition = this; }
  start() { this.started = true; this.onstart?.(); }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.aborted = true; }
}
let texts = [], states = [], errors = [];
const callbacks = { onText: value => texts.push(value), onListening: value => states.push(value), onError: value => errors.push(value) };
const session = startVoiceInput(callbacks, FakeRecognition);
assert.equal(recognition.lang, 'zh-CN'); assert.equal(recognition.continuous, false);
assert.deepEqual(states, [true]);
recognition.onresult({ results: [[{ transcript: '刚下班' }]] });
recognition.onresult({ results: [[{ transcript: '刚下班' }], [{ transcript: '有点累' }]] });
assert.deepEqual(texts, ['刚下班', '刚下班有点累']);
session.stop(); assert.equal(states.at(-1), false); assert.equal(errors.length, 0);
const cancelled = startVoiceInput(callbacks, FakeRecognition);
const lateResult = recognition.onresult;
cancelled.abort(); lateResult({ results: [[{ transcript: '不能覆盖' }]] });
assert.equal(texts.length, 2); assert.equal(recognition.aborted, true);
startVoiceInput(callbacks, FakeRecognition); recognition.onerror({ error: 'not-allowed' });
recognition.onend(); assert.match(errors.at(-1), /麦克风未获授权/); assert.equal(errors.length, 1);
startVoiceInput(callbacks, FakeRecognition); recognition.onend(); assert.match(errors.at(-1), /没有听清/);
assert.equal(startVoiceInput(callbacks, null), null); assert.match(errors.at(-1), /不支持/);
class FailingRecognition extends FakeRecognition { start() { throw new Error('blocked'); } }
assert.equal(startVoiceInput(callbacks, FailingRecognition), null); assert.match(errors.at(-1), /无法开启/);
console.log('通过：中文语音、实时转写、结束输入、取消后忽略结果、拒绝权限、未听到声音、不支持与启动失败提示。');

const phases = [];
class DelayedRecognition extends FakeRecognition { start() { this.started = true; } }
states = []; errors = [];
const delayed = startVoiceInput({...callbacks,onPhase:p=>phases.push(p)},DelayedRecognition);
assert.deepEqual(phases,['starting']);assert.deepEqual(states,[],'麦克风开启前不能显示正在聆听');
recognition.onstart();assert.deepEqual(phases,['starting','listening']);
delayed.stop();assert.equal(phases.at(-1),'idle');
const starting = startVoiceInput({...callbacks,onPhase:p=>phases.push(p)},DelayedRecognition);
const lateStart = recognition.onstart;starting.stop();lateStart();
assert.equal(phases.at(-1),'idle');assert.equal(recognition.aborted,true);
class LocalRecognition extends FakeRecognition {
  processLocally=false;
  static async available(){return 'available';}
}
const local = startVoiceInput(callbacks,LocalRecognition);
await Promise.resolve();assert.equal(recognition.processLocally,true);assert.equal(recognition.started,true);local.abort();
const originalContext=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');
Object.defineProperty(globalThis,'isSecureContext',{configurable:true,value:false});
assert.equal(startVoiceInput(callbacks,FakeRecognition),null);assert.match(errors.at(-1),/HTTPS/);
if(originalContext)Object.defineProperty(globalThis,'isSecureContext',originalContext);else delete globalThis.isSecureContext;
globalThis.document={permissionsPolicy:{allowsFeature:()=>false}};
assert.equal(startVoiceInput(callbacks,FakeRecognition),null);assert.match(errors.at(-1),/内嵌页面/);delete globalThis.document;
console.log('通过：手机同步启动、启动中反馈、真实开启后聆听、启动取消与迟到事件、本机识别、HTTPS 与内嵌麦克风限制。');
class EndedRecognition extends FakeRecognition { abort(){throw Error('inactive');} stop(){throw Error('inactive');} }
const ended = startVoiceInput(callbacks,EndedRecognition);
assert.doesNotThrow(()=>ended.stop());assert.doesNotThrow(()=>ended.abort());
class BrokenConstructor { constructor(){throw Error('disabled');} }
assert.equal(startVoiceInput(callbacks,BrokenConstructor),null);
console.log('通过：手机浏览器停止/取消异常后可重新开始、构造失败恢复。');
