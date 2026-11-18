import { callDJPlan, djModelStatus } from './llmService.js';
import * as netease from './neteaseService.js';
import { songKey, selectDiverseTracks } from '../../../shared/djDiversity.js';
const ARTIST_POOLS = [
  ['坂本龙一', 'Yiruma', '久石让', 'Ludovico Einaudi', 'Ólafur Arnalds', 'Max Richter', 'Nils Frahm', 'Dustin O Halloran', 'Hania Rani', 'Joep Beving'],
  ['Brian Eno', 'Marconi Union', 'Hammock', 'Stars of the Lid', 'Eluvium', 'Helios', 'Goldmund', 'Ryuichi Sakamoto', 'Sigur Rós', 'Ólafur Arnalds'],
  ['Daft Punk', 'Calvin Harris', 'Avicii', 'Dua Lipa', 'The Weeknd', 'David Guetta', 'Zedd', 'Martin Garrix', 'Disclosure', 'Clean Bandit'],
  ['陈奕迅', '孙燕姿', '陈绮贞', '王菲', '田馥甄', '李健', '莫文蔚', '张悬', '蔡健雅', '许巍'],
  ['Bruno Mars', 'Pharrell Williams', 'Maroon 5', 'Jason Mraz', 'Jack Johnson', 'Corinne Bailey Rae', 'Lenka', 'Colbie Caillat', 'Carly Rae Jepsen', 'Vampire Weekend'],
  ['Sade', 'Daniel Caesar', 'H.E.R.', 'Frank Ocean', 'Laufey', 'Norah Jones', '王菲', '陈绮贞', 'Tom Misch', 'John Mayer'],
  ['Norah Jones', '陈绮贞', 'Jack Johnson', 'Kings of Convenience', 'Sade', 'Khruangbin', 'Laufey', 'Men I Trust', 'Tom Misch', 'Nujabes'],
];
const SCENES = [
  { pattern: /专注|工作|学习|focus|study/i, label: '专注时刻', queries: ['坂本龙一 纯音乐', 'Yiruma'], intro: '留一点安静给自己，让旋律陪你进入状态。', instrumental: true },
  { pattern: /睡|助眠|sleep/i, label: '慢慢入眠', queries: ['Brian Eno', 'Marconi Union'], intro: '把今天轻轻放下，接下来听一些安静的声音。', instrumental: true },
  { pattern: /跑步|运动|充电|燃|健身|提.*精神|活力|workout/i, label: '能量补给', queries: ['运动 动感', '跑步 电子'], intro: '跟着节奏，把能量一点点找回来。' },
  { pattern: /难过|失恋|伤心|emo|sad/i, label: '陪你一会', queries: ['陈奕迅 安静', '孙燕姿 抒情'], intro: '不急着改变心情，先让几首歌陪着你。' },
  { pattern: /开心|快乐|happy/i, label: '轻快一点', queries: ['快乐 流行', '清新 独立'], intro: '把这份好心情，交给轻快的旋律。' },
  { pattern: /浪漫|爱情|温柔|love/i, label: '温柔夜色', queries: ['浪漫 R&B', '温柔 流行'], intro: '给此刻一点温柔，旋律慢慢来。' },
  { pattern: /放松|累|安静|舒缓|雨|下班|chill|calm/i, label: '松弛下来', queries: ['舒缓 轻音乐', 'Lo-fi'], intro: '不用再做选择，下一段音乐交给我。' },
];
export function rulesDJPlan(description, previous = null) {
  const combined = description + ' ' + (previous?.description || '');
  const retainScene = previous && /^(更安静一点|换一批)$/.test(description.trim());
  const scene = (retainScene ? SCENES.find(item => item.pattern.test(previous.description || '')) : SCENES.find(item => item.pattern.test(description))) || SCENES.find(item => item.pattern.test(combined)) || SCENES[6];
  const artists = [...new Set(['Kanye West', 'Kanye', '周杰伦', '陈奕迅', '孙燕姿', 'Taylor Swift', '王菲', '林俊杰', 'AURORA', ...ARTIST_POOLS.flat()])];
  const rejected = artists.filter(name => new RegExp('(不要|不听|别放|不喜欢)\\s*' + name, 'i').test(combined));
  const artist = artists.find(name => !rejected.includes(name) && combined.toLowerCase().includes(name.toLowerCase()));
  const excludes = /不要.*live|不.*现场|非现场/i.test(combined) ? ['live', '现场'] : [];
  return { label: scene.label, intro: scene.intro, queries: artist ? [artist + (/安静|舒缓|慢/.test(description) ? ' 抒情' : '')] : scene.queries,
    excludeTerms: [...excludes, ...rejected], instrumental: Boolean(scene.instrumental), artistFocus: artist || null };
}
export function filterDJCandidates(tracks, plan, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const terms = plan.excludeTerms.map(term => term.toLowerCase()).filter(Boolean);
  const unique = new Map();
  for (const track of tracks) {
    const text = `${track.title} ${track.artist} ${track.album}`.toLowerCase();
    if (excluded.has(track.id) || terms.some(term => text.includes(term))) continue;
    unique.set(track.id, track);
  }
  return [...unique.values()];
}
export async function createDJSet({ description, previous, excludeIds = [], recentTracks = [], cookie = '', offset = 0, modelSettings }) {
  const fallback = rulesDJPlan(description, previous);
  const model = await callDJPlan(description, previous, modelSettings);
  const plan = model || fallback;
  // 用户明确的否定约束不能被模型忽略。
  plan.excludeTerms = [...new Set([...plan.excludeTerms, ...fallback.excludeTerms].filter(term => typeof term === 'string' && term.trim()).map(term => term.trim()))];
  const sceneIndex = Math.max(0, SCENES.findIndex(scene => scene.label === fallback.label));
  const pool = plan.instrumental && !SCENES[sceneIndex].instrumental ? ARTIST_POOLS[0] : ARTIST_POOLS[sceneIndex];
  const discovery = fallback.artistFocus ? [] : pool;
  const queries = [...new Set(model ? [...plan.queries, ...discovery] : [...discovery, ...plan.queries])].filter(query => !plan.excludeTerms.some(term => query.toLowerCase().includes(term.toLowerCase()))).slice(0, 12);
  const attempts = await Promise.allSettled(queries.map(query => netease.search(query, 8, offset, cookie)));
  const lists = attempts.map(result => result.status === 'fulfilled' ? result.value.tracks : []);
  // 交错取候选，避免第一条搜索的专辑版本占满候选池。
  const interleaved = Array.from({ length: 8 }, (_, i) => lists.flatMap(list => list[i] ? [list[i]] : [])).flat();
  const recentSongs = new Set(recentTracks.map(songKey));
  const candidates = filterDJCandidates(interleaved, plan, excludeIds).filter(track => !recentSongs.has(songKey(track))).slice(0, 72);
  if (!candidates.length) throw new Error('这次没找到合适的歌曲。换个心情描述再试试。');
  const checks = await Promise.allSettled(Array.from({ length: Math.ceil(candidates.length / 30) }, (_, i) => netease.getPlayability(candidates.slice(i * 30, i * 30 + 30).map(t => t.sourceId), cookie)));
  const permissions = new Map(checks.flatMap(result => result.status === 'fulfilled' ? [...result.value] : []));
  const playable = candidates.flatMap(track => {
    const info = permissions.get(String(track.sourceId));
    return info ? [{ ...track, preview: info.preview, duration: info.duration || track.duration }] : [];
  });
  // 能完整播放的曲目优先；不把不可用曲目放进连续播放队列。
  if (!playable.length) throw new Error('这组歌曲暂时没有可用音源。可以连接网易云账号，或换一种心情。');
  const selected = selectDiverseTracks(playable, { recentTracks, maxPerArtist: fallback.artistFocus ? 10 : 2 });
  if (!selected.length) throw new Error('暂时没找到不重复的新歌，换个心情或稍后再试。');
  return { success: true, mode: model ? 'ai' : 'rules', modelAvailable: djModelStatus(modelSettings).available,
    plan: { ...plan, artistFocus: fallback.artistFocus, description: [previous?.description, description].filter(Boolean).join('；').slice(-300) }, tracks: selected, loggedIn: Boolean(cookie) };
}
