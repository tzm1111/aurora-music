import { Music2, Compass, Heart, Library, Sparkles, Plus, Radio, FileText, CloudDownload, X, Import } from 'lucide-react';
import { PLAYLISTS } from '../data/tracks';
import { usePlayer } from '../store/usePlayer';
import { useRef, useState } from 'react';
import type { Track } from '../types';
import { parseLRC } from '../lib/lrc';

export function Sidebar() {
  const addImported = usePlayer(s => s.addImportedTracks);
  const view = usePlayer(s => s.view);
  const setView = usePlayer(s => s.setView);
  const setLyrics = usePlayer(s => s.setLyrics);
  const pushMessage = usePlayer(s => s.pushMessage);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lrcRef = useRef<HTMLInputElement | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [, setImportCount] = useState(0);

  // ── 解析歌单文本 ──
  function parsePlaylistText(text: string): Track[] {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const tracks: Track[] = [];
    for (const line of lines) {
      // 跳过纯数字行、标题行
      if (/^\d+$/.test(line)) continue;
      if (line.startsWith('#') || line.startsWith('//')) continue;

      // 去除行号前缀："1. ", "01 ", "1、" 等
      const clean = line.replace(/^\d+[.、。 ]+/, '');

      let title = '';
      let artist = '未知艺术家';

      // 格式：歌名 - 艺术家 / 歌名 — 艺术家
      const dashMatch = clean.match(/^(.+?)\s*[\-—–]\s*(.+)$/);
      if (dashMatch) {
        title  = dashMatch[1].trim();
        artist = dashMatch[2].trim();
      } else {
        title = clean;
      }
      if (!title) continue;

      // 用 hash 生成稳定 ID 和封面
      const seed = hashStr(title + artist);
      const id = `nc_${seed}`;
      // 避免重复
      if (tracks.some(t => t.id === id)) continue;

      tracks.push({
        id,
        title,
        artist,
        cover: `https://picsum.photos/seed/${encodeURIComponent(title)}/600/600`,
        duration: 45,
        tags: ['imported', 'CN'],
      });
    }
    return tracks;
  }

  function hashStr(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  }

  const handlePlaylistImport = () => {
    const tracks = parsePlaylistText(importText);
    if (!tracks.length) {
      pushMessage({ id: `m${Date.now()}`, role: 'ai', text: '没解析到歌曲，请检查格式：每行一首，格式为「歌名 - 艺术家」' });
      return;
    }
    addImported(tracks);
    setImportCount(tracks.length);
    pushMessage({
      id: `m${Date.now()}`, role: 'ai',
      text: `🎵 已导入 ${tracks.length} 首歌曲到曲库！点击歌曲即可播放（使用本地合成音）`,
    });
    setImportText('');
    setShowImportModal(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newTracks: Track[] = files.map((f, i) => ({
      id: `local_${Date.now()}_${i}`,
      title: f.name.replace(/\.(mp3|m4a|wav|flac|ogg)$/i, ''),
      artist: '本地导入',
      cover: `https://picsum.photos/seed/${encodeURIComponent(f.name)}/600/600`,
      src: URL.createObjectURL(f),
      duration: 0,
      tags: ['local'],
    }));
    if (newTracks.length) addImported(newTracks);
    e.target.value = '';
  };

  const handleLRC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { queue, currentIndex } = usePlayer.getState();
    if (currentIndex < 0) {
      pushMessage({ id: `m${Date.now()}`, role: 'ai', text: '先选一首歌再导入歌词哦～' });
      return;
    }
    const text = await file.text();
    const lines = parseLRC(text);
    if (!lines.length) {
      pushMessage({ id: `m${Date.now()}`, role: 'ai', text: '没解析出有效的 LRC 时间戳，文件格式可能不对。' });
      return;
    }
    const trackId = queue[currentIndex];
    setLyrics(trackId, lines);
    pushMessage({ id: `m${Date.now()}`, role: 'ai', text: `🎼 歌词已导入：${file.name}（${lines.length} 行）` });
  };

  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brand-dot" />
        <span>Aurora Music</span>
      </div>

      <nav className="nav">
        <div className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}><Sparkles size={16}/> 今日推荐</div>
        <div className={`nav-item ${view === 'discover' ? 'active' : ''}`} onClick={() => setView('discover')}><Radio size={16}/> 发现 · 频谱</div>
        <div className="nav-item"><Compass size={16}/> 环球漫游</div>
        <div className="nav-item"><Music2 size={16}/> 全部曲库</div>
        <div className="nav-item"><Heart size={16}/> 我的收藏</div>
        <div className="nav-item"><Library size={16}/> 我的歌单</div>
      </nav>

      <div className="section-title">歌单</div>
      <div className="nav" style={{ overflow: 'auto', flex: 1 }}>
        {PLAYLISTS.map(p => (
          <div key={p.id} className="playlist-item">
            <span style={{
              width: 22, height: 22, borderRadius: 6,
              background: `url(${p.cover}) center/cover`,
            }} />
            {p.name}
          </div>
        ))}
      </div>

      <button className="import-btn" style={{background:'rgb(var(--accent)/0.18)',borderColor:'rgb(var(--accent)/0.4)'}} onClick={() => setShowImportModal(true)}>
        <CloudDownload size={16}/> 导入文字歌单
      </button>
      <button className="import-btn" onClick={() => fileRef.current?.click()}>
        <Plus size={16}/> 导入本地 MP3
      </button>
      <button className="import-btn lrc-btn" onClick={() => lrcRef.current?.click()} title="为当前播放的歌曲导入 .lrc 歌词">
        <FileText size={16}/> 导入 LRC 歌词
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleImport}
        style={{ display: 'none' }}
      />
      <input
        ref={lrcRef}
        type="file"
        accept=".lrc,text/plain"
        onChange={handleLRC}
        style={{ display: 'none' }}
      />
      {/* 文字歌单导入 Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <Import size={16}/> 导入文字歌单
              <button className="modal-close" onClick={() => setShowImportModal(false)}><X size={14}/></button>
            </div>
            <p className="modal-tip">
              从网易云 / 其他平台复制歌单文字，每行一首，支持：<br/>
              <code>歌名 - 艺术家</code> 或 <code>1. 歌名 - 艺术家</code>
            </p>
            <textarea
              className="modal-textarea"
              placeholder={"示例：\n1. 晴天 - 周杰伦\n2. 我记得 - 赵雷\n告白气球 - 周杰伦"}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              rows={10}
            />
            <div className="modal-footer">
              <span className="modal-hint">
                {importText ? `已识别约 ${parsePlaylistText(importText).length} 首` : '粘贴歌单文字'}
              </span>
              <button className="modal-ok" onClick={handlePlaylistImport}>导入曲库</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
