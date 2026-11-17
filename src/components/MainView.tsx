import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudRain, Sun, Snowflake, Moon, Play, Search, X } from 'lucide-react';
import { usePlayer } from '../store/usePlayer';
import type { Mood, Weather, Track } from '../types';
import { recommendByContext } from '../lib/recommend';
import { TRACKS } from '../data/tracks';
import { fetchProviders, searchTracks } from '../services/api';
import type { ProviderId, ProviderStatus } from '../services/api';

const MOODS: { key: Mood; label: string; emoji: string }[] = [
  { key: 'happy',     label: '开心',     emoji: '😄' },
  { key: 'chill',     label: '放松',     emoji: '🌿' },
  { key: 'focus',     label: '专注',     emoji: '🎯' },
  { key: 'sad',       label: '忧郁',     emoji: '🌧️' },
  { key: 'energetic', label: '充电',     emoji: '⚡' },
  { key: 'romantic',  label: '浪漫',     emoji: '💞' },
  { key: 'sleepy',    label: '助眠',     emoji: '🌙' },
];

const WEATHER_ICON: Record<Weather, React.ReactNode> = {
  sunny:  <Sun size={28} />,
  cloudy: <Cloud size={28} />,
  rainy:  <CloudRain size={28} />,
  snowy:  <Snowflake size={28} />,
  night:  <Moon size={28} />,
};

const WEATHER_LABEL: Record<Weather, string> = {
  sunny: '晴朗', cloudy: '多云', rainy: '小雨', snowy: '飘雪', night: '夜色',
};

const SOURCES: { id: ProviderId; label: string }[] = [
  { id: 'local',   label: '本地曲库' },
  { id: 'netease', label: '网易云音乐' },
];

export function MainView() {
  const mood = usePlayer(s => s.mood);
  const setMood = usePlayer(s => s.setMood);
  const weather = usePlayer(s => s.weather);
  const setWeather = usePlayer(s => s.setWeather);
  const city = usePlayer(s => s.city);
  const temp = usePlayer(s => s.temperatureC);
  const playTrack = usePlayer(s => s.playTrack);
  const importedTracks = usePlayer(s => s.importedTracks);
  const registerRemoteTracks = usePlayer(s => s.registerRemoteTracks);

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ProviderId>('local');
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [remote, setRemote] = useState<Track[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const allTracks = useMemo<Track[]>(() => [...TRACKS, ...importedTracks], [importedTracks]);

  const recommended = useMemo(
    () => recommendByContext(mood, weather, 8),
    [mood, weather]
  );

  const filtered = useMemo<Track[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTracks;
    // 中文→英文标签映射，让中文搜索也能命中
    const expandedTerms = expandChineseQuery(q);
    return allTracks.filter(t => {
      const haystack = [
        t.title, t.artist, t.album ?? '',
        ...t.tags, t.region ?? '',
      ].join(' ').toLowerCase();
      return expandedTerms.some(term => haystack.includes(term));
    });
  }, [query, allTracks]);

  const netease = providers.find(p => p.id === 'netease');
  const neteaseDown = Boolean(netease && !netease.available);
  const isRemoteSearch = source === 'netease' && Boolean(query.trim());

  const resetRemote = () => {
    setRemote([]);
    setRemoteTotal(0);
    setRemoteError(null);
    setRemoteLoading(false);
  };

  const handleSourceChange = (id: ProviderId) => {
    if (id !== source) resetRemote();
    setSource(id);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) resetRemote();
  };

  // 音源可用状态（挂载时拉一次）
  useEffect(() => {
    const ctrl = new AbortController();
    fetchProviders(ctrl.signal)
      .then(setProviders)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // 网易云搜索（防抖 + 可取消）
  useEffect(() => {
    const q = query.trim();
    if (source !== 'netease' || !q) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setRemoteLoading(true);
      setRemoteError(null);

      searchTracks('netease', q, 24, ctrl.signal)
        .then(result => {
          setRemote(result.tracks);
          setRemoteTotal(result.total);
          registerRemoteTracks(result.tracks);
        })
        .catch(err => {
          if (err?.name === 'AbortError') return;
          setRemote([]);
          setRemoteTotal(0);
          setRemoteError(err?.message || '网易云搜索失败');
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setRemoteLoading(false);
        });
    }, 380);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, source, registerRemoteTracks]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '深夜好';
    if (h < 12) return '早上好';
    if (h < 18) return '下午好';
    return '晚上好';
  }, []);

  const cycleWeather = () => {
    const list: Weather[] = ['sunny','cloudy','rainy','snowy','night'];
    const i = list.indexOf(weather);
    setWeather(list[(i + 1) % list.length]);
  };

  return (
    <main className="main glass-soft">
      <div className="hero">
        <div>
          <div className="greeting">{greeting} · 推荐由极光为你呈现</div>
          <h1>今天，听点{moodToWord(mood)}的</h1>
          <p>根据 {city}的{WEATHER_LABEL[weather]}天气与你的心情，我们挑选了以下歌单</p>
        </div>
        <div className="weather-card glass-soft" onClick={cycleWeather} style={{cursor:'pointer'}} title="点击切换天气">
          {WEATHER_ICON[weather]}
          <div>
            <div className="temp">{temp}°</div>
            <div className="meta">{city} · {WEATHER_LABEL[weather]}</div>
          </div>
        </div>
      </div>

      <div className="mood-row">
        {MOODS.map(m => (
          <button
            key={m.key}
            className={`mood-chip ${mood === m.key ? 'active' : ''}`}
            onClick={() => setMood(m.key)}
          >
            <span style={{marginRight: 6}}>{m.emoji}</span>{m.label}
          </button>
        ))}
      </div>

      <div className="search-shell">
        <div className="source-tabs" role="tablist" aria-label="音源">
          {SOURCES.map(s => (
            <button
              key={s.id}
              role="tab"
              aria-selected={source === s.id}
              className={`source-tab ${source === s.id ? 'active' : ''}`}
              onClick={() => handleSourceChange(s.id)}
            >
              {s.label}
              {s.id === 'netease' && neteaseDown && <span className="source-dot" title="未连接" />}
            </button>
          ))}
        </div>
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder={source === 'netease'
              ? '搜索网易云：歌名 · 歌手 · 专辑'
              : '搜索歌曲 · 艺术家 · 标签（如 chill / rainy / CN）'}
          />
          {query && (
            <button className="search-clear" onClick={() => { setQuery(''); resetRemote(); }} title="清空">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {source === 'netease' && neteaseDown && (
        <div className="source-hint warn">
          网易云服务未连接：在 aurora-music 目录运行 <code>npm run music-api</code> 后刷新页面
        </div>
      )}
      {source === 'netease' && !neteaseDown && !query.trim() && (
        <div className="source-hint">输入歌名或歌手，直接搜索网易云曲库</div>
      )}

      {query.trim() ? (
        isRemoteSearch ? (
          <>
            <div className="section-h">
              <h2>网易云结果</h2>
              <span className="more">
                {remoteLoading
                  ? '搜索中…'
                  : remoteError
                    ? '搜索失败'
                    : `${remote.length} / ${remoteTotal} 首匹配「${query.trim()}」`}
              </span>
            </div>
            {remoteError ? (
              <div className="empty-tip">{remoteError}</div>
            ) : remote.length ? (
              <>
                {remote.some(t => t.vip) && (
                  <div className="source-hint">
                    标 VIP 的歌曲在未登录状态下为 30 秒试听；有自己的会员账号可在 <code>server/.env</code> 配置 <code>NETEASE_COOKIE</code>
                  </div>
                )}
                <div className="track-grid">
                  {remote.map(t => (
                    <div key={t.id} className="track-card" onClick={() => playTrack(t.id, remote.map(r => r.id))}>
                      <div className="cover">
                        <img src={t.cover} alt={t.title} loading="lazy" />
                        {t.vip && <span className="vip-badge">VIP</span>}
                        <div className="play-fab"><Play size={16} fill="currentColor"/></div>
                      </div>
                      <div className="title">{t.title}</div>
                      <div className="artist">{t.artist}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-tip">
                {remoteLoading ? '正在搜索网易云曲库…' : '没有匹配项，换个关键词试试？'}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-h">
              <h2>搜索结果</h2>
              <span className="more">{filtered.length} 首匹配「{query}」</span>
            </div>
            {filtered.length ? (
              <div className="track-grid">
                {filtered.map(t => (
                  <div key={t.id} className="track-card" onClick={() => playTrack(t.id, filtered.map(r => r.id))}>
                    <div className="cover">
                      <img src={t.cover} alt={t.title} loading="lazy" />
                      <div className="play-fab"><Play size={16} fill="currentColor"/></div>
                    </div>
                    <div className="title">{t.title}</div>
                    <div className="artist">{t.artist}{t.region ? ' · ' + t.region : ''}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-tip">没有匹配项，换个词试试？</div>
            )}
          </>
        )
      ) : (
        <>
          <div className="section-h">
            <h2>为你推荐</h2>
            <span className="more">基于天气 + 心情 智能挑选</span>
          </div>
          <div className="track-grid">
            {recommended.map(t => (
              <div key={t.id} className="track-card" onClick={() => playTrack(t.id, recommended.map(r => r.id))}>
                <div className="cover">
                  <img src={t.cover} alt={t.title} loading="lazy" />
                  <div className="play-fab"><Play size={16} fill="currentColor"/></div>
                </div>
                <div className="title">{t.title}</div>
                <div className="artist">{t.artist}</div>
              </div>
            ))}
          </div>

          <div className="section-h">
            <h2>全部曲库</h2>
            <span className="more">共 {allTracks.length} 首 · 含本地导入</span>
          </div>
          <div className="track-grid">
            {allTracks.map(t => (
              <div key={t.id} className="track-card" onClick={() => playTrack(t.id, allTracks.map(x => x.id))}>
                <div className="cover">
                  <img src={t.cover} alt={t.title} loading="lazy" />
                  <div className="play-fab"><Play size={16} fill="currentColor"/></div>
                </div>
                <div className="title">{t.title}</div>
                <div className="artist">{t.artist}{t.region ? ' · ' + t.region : ''}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function moodToWord(m: Mood): string {
  return ({
    happy: '欢快', chill: '舒缓', focus: '专注', sad: '安静',
    energetic: '带劲', romantic: '温柔', sleepy: '助眠',
  } as Record<Mood,string>)[m];
}

// 中文搜索关键词扩展：把中文词转为可能匹配的英文标签
const ZH_TO_TAGS: Record<string, string[]> = {
  '放松': ['chill'], '舒缓': ['chill'], '慢': ['chill','lofi'],
  '开心': ['happy'], '快乐': ['happy'], '欢快': ['happy'],
  '专注': ['focus'], '学习': ['focus','lofi'], '工作': ['focus'],
  '伤心': ['sad'], '忧郁': ['sad'], '难过': ['sad'], '安静': ['sad','chill'],
  '充电': ['energetic'], '兴奋': ['energetic'], '活力': ['energetic'],
  '浪漫': ['romantic'], '爱情': ['romantic'], '甜': ['romantic'],
  '助眠': ['sleepy'], '睡觉': ['sleepy'], '安眠': ['sleepy'],
  '雨': ['rainy'], '下雨': ['rainy'], '雨天': ['rainy'],
  '晴': ['sunny'], '晴天': ['sunny'], '太阳': ['sunny'],
  '夜': ['night'], '晚上': ['night'], '深夜': ['night'],
  '雪': ['snowy'], '冬天': ['snowy'], '飘雪': ['snowy'],
  '云': ['cloudy'], '多云': ['cloudy'],
  '流行': ['pop'], '摇滚': ['rock'], '电子': ['edm','synthwave'],
  '民谣': ['folk'], '爆裂': ['edm','energetic'], '崇拜': ['indie'],
  '中文': ['CN'], '中国': ['CN'], '国内': ['CN'],
  '日本': ['JP'], '日语': ['JP'], '韩国': ['KR'], '韩语': ['KR'],
  '欧美': ['US','EU'], '拉丁': ['LA'],
};

function expandChineseQuery(q: string): string[] {
  const terms = [q];
  for (const [zh, tags] of Object.entries(ZH_TO_TAGS)) {
    if (q.includes(zh)) {
      terms.push(...tags);
    }
  }
  return terms;
}
