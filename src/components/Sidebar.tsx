import { Dialog } from './Dialog';
import { Music2, Heart, Library, Sparkles, Plus, Radio, FileText, X, Import } from 'lucide-react';
import { usePlayer } from '../store/usePlayer';
import { useRef, useState, useEffect } from 'react';
import type { Track } from '../types';
import { parseLRC } from '../lib/lrc';
import { saveAudioFile } from '../lib/localLibrary';
import { searchTracks } from '../services/api';
import localCover from '../assets/hero.png';

type MatchRow = { query: string; candidates: Track[]; selected: string; error?: string };
export function Sidebar({ desktop = false }: { desktop?: boolean }) {
  const view = usePlayer(s => s.view);
  const playlists = usePlayer(s => s.playlists);
  const favorites = usePlayer(s => s.favoriteIds);
  const fileRef = useRef<HTMLInputElement>(null);
  const lrcRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => () => requestRef.current?.abort(), []);
  const state = () => usePlayer.getState();
  const closeModal = () => { requestRef.current?.abort(); setBusy(false); setShowImportModal(false); };
  const matchPlaylist = async () => {
    const lines = [...new Set(importText.split('\n').map(line => line.trim().replace(/^\d+[.、。 ]+/, '')).filter(line => line && !line.startsWith('#')))];
    if (!lines.length) return;
    if (lines.length > 20) { setNotice('每次最多匹配 20 首，请分批导入。'); return; }
    requestRef.current?.abort();
    const ctrl = new AbortController(); requestRef.current = ctrl;
    setBusy(true); setMatches([]); setNotice('正在搜索原曲，完成后请选择对应版本。');
    const rows: MatchRow[] = [];
    for (const query of lines) {
      if (ctrl.signal.aborted) return;
      try {
        const result = await searchTracks('netease', query.replace(/\s+[—–-]\s+/g, ' '), 5, ctrl.signal);
        rows.push({ query, candidates: result.tracks, selected: '' });
      } catch (error) {
        if (ctrl.signal.aborted) return;
        rows.push({ query, candidates: [], selected: '', error: error instanceof Error ? error.message : '匹配失败' });
      }
      if (ctrl.signal.aborted) return;
      setMatches([...rows]); setNotice(`已匹配 ${rows.length} / ${lines.length} 首，请确认歌曲与歌手。`);
    }
    setBusy(false);
  };
  const confirmMatches = () => {
    const tracks = matches.flatMap(row => row.candidates.filter(t => t.id === row.selected));
    if (!tracks.length) return;
    state().registerRemoteTracks(tracks);
    const id = state().createPlaylist('导入的歌单');
    tracks.forEach(t => state().addToPlaylist(id, t.id));
    setShowImportModal(false); state().openPlaylist(id);
  };
  const importFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    setBusy(true); setNotice('正在保存音频文件…');
    const tracks: Track[] = [];
    for (const file of files) {
      const id = `local_${crypto.randomUUID()}`;
      try {
        await saveAudioFile(id, file);
        tracks.push({ id, title: file.name.replace(/\.(mp3|m4a|wav|flac|ogg)$/i, ''), artist: '本地导入',
          cover: localCover, src: URL.createObjectURL(file), duration: 0, source: 'local', tags: ['local'] });
      } catch {
        usePlayer.setState({ storageError: '音频文件未能保存，请检查浏览器存储空间后重新导入。' });
        break;
      }
    }
    if (tracks.length) { state().addImportedTracks(tracks); state().setView('library'); }
    setNotice(`已保存 ${tracks.length} 首本地音乐`); setBusy(false);
  };
  const importLyrics = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const s = state();
    if (s.currentIndex < 0) { setNotice('请先选择要导入歌词的歌曲。'); return; }
    const lines = parseLRC(await file.text());
    if (!lines.length) { setNotice('文件没有有效的 LRC 时间戳。'); return; }
    s.setLyrics(s.queue[s.currentIndex], lines); setNotice(`已导入 ${lines.length} 行歌词`);
  };
  const nav = [
    { id: 'home' as const, label: '专属 DJ', Icon: Sparkles },
    { id: 'search' as const, label: '手动找歌', Icon: Music2 },
    { id: 'discover' as const, label: '发现 · 频谱', Icon: Radio },
    { id: 'djplaylists' as const, label: 'AI DJ 歌单', Icon: Sparkles },
    { id: 'library' as const, label: '我的曲库', Icon: Music2 },
    { id: 'favorites' as const, label: `我的收藏 · ${favorites.length}`, Icon: Heart },
    { id: 'playlists' as const, label: '我的歌单', Icon: Library },
  ];
  return <aside className="sidebar glass">
    <div className="brand"><div className="brand-dot"/><span>{desktop ? '你的音乐库' : 'Aurora Music'}</span></div>
    <nav className="nav">{nav.filter(item => !desktop || !['home', 'search', 'discover'].includes(item.id)).map(({ id, label, Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => state().setView(id)}><Icon size={16}/>{label}</button>)}</nav>
    <div className="section-title">歌单</div>
    <div className="nav" style={{ overflow: 'auto', flex: 1 }}>{playlists.length ? playlists.map(p => <button key={p.id} className="playlist-item" onClick={() => state().openPlaylist(p.id)}><Library size={16}/>{p.name}<small>{p.trackIds.length}</small></button>) : <p className="subtle">把喜欢的歌加入一张歌单。</p>}</div>
    {notice && <p className="import-notice" role="status">{notice}</p>}
    <button className="import-btn" onClick={() => { setShowImportModal(true); setNotice(''); }}><Import size={16}/>导入文字歌单</button>
    <button className="import-btn" disabled={busy} onClick={() => fileRef.current?.click()}><Plus size={16}/>{busy ? '正在处理…' : '导入本地音频'}</button>
    <button className="import-btn" onClick={() => lrcRef.current?.click()}><FileText size={16}/>导入 LRC 歌词</button>
    <input ref={fileRef} type="file" accept="audio/*" multiple onChange={importFiles} hidden/>
    <input ref={lrcRef} type="file" accept=".lrc,text/plain" onChange={importLyrics} hidden/>
    {showImportModal && <Dialog label="导入文字歌单" onClose={closeModal} backdropClass="modal-overlay" panelClass="modal-box">
      <div className="modal-head"><Import size={16}/>导入文字歌单<button title="关闭导入" className="modal-close" onClick={closeModal}><X size={16}/></button></div>
      <p className="modal-tip">每行一首「歌名 - 歌手」。先搜索原曲，再确认版本；不会用合成音替代歌曲。</p>
      <textarea className="modal-textarea" aria-label="歌单文字" value={importText} onChange={e => { setImportText(e.target.value); setMatches([]); }} disabled={busy} placeholder={'晴天 - 周杰伦\nRunaway - Kanye West'} rows={4}/>
      {notice && <p className="subtle" role="status">{notice}</p>}
      <div className="match-list">{matches.map((row, i) => <label key={row.query}><b>{row.query}</b>{row.candidates.length ? <select aria-label={`确认原曲 ${row.query}`} value={row.selected} onChange={e => setMatches(rows => rows.map((r, n) => n === i ? { ...r, selected: e.target.value } : r))}>
        <option value="">跳过 / 请选择原曲</option>{row.candidates.map(t => <option key={t.id} value={t.id}>{t.title} · {t.artist} · {t.album}</option>)}</select> : <span>{row.error ?? '没有找到原曲，可修改文字后重新匹配'}</span>}</label>)}</div>
      <div className="modal-footer"><button className="modal-ok" disabled={busy || !importText.trim()} onClick={matchPlaylist}>{busy ? '正在匹配…' : '搜索原曲'}</button><button className="modal-ok" disabled={busy || !matches.some(row => row.selected)} onClick={confirmMatches}>确认导入 {matches.filter(row => row.selected).length} 首</button></div>
    </Dialog>}
  </aside>;
}
