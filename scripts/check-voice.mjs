import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../src/lib/voiceInput.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { startVoiceInput, prepareVoiceInput, voiceErrorTitle } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
assert.equal(voiceErrorTitle('当前浏览器不支持网页语音识别。'),'当前浏览器不支持语音');
assert.equal(voiceErrorTitle('当前内嵌页面无法使用麦克风。'),'当前窗口无法使用麦克风');
assert.equal(voiceErrorTitle('麦克风未获授权，请重试。'),'麦克风未获授权');
assert.equal(voiceErrorTitle('浏览器的语音识别服务连接失败。'),'语音服务连接失败');
const finalResults = (...texts) => texts.map(transcript => Object.assign([{transcript}], {isFinal:true}));
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
recognition.onresult({ results: finalResults('刚下班') });
recognition.onresult({ results: finalResults('刚下班','有点累') });
assert.deepEqual(texts, ['刚下班', '刚下班有点累']);
session.stop(); assert.equal(states.at(-1), false); assert.equal(errors.length, 0);
const cancelled = startVoiceInput(callbacks, FakeRecognition);
const lateResult = recognition.onresult;
cancelled.abort(); lateResult({ results: [[{ transcript: '不能覆盖' }]] });
assert.equal(texts.length, 2); assert.equal(recognition.aborted, true);
startVoiceInput(callbacks, FakeRecognition); recognition.onerror({ error: 'not-allowed' });
recognition.onend?.(); assert.match(errors.at(-1), /麦克风未获授权/); assert.equal(errors.length, 1);
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
await prepareVoiceInput(LocalRecognition);
const local = startVoiceInput(callbacks,LocalRecognition);
assert.equal(recognition.processLocally,true);assert.equal(recognition.started,true);local.abort();
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

// 慢的能力查询不能挡住当前点击；只在之后的点击采用已安装语言。
let resolveAvailability;
class SlowCapability extends LocalRecognition { static available(){return new Promise(resolve=>{resolveAvailability=resolve;});} }
const preparing=prepareVoiceInput(SlowCapability);
await Promise.resolve();
const immediate=startVoiceInput(callbacks,SlowCapability);
assert.equal(recognition.started,true);assert.equal(recognition.processLocally,false);
immediate.abort();resolveAvailability('available');await preparing;
const warmed=startVoiceInput(callbacks,SlowCapability);assert.equal(recognition.processLocally,true);warmed.abort();

// 模拟计时：高频转写合并、幂等停止、音频结束提前释放、尾句与超时清理。
const originalSetTimeout=globalThis.setTimeout, originalClearTimeout=globalThis.clearTimeout;
let now=0, timerId=0;const timers=new Map();
globalThis.setTimeout=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,due:now+ms});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
function advance(ms){const target=now+ms;while(true){const ready=[...timers].filter(([,t])=>t.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];if(!ready)break;timers.delete(ready[0]);now=ready[1].due;ready[1].fn();}now=target;}
class StickyRecognition extends DelayedRecognition { stop(){this.stopCount=(this.stopCount||0)+1;} }
try {
  texts=[];states=[];errors=[];phases.length=0;
  const streamed=startVoiceInput({...callbacks,onPhase:p=>phases.push(p)},StickyRecognition);
  recognition.onstart();
  for(let i=0;i<20;i++)recognition.onresult({results:[Object.assign([{transcript:'心情'+i}],{isFinal:false})]});
  assert.equal(texts.length,0);advance(60);assert.deepEqual(texts,['心情19']);
  recognition.onresult({results:finalResults('心情19')});assert.equal(texts.length,1);
  recognition.onspeechend();streamed.stop();streamed.stop();assert.equal(recognition.stopCount,1);assert.equal(phases.at(-1),'stopping');
  recognition.onaudioend();assert.deepEqual(states,[true,false]);
  recognition.onresult({results:finalResults('心情完整句')});assert.equal(texts.at(-1),'心情完整句');
  recognition.onend();assert.deepEqual(states,[true,false]);assert.equal(phases.at(-1),'idle');assert.equal(timers.size,0);
  const hanging=startVoiceInput({...callbacks,onPhase:p=>phases.push(p)},StickyRecognition);
  recognition.onstart();hanging.stop();const late=recognition.onresult;
  advance(1500);assert.equal(recognition.aborted,true);assert.equal(phases.at(-1),'idle');
  const count=texts.length;late({results:finalResults('迟到句')});assert.equal(texts.length,count);assert.equal(timers.size,0);
  const blocked=startVoiceInput(callbacks,DelayedRecognition);advance(10000);
  assert.equal(recognition.aborted,true);assert.match(errors.at(-1),/未能启动/);blocked.abort();assert.equal(timers.size,0);
} finally {globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;}
console.log('通过：能力预热不阻塞点击、高频转写合并、最终文字立即更新、停止幂等、麦克风关闭即释放、尾句保留、超时释放与迟到结果忽略。');
