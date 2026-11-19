import { Dialog } from './Dialog';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { usePlayer, resolveTrack } from '../store/usePlayer';

export function QueuePanel() {
  const queue = usePlayer(s => s.queue);
  const index = usePlayer(s => s.currentIndex);
  const importedTracks = usePlayer(s => s.importedTracks);
  const remoteTracks = usePlayer(s => s.remoteTracks);
  const djActive = usePlayer(s => s.djActive);
  const djPlan = usePlayer(s => s.djPlan);
  const state = usePlayer.getState();
  return <Dialog label="播放队列" onClose={() => state.setQueueOpen(false)} backdropClass="queue-backdrop" panelClass="queue-panel glass">
    <div className="queue-head"><div><h2>{djActive ? djPlan?.label || '推荐歌单' : '接下来听'}</h2><p>{queue.length} 首</p></div><button title="关闭队列" onClick={() => state.setQueueOpen(false)}><X size={20}/></button></div>
    {queue.length ? <ol>{queue.map((id, i) => {
      const t = resolveTrack({ importedTracks, remoteTracks }, id);
      if (!t) return null;
      return <li key={id} className={i === index ? 'current' : ''} draggable onDragStart={e => e.dataTransfer.setData('text/plain', String(i))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const raw = e.dataTransfer.getData('text/plain'); const from = Number(raw); if (raw && Number.isInteger(from)) state.moveInQueue(from, i); }}>
        <button className="queue-track" title={`播放 ${t.title}`} onClick={() => state.playTrack(id)}><img src={t.cover} alt=""/><span><b>{t.title}{t.preview && <span className="vip-badge">试听</span>}</b><small>{t.artist}{i === index ? ' · 当前曲目' : ''}</small></span></button>
        <button title={`上移 ${t.title}`} disabled={i === 0} onClick={() => state.moveInQueue(i, i - 1)}><ArrowUp size={14}/></button>
        <button title={`下移 ${t.title}`} disabled={i === queue.length - 1} onClick={() => state.moveInQueue(i, i + 1)}><ArrowDown size={14}/></button>
        <button title={`移出队列 ${t.title}`} onClick={() => state.removeFromQueue(i)}><X size={14}/></button>
      </li>;
    })}</ol> : <div className="empty-tip">暂无歌曲</div>}
  </Dialog>;
}
