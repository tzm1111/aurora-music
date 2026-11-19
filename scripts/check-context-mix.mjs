import assert from 'node:assert/strict';
import { buildContextMix } from '../shared/contextMix.js';
import { contextDJPlan, createDJSet } from '../server/src/services/djEngine.js';
const base = { date:'2026-11-19',weekday:4,hour:14,weather:null,temperatureBand:null };
const afternoon = buildContextMix(base);
assert.equal(afternoon.name,'周四午后 · 午后松弛');
const sunny=buildContextMix({...base,weather:'sunny',temperatureBand:'mild'});
const rainy=buildContextMix({...base,weather:'rainy',temperatureBand:'mild'});
assert.notEqual(sunny.key,rainy.key);assert.notDeepEqual(sunny.queries,rainy.queries);assert.notEqual(sunny.profile,rainy.profile);
assert.equal(contextDJPlan(rainy.context).label,rainy.name);
assert.deepEqual(contextDJPlan(rainy.context).queries,rainy.queries);
assert.equal(contextDJPlan(rainy.context).instrumental,true);
assert.equal(buildContextMix({...base,hour:3,weather:'rainy'}).profile,'ambient');
assert.equal(buildContextMix({...base,hour:20,weather:'night'}).title,'星光陪伴');
assert.equal(buildContextMix({...base,hour:9}).profile,'piano');
assert.equal(buildContextMix({...base,weekday:6,hour:9}).profile,'chill');
assert.equal(buildContextMix({...base,weather:'sunny',temperatureBand:'hot'}).title,'清凉微风');
assert.equal(buildContextMix({...base,weather:'sunny',temperatureBand:'cold'}).profile,'warm');
assert.notEqual(buildContextMix({...base,hour:16}).key,buildContextMix({...base,hour:17}).key);
assert.equal(buildContextMix({...base,hour:13}).key,afternoon.key);
assert.equal(buildContextMix({...base,weather:'unknown'}).context.weather,null);
assert.equal(buildContextMix({...base,hour:24}),null);assert.equal(buildContextMix({}),null);assert.equal(buildContextMix(null),null);
assert.equal(contextDJPlan({hour:'<script>'}),null);
// 经过真实 DJ 引擎，天气必须改变搜索候选，返回可播放且歌手分散的歌单。
const originalFetch=globalThis.fetch;
const originalProvider=process.env.LLM_PROVIDER;process.env.LLM_PROVIDER='disabled';
let sequence=0;
let searches=[];
globalThis.fetch=async raw=>{
  const url=new URL(raw);
  if(url.pathname==='/cloudsearch'){
    const artist=url.searchParams.get('keywords');searches.push(artist);
    const id=++sequence;
    return {ok:true,json:async()=>({code:200,result:{songs:[{id,name:'Song '+id,ar:[{name:artist}],al:{name:'Album'},dt:180000}]}})};
  }
  return {ok:true,json:async()=>({code:200,data:url.searchParams.get('id').split(',').map(id=>({id,url:'https://example.invalid/audio',time:180000}))})};
};
try {
  const rainSet=await createDJSet({description:rainy.description,context:rainy.context});
  const rainSearches=[...searches];searches=[];
  const sunSet=await createDJSet({description:sunny.description,context:sunny.context,recentTracks:rainSet.tracks});
  assert.equal(rainSet.plan.label,rainy.name);assert.equal(sunSet.plan.label,sunny.name);
  assert.deepEqual(rainSet.plan.context,rainy.context);assert.equal(rainSet.tracks.length,10);
  assert.notDeepEqual(rainSearches,searches);assert.ok(rainSearches.includes('坂本龙一'));assert.ok(searches.includes('Bruno Mars'));
  assert.equal(new Set(rainSet.tracks.map(t=>t.artist)).size,10);
} finally { globalThis.fetch=originalFetch;if(originalProvider===undefined)delete process.env.LLM_PROVIDER;else process.env.LLM_PROVIDER=originalProvider; }
console.log('通过：真实天气与时段改变名称及查询、工作日/周末、冷热天气、凌晨低能量、时段更新、无效上下文校验。');
