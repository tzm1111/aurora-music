import assert from 'node:assert/strict';
import { songKey, artistKeys, selectDiverseTracks, dedupeSongs } from '../shared/djDiversity.js';
import { createDJSet } from '../server/src/services/djEngine.js';
const track=(id,title,artist,preview=false)=>({id,title,artist,preview});
const screenshotTracks=[
  track('a', "Don't Know Why", 'Norah Jones'),
  track('b', 'Don’t Know Why', 'Norah Jones'),
  track('c', "Don't Know Why", 'Pat Metheny'),
  track('d', "Don't Know Why (First Sessions Demo)", 'Norah Jones'),
  track('e', '旅行的意义', '陈绮贞'),
  track('f', '旅行的意义(Guitar Ver.)', '陈绮贞'),
];
assert.equal(dedupeSongs(screenshotTracks).length,2);
assert.equal(songKey(track('x','Rain (Re-Mastered)','a')),songKey(track('y','Rain','b')));
assert.equal(songKey(track('x','Bibo No Aozora (From "Babel")','a')),songKey(track('y','Bibo No Aozora','a')));
assert.notEqual(songKey(track('x','Song (I Love You)','a')),songKey(track('y','Song','a')));
assert.notEqual(songKey(track('x','Live and Let Die','a')),songKey(track('y','Let Die','a')));
assert.deepEqual(artistKeys(track('x','song','Norah Jones / Pat Metheny')),['norahjones','patmetheny']);
const candidates=Array.from({length:10},(_,i)=>track('a'+i,'work'+i,'Singer A')).concat(Array.from({length:10},(_,i)=>track('other'+i,'otherwork'+i,'Singer '+i)));
const diverse=selectDiverseTracks(candidates);assert.equal(diverse.length,10);assert.equal(new Set(diverse.map(t=>t.artist)).size,10);
assert.equal(selectDiverseTracks(candidates.slice(0,10)).length,2);
assert.equal(selectDiverseTracks(candidates.slice(0,10),{maxPerArtist:10}).length,10);
assert.equal(selectDiverseTracks(screenshotTracks,{recentTracks:[screenshotTracks[0]]}).length,1);
const versions=selectDiverseTracks([track('demo','Song (Demo)','A'),track('studio','Song','A')]);assert.equal(versions[0].id,'studio');
const full=selectDiverseTracks([track('preview','Song','A',true),track('full','Song (Live)','A')]);assert.equal(full[0].id,'full');
const original=globalThis.fetch;
const provider=process.env.LLM_PROVIDER;process.env.LLM_PROVIDER='disabled';
let sequence=0;
globalThis.fetch=async raw=>{
  const url=new URL(raw);
  if(url.pathname==='/cloudsearch'){
    const artist=url.searchParams.get('keywords'), i=++sequence;
    const songs=[0,1,2,3].map(n=>({id:i*10+n,name:n===0?'Repeated song':n===1?'Repeated song (Live)':'Unique '+i+'-'+n,ar:[{name:artist}],al:{name:'Album'},dt:180000}));
    return {ok:true,json:async()=>({code:200,result:{songs}})};
  }
  const ids=url.searchParams.get('id').split(',');
  return {ok:true,json:async()=>({code:200,data:ids.map(id=>({id,url:'https://example.invalid/audio',time:180000}))})};
};
const result=await createDJSet({description:'放松一下'});
assert.equal(result.tracks.length,10);assert.equal(new Set(result.tracks.map(songKey)).size,10);assert.equal(new Set(result.tracks.map(t=>t.artist)).size,10);
const next=await createDJSet({description:'放松一下',recentTracks:result.tracks});assert.ok(next.tracks.every(t=>!result.tracks.some(old=>songKey(old)===songKey(t))));
globalThis.fetch=original;if(provider===undefined)delete process.env.LLM_PROVIDER;else process.env.LLM_PROVIDER=provider;
console.log('通过：截图中的专辑/翻唱/Demo/吉他版本去重、保留真实歌名、完整音源优先、歌手分散/最多两首、近期作品排除与候选扩展。');
