import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { usePlayer } from '../store/usePlayer';
import type { Track } from '../types';
import { TRACKS } from '../data/tracks';
import { TrackList } from './TrackList';
import { API_BASE, ONLINE_PLAYER_URL, fetchProviders, searchTracks } from '../services/api';
import type { ProviderId, ProviderStatus } from '../services/api';

const SOURCES: { id: ProviderId; label: string }[] = [
  { id: 'local',   label: '本地曲库' },
  { id: 'netease', label: '网易云音乐' },
];

export function MainView() {
  const importedTracks = usePlayer(s => s.importedTracks);
  const registerRemoteTracks = usePlayer(s => s.registerRemoteTracks);

  const [query, setQuery] = useState('');
  const [source, setSource] = useState<ProviderId>(importedTracks.length || TRACKS.length ? 'local' : 'netease');
  const [offset, setOffset] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [remote, setRemote] = useState<Track[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const allTracks = useMemo<Track[]>(() => [...TRACKS, ...importedTracks], [importedTracks]);

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
    setOffset(0);
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
    resetRemote();
    if (source === 'netease' && value.trim()) setRemoteLoading(true);
  };

  // 页面恢复或用户重试时重新检查服务，不要求用户刷新整个播放器。
  useEffect(() => {
    const ctrl = new AbortController();
    const refresh = () => fetchProviders(ctrl.signal).then(setProviders).catch(() => {});
    void refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => { ctrl.abort(); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, [retryKey]);

  // 网易云搜索（防抖 + 可取消）
  useEffect(() => {
    const q = query.trim();
    if (source !== 'netease' || !q) return;

    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setRemoteLoading(true);
      setRemoteError(null);

      searchTracks('netease', q, 24, ctrl.signal, offset)
        .then(result => {
          if (ctrl.signal.aborted) return;
          setRemote(previous => offset ? Array.from(new Map([...previous, ...result.tracks].map(t => [t.id, t])).values()) : result.tracks);
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
  }, [query, source, registerRemoteTracks, offset, retryKey]);

  return (
    <section className="main glass-soft search-view">
      <div className="hero">
        <div>
          <h1>搜索</h1>
        </div>
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
            aria-label="搜索歌曲或歌手" placeholder="歌曲、歌手或专辑"
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
          <button onClick={() => setRetryKey(k => k + 1)}>重新连接</button>
        </div>
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
                    : `${remoteTotal} 首`}
              </span>
            </div>
            {remoteError ? (
              <div className="empty-tip" role="alert">{remoteError}<button className="primary-action" onClick={() => { setRemoteLoading(true); setRetryKey(k => k + 1); }}>重试搜索</button>{API_BASE && <a className="primary-action" href={ONLINE_PLAYER_URL} target="_blank" rel="noopener noreferrer">打开魔搭完整版</a>}</div>
            ) : remote.length ? (
              <>
                <TrackList tracks={remote} queue={remote.map(r => r.id)} />
                {remote.length < remoteTotal && <button className="load-more" disabled={remoteLoading} onClick={() => setOffset(value => value + 24)}>{remoteLoading ? '加载中…' : '加载更多歌曲'}</button>}
              </>
            ) : (
              <div className="empty-tip">
                {remoteLoading ? '搜索中…' : '暂无结果'}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-h">
              <h2>搜索结果</h2>
              <span className="more">{filtered.length} 首</span>
            </div>
            {filtered.length ? (
              <TrackList tracks={filtered} queue={filtered.map(r => r.id)} />
            ) : (
              <div className="empty-tip">暂无结果</div>
            )}
          </>
        )
      ) : (
        <>
          {!allTracks.length && <div className="welcome-card">
            <h2>常听歌手</h2>
            <div className="quick-searches">{['Kanye West', '周杰伦', '陈奕迅', 'Lo-fi'].map(q => <button key={q} onClick={() => { setSource('netease'); handleQueryChange(q); }}>{q}</button>)}</div>
            <button className="primary-action" onClick={() => usePlayer.getState().setNavOpen(true)}>导入本地音乐</button>
          </div>}
          {allTracks.length > 0 && <>
          <div className="section-h">
            <h2>全部曲库</h2>
            <span className="more">{allTracks.length} 首</span>
          </div>
          <TrackList tracks={allTracks} queue={allTracks.map(x => x.id)} /></>}
        </>
      )}
    </section>
  );
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
