import { useState } from 'react';
import { Heart, Library, Plus } from 'lucide-react';
import { usePlayer, resolveTrack } from '../store/usePlayer';
import { TRACKS } from '../data/tracks';
import { TrackList } from './TrackList';
import type { Track } from '../types';

export function CollectionView() {
  const view = usePlayer(s => s.view);
  const favorites = usePlayer(s => s.favoriteIds);
  const playlists = usePlayer(s => s.playlists);
  const activeId = usePlayer(s => s.activePlaylistId);
  const imported = usePlayer(s => s.importedTracks);
  const remote = usePlayer(s => s.remoteTracks);
  const [name, setName] = useState('');
  const active = playlists.find(p => p.id === activeId);
  const state = usePlayer.getState();
  const title = view === 'favorites' ? '我的收藏' : view === 'library' ? '我的曲库' : active?.name ?? '我的歌单';
  const tracks: Track[] = view === 'library' ? [...TRACKS, ...imported] :
    (view === 'favorites' ? favorites : active?.trackIds ?? []).map(id => resolveTrack({ importedTracks: imported, remoteTracks: remote }, id)).filter((t): t is Track => Boolean(t));
  return <section className="main collection-view glass-soft">
    <div className="collection-heading"><div><p className="eyebrow">属于你的音乐</p><h1>{title}</h1><p className="subtle">{tracks.length} 首 · 收藏与歌单保存在当前浏览器</p></div>{view === 'favorites' ? <Heart size={32}/> : <Library size={32}/>}</div>
    {view === 'playlists' && <>
      <form className="playlist-create" onSubmit={e => { e.preventDefault(); if (name.trim()) { state.createPlaylist(name); setName(''); } }}>
        <input aria-label="新歌单名称" placeholder="给新歌单起个名字" value={name} onChange={e => setName(e.target.value)} maxLength={60}/><button type="submit" disabled={!name.trim()}><Plus size={16}/>创建歌单</button>
      </form>
      <div className="playlist-tabs">{playlists.map(p => <button key={p.id} className={activeId === p.id ? 'selected' : ''} onClick={() => state.openPlaylist(p.id)}>{p.name} <span>{p.trackIds.length}</span></button>)}</div>
      {active && <form className="playlist-create" key={active.id + active.name} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); state.renamePlaylist(active.id, String(data.get('playlistName'))); }}>
        <input name="playlistName" defaultValue={active.name} aria-label="修改歌单名称" maxLength={60}/><button>保存名称</button>
      </form>}
    </>}
    {tracks.length ? <TrackList tracks={tracks} playlistId={view === 'playlists' ? active?.id : undefined}/> : <div className="welcome-card"><h2>{view === 'library' ? '把喜欢的音乐带进来' : view === 'favorites' ? '留住你喜欢的歌' : '为一个时刻，建一张歌单'}</h2><p>{view === 'library' ? '从导航导入本地音频，文件会保存在浏览器中。' : '搜索结果中的爱心与歌单按钮，可以把音乐保存在这里。'}</p><button className="primary-action" onClick={() => state.setView('search')}>去找音乐</button>{view === 'library' && <button onClick={() => state.setNavOpen(true)}>导入本地音乐</button>}</div>}
  </section>;
}
