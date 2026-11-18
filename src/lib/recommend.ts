import type { Mood, Weather, Track } from '../types';
import { TRACKS } from '../data/tracks';
import { usePlayer } from '../store/usePlayer';

// 心情/天气 → 标签权重
const MOOD_TAGS: Record<Mood, string[]> = {
  happy:     ['happy','energetic','pop','sunny','indie'],
  chill:     ['chill','lofi','ambient','bossa','folk'],
  focus:     ['focus','lofi','ambient','synthwave'],
  sad:       ['sad','rainy','rnb','indie','folk'],
  energetic: ['energetic','edm','rock','pop','synthwave'],
  romantic:  ['romantic','rnb','bossa','jpop','kpop'],
  sleepy:    ['sleepy','ambient','lofi','folk'],
};

const WEATHER_TAGS: Record<Weather, string[]> = {
  sunny:  ['sunny','happy','bossa','energetic'],
  cloudy: ['cloudy','chill','folk','indie'],
  rainy:  ['rainy','sad','lofi','focus'],
  snowy:  ['snowy','sleepy','ambient','folk'],
  night:  ['night','synthwave','rnb','ambient'],
};

/**
 * 根据心情 + 天气推荐歌曲（内置曲库 + 导入歌曲）
 * 导入歌曲若无 tags，通过歌名/艺术家关键词智能推断心情
 */
export function recommendByContext(mood: Mood, weather: Weather, limit = 8, allTracks: Track[] = [...TRACKS, ...usePlayer.getState().importedTracks]): Track[] {
  const tagWeights = new Map<string, number>();
  MOOD_TAGS[mood].forEach((t, i) => tagWeights.set(t, (tagWeights.get(t) ?? 0) + (5 - i)));
  WEATHER_TAGS[weather].forEach((t, i) => tagWeights.set(t, (tagWeights.get(t) ?? 0) + (4 - i)));

  return allTracks
    .map(track => {
      let tags = track.tags;
      // 导入歌曲若无有效 tags，通过歌名/艺术家推断心情
      if (track.tags.includes('imported') && !track.tags.some(t => t !== 'imported' && t !== 'CN')) {
        tags = inferMoodTags(track.title + ' ' + track.artist);
      }
      const score = tags.reduce(
        (s, tag) => s + (tagWeights.get(tag) ?? 0),
        0
      );
      return { track, score: score + Math.random() * 0.5 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.track);
}

/**
 * 通过关键词从歌名/艺术家推断心情标签
 */
function inferMoodTags(text: string): string[] {
  const lower = text.toLowerCase();
  const inferred: string[] = [];

  // 开心/欢快关键词
  if (/晴|阳|光|快乐|开心|嗨|笑|欢|sun|happy|joy/.test(lower))
    inferred.push('happy', 'sunny', 'energetic');
  // 安静/放松关键词
  if (/安静|放松|慢|轻|柔|静|chill|calm|soft|gentle|relax/.test(lower))
    inferred.push('chill', 'ambient');
  // 忧伤/悲伤关键词
  if (/雨|雪|冷|孤|单|伤|泪|哭|忘|别|rain|snow|sad|cry|miss/.test(lower))
    inferred.push('sad', 'rainy');
  // 夜晚关键词
  if (/夜|晚|月|星|暗|黑|梦|night|moon|star|dark|dream/.test(lower))
    inferred.push('night', 'ambient');
  // 动感关键词
  if (/跑|跳|舞|动|电|燃|run|dance|electric|fire|beat|pulse/.test(lower))
    inferred.push('energetic', 'edm');
  // 浪漫关键词
  if (/爱|情|恋|心|温|柔|love|romantic|heart|kiss/.test(lower))
    inferred.push('romantic', 'rnb');
  // 专注关键词
  if (/专注|学|思|考|work|study|focus|deep|think/.test(lower))
    inferred.push('focus', 'lofi');

  return inferred.length ? inferred : ['chill']; // 默认 chill
}

export function recommendByText(text: string, limit = 5): Track[] {
  const allTracks = [...TRACKS, ...usePlayer.getState().importedTracks];
  const lower = text.toLowerCase();
  // 关键词到标签的语义映射
  const map: Record<string, string[]> = {
    '开心|快乐|嗨|happy|joyful|cheer': ['happy','energetic','pop'],
    '平静|放松|chill|relax|安静': ['chill','lofi','ambient'],
    '专注|工作|学习|focus|study|work|deep': ['focus','lofi','ambient'],
    '难过|悲伤|emo|sad|失恋|哭': ['sad','rnb','indie'],
    '动感|燃|嗨歌|跑步|健身|workout': ['energetic','edm','rock'],
    '浪漫|温柔|爱情|恋|love': ['romantic','rnb','bossa'],
    '困|睡|sleep|助眠|失眠': ['sleepy','ambient','lofi'],
    '雨|rain': ['rainy','chill','sad'],
    '晴|阳光|sun': ['sunny','happy'],
    '夜|晚|midnight|night': ['night','synthwave','ambient'],
    '咖啡|coffee|下午': ['chill','bossa','jpop'],
    '日系|j-?pop|jpop': ['jpop'],
    '韩|k-?pop|kpop': ['kpop'],
    '中文|华语|国语': ['CN'],
    '电子|edm|synth': ['edm','synthwave'],
    '民谣|folk': ['folk'],
  };
  const wantTags = new Set<string>();
  Object.entries(map).forEach(([pat, tags]) => {
    const re = new RegExp(pat, 'i');
    if (re.test(lower)) tags.forEach(t => wantTags.add(t));
  });
  // 没匹配到，回退到 chill
  if (wantTags.size === 0) ['chill','indie','pop'].forEach(t => wantTags.add(t));

  return [...allTracks]
    .map(track => {
      let tags = track.tags;
      if (track.tags.includes('imported') && !track.tags.some(t => t !== 'imported' && t !== 'CN')) {
        tags = [...tags, ...inferMoodTags(track.title + ' ' + track.artist)];
      }
      const hits = tags.filter(t => wantTags.has(t)).length
        + (wantTags.has(track.region ?? '') ? 1 : 0);
      return { track, score: hits + Math.random() * 0.3 };
    })
    .filter(x => x.score >= 1)
    .sort((a,b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.track);
}
