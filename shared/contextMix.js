const PERIODS = [
  { from: 0, label: '凌晨', title: '慢慢入眠', direction: '助眠，极轻的环境音乐，少人声，低能量', profile: 'ambient', queries: ['安静 环境音乐', '助眠 纯音乐'] },
  { from: 5, label: '清晨', title: '清醒开场', direction: '轻快清新，温和地提起精神，原声与独立流行', profile: 'bright', queries: ['清晨 原声', '清新 独立流行'] },
  { from: 9, label: '上午', title: '轻轻进入状态', direction: '平稳轻柔的钢琴与低保真音乐，专注，少人声', profile: 'piano', queries: ['专注 钢琴', 'Lo-fi 纯音乐'] },
  { from: 12, label: '午后', title: '午后松弛', direction: '放松，轻柔爵士与 Bossa Nova，中慢节奏', profile: 'chill', queries: ['Bossa Nova', '午后 爵士'] },
  { from: 17, label: '傍晚', title: '卸下忙碌', direction: '下班放松，温暖原声与灵魂乐，节奏舒展', profile: 'warm', queries: ['温暖 原声', '放松 灵魂乐'] },
  { from: 20, label: '夜晚', title: '夜色放空', direction: '安静放松，轻柔 R&B 与氛围爵士，低能量', profile: 'warm', queries: ['夜晚 轻柔 R&B', '安静 爵士'] },
];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 只接收时段和天气分类，不携带城市、坐标或天气接口原始数据。
export function buildContextMix(input) {
  if (!input || !Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23 ||
    !Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6 ||
    typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  const weather = ['sunny', 'cloudy', 'rainy', 'snowy', 'night'].includes(input.weather) ? input.weather : null;
  const temperatureBand = weather && ['cold', 'mild', 'hot'].includes(input.temperatureBand) ? input.temperatureBand : null;
  const period = PERIODS.findLast(item => input.hour >= item.from);
  const weekend = input.weekday === 0 || input.weekday === 6;
  const late = input.hour < 5;
  const dark = late || input.hour >= 20;
  let { title, direction, profile, queries } = period;
  if (weekend && period.label === '上午') {
    title = '慢慢醒来'; direction = '周末放松，轻柔原声与爵士，不急促'; profile = 'chill'; queries = ['周末 原声', '轻柔 爵士'];
  }
  if (weather === 'rainy') {
    title = dark ? '雨夜放空' : '雨天慢行'; direction += '；下雨，温暖松弛的钢琴与原声，不刻意悲伤'; profile = late ? 'ambient' : 'piano'; queries = ['雨天 轻柔钢琴', '温暖 原声'];
  } else if (weather === 'snowy') {
    title = '雪落无声'; direction += '；雪天，通透舒缓的钢琴与氛围音乐'; profile = late ? 'ambient' : 'piano'; queries = ['冬日 钢琴', '安静 氛围音乐'];
  } else if (temperatureBand === 'hot') {
    title = dark ? '清凉夜风' : '清凉微风'; direction += '；天气炎热，清爽轻盈的 Bossa Nova 与 Chill 音乐'; profile = late ? 'ambient' : 'chill'; queries = ['清爽 Bossa Nova', 'Chill 轻音乐'];
  } else if (temperatureBand === 'cold') {
    title = dark ? '暖意入夜' : '留一点暖意'; direction += '；天气偏冷，温暖的爵士、灵魂乐与原声'; profile = late ? 'ambient' : 'warm'; queries = ['温暖 爵士', '温柔 原声'];
  } else if (weather === 'sunny' && !dark) {
    title = '晴光漫游'; direction += '；晴天，明亮清新的旋律，轻快但不喧闹';
    if (period.label !== '上午' || weekend) { profile = 'bright'; queries = ['清新 独立流行', '轻快 原声']; }
  } else if (weather === 'cloudy') {
    title = dark ? '云下夜色' : '云间漫步'; direction += '；多云，柔和的独立音乐与 Lo-fi'; profile = late ? 'ambient' : 'chill'; queries = ['轻柔 独立音乐', 'Lo-fi'];
  } else if (weather === 'night' && dark) title = late ? '星夜入眠' : '星光陪伴';
  // 凌晨始终保持低能量，天气只改变色彩，不改变助眠方向。
  if (late) { profile = 'ambient'; queries = ['助眠 环境音乐', '柔和 纯音乐']; }
  const timeLabel = `${weekend ? '周末' : WEEKDAYS[input.weekday]}${period.label}`;
  const context = { date: input.date, weekday: input.weekday, hour: input.hour, weather, temperatureBand };
  return {
    context, key: [input.date, period.from, weather || 'unknown', temperatureBand || 'unknown'].join(':'),
    timeLabel, title, name: `${timeLabel} · ${title}`, profile, queries, instrumental: profile === 'ambient' || profile === 'piano',
    description: `${timeLabel}${weather ? '，' + ({ sunny: '晴天', cloudy: '多云', rainy: '下雨', snowy: '下雪', night: '晴夜' })[weather] : ''}。${direction}。请为此刻安排连续播放的音乐。`,
  };
}
