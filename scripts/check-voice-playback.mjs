import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const dir=root+'/node_modules/.tmp';await fs.mkdir(dir,{recursive:true});
const modules=[['src/data/tracks.ts','voice-data.mjs'],['src/lib/localLibrary.ts','voice-files.mjs'],['src/store/usePlayer.ts','voice-player.mjs'],['src/lib/voiceInput.ts','voice-input.mjs'],['src/lib/voicePlayback.ts','voice-playback.mjs']];
for(const [source,target] of modules){
  let code=ts.transpileModule(await fs.readFile(root+'/'+source,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [from,to] of [['../data/tracks','voice-data.mjs'],['../lib/localLibrary','voice-files.mjs'],['../store/usePlayer','voice-player.mjs'],['./voiceInput','voice-input.mjs']])code=code.replaceAll("'"+from+"'","'./"+to+"'");
  await fs.writeFile(dir+'/'+target,code);
}
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
let pauses=0;globalThis.document={querySelector:()=>({pause:()=>{pauses++;}})};
const {usePlayer}=await import(dir+'/voice-player.mjs');
const {startPlayerVoiceInput}=await import(dir+'/voice-playback.mjs');
const get=()=>usePlayer.getState();
get().registerRemoteTracks(['a','b'].map(id=>({id,title:id,artist:'test',duration:60,tags:[],src:'/api/'+id,cover:'test'})));
let recognition, resumed=0;
const unsubscribe=usePlayer.subscribe((s,previous)=>{if(s.isPlaying&&!previous.isPlaying)resumed++;});
class FakeRecognition {
  constructor(){recognition=this;}
  start(){assert.equal(get().isPlaying,false,'识别启动前音乐必须暂停');this.onstart?.();}
  stop(){this.onaudioend?.();this.onend?.();}
  abort(){this.aborted=true;}
}
const callbacks={onText:()=>{},onListening:()=>{},onError:()=>{}};
function playing(){get().playTrack('a',['a','b']);get().setProgress(23);usePlayer.setState({playbackStatus:'playing'});resumed=0;}
playing();const request=get().playRequest;const voice=startPlayerVoiceInput(callbacks,FakeRecognition);
assert.equal(get().isPlaying,false);assert.ok(pauses>0);assert.equal(get().progress,23);
recognition.onaudioend();assert.equal(get().isPlaying,true);assert.equal(resumed,1);assert.equal(get().playRequest,request);assert.equal(get().progress,23);
recognition.onend();voice.abort();assert.equal(resumed,1);
playing();get().togglePlay();resumed=0;const paused=startPlayerVoiceInput(callbacks,FakeRecognition);paused.stop();assert.equal(get().isPlaying,false);assert.equal(resumed,0);
playing();const failed=startPlayerVoiceInput(callbacks,FakeRecognition);recognition.onerror({error:'not-allowed'});assert.equal(get().isPlaying,true);failed.abort();assert.equal(resumed,1);
playing();assert.equal(startPlayerVoiceInput(callbacks,null),null);assert.equal(get().isPlaying,true);assert.equal(resumed,1);
class DelayedRecognition extends FakeRecognition {start(){assert.equal(get().isPlaying,false);}}
playing();const starting=startPlayerVoiceInput(callbacks,DelayedRecognition);starting.stop();assert.equal(get().isPlaying,true);assert.equal(resumed,1);
playing();const changed=startPlayerVoiceInput(callbacks,FakeRecognition);get().playTrack('b');get().togglePlay();resumed=0;changed.stop();assert.equal(get().isPlaying,false);assert.equal(get().queue[get().currentIndex],'b');assert.equal(resumed,0);
playing();const controlled=startPlayerVoiceInput(callbacks,FakeRecognition);get().togglePlay();get().togglePlay();resumed=0;controlled.stop();assert.equal(get().isPlaying,false);assert.equal(resumed,0);
playing();const broken=startPlayerVoiceInput(callbacks,FakeRecognition);usePlayer.setState({playbackStatus:'error',audioError:'test'});broken.stop();assert.equal(get().isPlaying,false);
playing();const old=startPlayerVoiceInput(callbacks,FakeRecognition);const oldEnd=recognition.onaudioend;old.abort();
const next=startPlayerVoiceInput(callbacks,FakeRecognition);resumed=0;oldEnd();assert.equal(get().isPlaying,false);next.stop();assert.equal(resumed,1);
unsubscribe();
console.log('通过：语音点击立即暂停真实音频、关闭麦克风即恢复原曲原进度、结束只恢复一次、原先暂停不播放、失败/取消恢复、切歌/手动播放操作不被覆盖、旧识别事件不恢复新会话。');
