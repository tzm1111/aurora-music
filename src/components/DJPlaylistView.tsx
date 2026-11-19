import { useState } from 'react';
import { ArrowLeft, ChevronRight, ListMusic, Play, Sparkles } from 'lucide-react';
import { usePlayer, resolveTrack } from '../store/usePlayer';
import { TrackList } from './TrackList';
import type { Track } from '../types';
import { selectDiverseTracks } from '../../shared/djDiversity.js';

export function DJPlaylistView() {
  const playlists = usePlayer(s => s.djPlaylists);
  const remoteTracks = usePlayer(s => s.remoteTracks);
  const importedTracks = usePlayer(s => s.importedTracks);
  const [selected, setSelected] = useState<string | null>(null);
  const playlist = playlists.find(p => p.id === selected);
  const savedTracks = (item: typeof playlists[number]) => selectDiverseTracks(item.trackIds.map(id => resolveTrack({ remoteTracks, importedTracks }, id)).filter((t): t is Track => Boolean(t)), { limit: item.trackIds.length, maxPerArtist: item.plan.artistFocus ? item.trackIds.length : 2 });
  const tracks = playlist ? savedTracks(playlist) : [];
  return <section className="main collection-view glass-soft dj-history-view">
    <button className="dj-history-back" onClick={() => playlist ? setSelected(null) : usePlayer.getState().setView('home')}><ArrowLeft size={16}/>{playlist ? '全部 DJ 歌单' : '返回'}</button>
    {playlist && tracks[0] && <img className="dj-detail-cover" src={tracks[0].cover} alt=""/>}
    <div className="collection-heading"><div><h1>{playlist?.name || 'DJ 歌单'}</h1><p className="subtle">{playlist ? `${new Date(playlist.createdAt).toLocaleString('zh-CN')} · ${tracks.length} 首` : `${playlists.length} 张`}</p></div><Sparkles size={28}/></div>
    {playlist ? <>
      <button className="primary-action dj-history-play" disabled={!tracks.length} onClick={() => usePlayer.getState().playTrack(tracks[0].id, tracks.map(t => t.id))}><Play size={16}/>播放歌单</button>
      <TrackList tracks={tracks}/>
    </> : playlists.length ? <div className="dj-history-list">{playlists.map(p => {
      const first = resolveTrack({ remoteTracks, importedTracks }, p.trackIds[0]);
      return <button key={p.id} className="dj-history-card" onClick={() => setSelected(p.id)}>
        {first ? <img src={first.cover} alt=""/> : <ListMusic size={30}/>}
        <span><b>{p.name}</b><small>{new Date(p.createdAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {savedTracks(p).length} 首</small></span><ChevronRight size={18}/>
      </button>;
    })}</div> : <div className="welcome-card"><h2>暂无歌单</h2><button className="primary-action" onClick={() => usePlayer.getState().setView('home')}>让 DJ 选歌</button></div>}
  </section>;
}
