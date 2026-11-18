import { Heart, ListPlus, Play, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { Track } from '../types';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';

export function TrackList({ tracks, queue, playlistId }: { tracks: Track[]; queue?: string[]; playlistId?: string }) {
  const current = useCurrentTrack();
  const favorites = usePlayer(s => s.favoriteIds);
  const playlists = usePlayer(s => s.playlists);
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const state = () => usePlayer.getState();
  const addPlaylist = (trackId: string, id: string) => {
    if (!id) return;
    let target = id;
    if (id === '__new') target = state().createPlaylist('新歌单');
    state().addToPlaylist(target, trackId); setAdding(null); setNotice('已加入歌单');
  };
  return <>
    {notice && <div className="list-notice" role="status">{notice}<button onClick={() => setNotice('')}>关闭</button></div>}
    <div className="track-list">
      {tracks.map(t => <div key={t.id} className={`track-row ${current?.id === t.id ? 'current' : ''}`}>
        <button className="track-main" aria-label={`播放 ${t.title}`} onClick={() => state().playTrack(t.id, queue ?? tracks.map(x => x.id))}>
          <div className="thumb"><img src={t.cover} alt="" loading="lazy"/><span className="row-play"><Play size={14} fill="currentColor"/></span></div>
          <div className="row-meta"><div className="row-title">{t.title}{t.preview ? <span className="vip-badge">试听</span> : t.vip && <span className="vip-badge">VIP</span>}</div>
            <div className="row-artist">{t.artist}{t.album ? ` · ${t.album}` : ''}</div></div>
          {t.duration > 0 && <span className="row-dur">{Math.floor(t.duration / 60)}:{String(Math.floor(t.duration % 60)).padStart(2, '0')}</span>}
        </button>
        <div className="track-actions">
          <button title={`下一首播放 ${t.title}`} onClick={() => { state().enqueue(t.id, true); setNotice('已加入队列'); }}><SkipForward size={15}/></button>
          <button title={`加入歌单 ${t.title}`} aria-expanded={adding === t.id} onClick={() => setAdding(adding === t.id ? null : t.id)}><ListPlus size={17}/></button>
          <button title={`${favorites.includes(t.id) ? '取消收藏' : '收藏'} ${t.title}`} aria-pressed={favorites.includes(t.id)} onClick={() => state().toggleFavorite(t.id)}><Heart size={16} fill={favorites.includes(t.id) ? 'currentColor' : 'none'}/></button>
          {playlistId && <button title={`从歌单移除 ${t.title}`} onClick={() => state().removeFromPlaylist(playlistId, t.id)}>移除</button>}
        </div>
        {adding === t.id && <div className="playlist-picker"><label>加入歌单 <select aria-label={`选择歌单 ${t.title}`} value="" onChange={e => addPlaylist(t.id, e.target.value)}>
          <option value="" disabled>选择一个歌单</option>{playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="__new">创建新歌单并加入</option>
        </select></label><button onClick={() => setAdding(null)}>取消</button></div>}
      </div>)}
    </div>
  </>;
}
