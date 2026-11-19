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
    <div className="collection-heading"><div><h1>{title}</h1><p className="subtle">{tracks.length} 首</p></div>{view === 'favorites' ? <Heart size={32}/> : <Library size={32}/>}</div>
    {view === 'playlists' && <>
      <form className="playlist-create" onSubmit={e => { e.preventDefault(); if (name.trim()) { state.createPlaylist(name); setName(''); } }}>
        <input aria-label="新歌单名称" placeholder="给新歌单起个名字" value={name} onChange={e => setName(e.target.value)} maxLength={60}/><button type="submit" disabled={!name.trim()}><Plus size={16}/>创建歌单</button>
      </form>
      <div className="playlist-tabs">{playlists.map(p => <button key={p.id} className={activeId === p.id ? 'selected' : ''} onClick={() => state.openPlaylist(p.id)}>{p.name} <span>{p.trackIds.length}</span></button>)}</div>
      {active && <form className="playlist-create" key={active.id + active.name} onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); state.renamePlaylist(active.id, String(data.get('playlistName'))); }}>
        <input name="playlistName" defaultValue={active.name} aria-label="修改歌单名称" maxLength={60}/><button>保存名称</button>
      </form>}
    </>}
    {tracks.length ? <TrackList tracks={tracks} playlistId={view === 'playlists' ? active?.id : undefined}/> : <div className="welcome-card"><h2>暂无歌曲</h2><button className="primary-action" onClick={() => state.setView('search')}>去找音乐</button>{view === 'library' && <button onClick={() => state.setNavOpen(true)}>导入本地音乐</button>}</div>}
  </section>;
}
