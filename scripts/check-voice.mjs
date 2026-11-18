import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../src/lib/voiceInput.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { startVoiceInput } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
let recognition;
class FakeRecognition {
  constructor() { recognition = this; }
  start() { this.started = true; }
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
