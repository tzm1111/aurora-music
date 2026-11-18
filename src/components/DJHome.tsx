import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { AudioLines, ArrowUpRight, LoaderCircle, Settings2, Mic, Square, ListMusic, ChevronRight, ChevronDown, Play, Pause, Sparkles } from 'lucide-react';
import { usePlayer, resolveTrack } from '../store/usePlayer';
import { startDJ } from '../lib/djController';
import { apiRequest } from '../services/api';
import { ModelDialog } from './ModelDialog';
import { startVoiceInput } from '../lib/voiceInput';
import type { VoiceSession } from '../lib/voiceInput';
import { useVisualMotion } from '../lib/useVisualMotion';

const SCENES = ['放松一下', '专注工作', '提提精神', '陪我入睡'];
const moodDescription = (x: number, y: number) => `${y > 55 ? '明亮愉悦' : y < 45 ? '沉静内敛' : '平和舒适'}，${x > 60 ? '节奏动感，有活力' : x < 40 ? '轻柔舒缓，节奏慢一些' : '节奏适中'}的音乐`;

export function DJHome() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState(false);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [mood, setMood] = useState({ x: 35, y: 60 });
  const [moodOpen, setMoodOpen] = useState(false);
  const voice = useRef<VoiceSession | null>(null);
  const active = usePlayer(s => s.djActive);
  const playing = usePlayer(s => s.isPlaying);
  const playbackStatus = usePlayer(s => s.playbackStatus);
  const busy = usePlayer(s => s.djBusy);
  const error = usePlayer(s => s.djError);
  const plan = usePlayer(s => s.djPlan);
  const mode = usePlayer(s => s.djMode);
  const queue = usePlayer(s => s.queue);
  const index = usePlayer(s => s.currentIndex);
  const notice = usePlayer(s => s.djRefillNotice);
  const importedTracks = usePlayer(s => s.importedTracks);
  const remoteTracks = usePlayer(s => s.remoteTracks);
  const histories = usePlayer(s => s.djPlaylists);
  const current = resolveTrack({ importedTracks, remoteTracks }, queue[index]);
  const upcoming = queue.slice(Math.max(0, index + 1), Math.max(0, index + 1) + 3);
  const animate = useVisualMotion(listening || busy || playing);
  const orbitMotion = useVisualMotion(true);
  const status = listening ? '正在听你说' : busy ? '正在挑选下一段音乐' : active ? playing ? '陪你听，继续为你选歌' : '音乐已暂停，随时继续' : '此刻，想听什么？';
  const direction = moodDescription(mood.x, mood.y);
  useEffect(() => () => voice.current?.abort(), []);
  const record = () => {
    if (listening) { voice.current?.stop(); return; }
    voice.current?.abort(); setVoiceError('');
    const prefix = text.trim();
    voice.current = startVoiceInput({ onText: value => setText([prefix, value].filter(Boolean).join('，').slice(0, 300)), onListening: setListening, onError: setVoiceError });
  };
  useEffect(() => {
    const update = () => apiRequest<{ available: boolean }>('/api/dj/status').then(data => setModelAvailable(data.available)).catch(() => setModelAvailable(false));
    void update(); window.addEventListener('aurora-connections', update);
    return () => window.removeEventListener('aurora-connections', update);
  }, []);
  const submit = async (description: string) => {
    voice.current?.abort(); setListening(false); setVoiceError('');
    const draft = text;
    const success = await startDJ(description, active);
    if (success) { setText(value => value === draft ? '' : value); setMoodOpen(false); }
    else setText(value => value || description);
  };
  const moveMood = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || listening) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setMood({ x: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))), y: Math.round(Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100))) });
  };
  return <section className={`dj-studio ${active ? 'has-session' : ''} ${animate ? 'motion-on' : ''} ${orbitMotion ? 'orbits-on' : ''} ${listening ? 'is-listening' : busy ? 'is-thinking' : 'is-ready'}`}>
    <header className="studio-toolbar"><span className="studio-brand"><span/>AURORA <small> / 专属 DJ</small></span><button className="studio-history" onClick={() => usePlayer.getState().setView('djplaylists')}><ListMusic size={16}/>DJ 歌单{histories.length > 0 && <span>{histories.length}</span>}<ChevronRight size={14}/></button></header>
    <div className="studio-layout">
      <section className="studio-presence" aria-label="与 DJ 对话">
        <div className="presence-caption"><span className="presence-dot"/>{status}</div>
        <div className="presence-scene">
          <div className="presence-aura" aria-hidden="true"/>
          <div className="presence-orbit solar-system" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} className={`solar-lane solar-lane-${i}`}><div className="solar-revolution"><span className="solar-planet"/></div></div>)}</div>
          <button className="presence-orb" disabled={busy} onClick={record} aria-label={listening ? '结束语音输入' : '和 DJ 说话'} aria-pressed={listening}>
            <span className="presence-fluid fluid-one"/><span className="presence-fluid fluid-two"/><span className="presence-fluid fluid-three"/>
            <span className="presence-voice">{listening ? <span className="voice-bars" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i}/>)}</span> : busy ? <LoaderCircle size={34} className="spin"/> : <AudioLines size={36} strokeWidth={1.3}/>}</span>
          </button>
          <span className="presence-coordinate coordinate-left" aria-hidden="true">YOUR MOOD</span><span className="presence-coordinate coordinate-right" aria-hidden="true">YOUR SOUND</span>
        </div>
        <h1>{listening ? '我在听。' : busy ? '让音乐接住此刻。' : active ? plan?.label || '这一段，为你而选。' : <>你的心情，<br/>我来配乐。</>}</h1>
        <p className="presence-description">{listening ? '说说心情，或告诉我想怎么调整。' : active ? plan?.intro : '不必想歌名，把这一刻交给我。'}</p>
        <button className="presence-talk" disabled={busy} onClick={record}>{listening ? <Square size={14}/> : <Mic size={16}/>} {listening ? '说完了' : '点光球，和我说说'}<span>{listening ? '结束后确认文字' : '也可以在下方打字'}</span></button>
        <form className="studio-composer" onSubmit={e => { e.preventDefault(); if (!busy && !listening && text.trim()) void submit(text.trim()); }}>
          <input aria-label="告诉 DJ 当前心情" value={text} onChange={e => setText(e.target.value)} readOnly={listening} maxLength={300} placeholder={listening ? '你的话会显示在这里…' : active ? '比如：更安静一点，不要现场版…' : '比如：刚下班，想让脑袋放空…'}/>
          <button type="submit" disabled={busy || listening || !text.trim()} aria-label={active ? '提交音乐调整' : '提交心情'}><ArrowUpRight size={19}/></button>
        </form>
        <div className="studio-feedback" aria-live="polite">{voiceError ? <p role="alert">{voiceError}</p> : listening ? <p>正在转写，结束后点击箭头确认。</p> : busy ? <p>{active ? '当前音乐照常播放，新的推荐马上接上。' : '正在寻找符合这个氛围的歌曲…'}</p> : null}</div>
      </section>
      <aside className="studio-side">
        {active && current && <section className="studio-session" aria-label="DJ 推荐歌单">
          <header><span><span className="session-dot"/>这一刻在听</span><button onClick={() => usePlayer.getState().setQueueOpen(true)} aria-label="查看完整推荐歌单">{queue.length} 首<ChevronRight size={15}/></button></header>
          <div className="session-current"><button className="session-cover" aria-label={`展开播放器：${current.title}`} onClick={() => usePlayer.getState().setNowPlayingOpen(true)}><img src={current.cover} alt=""/></button><div><h2>{current.title}</h2><p>{current.artist}</p><small>{playbackStatus === 'loading' || playbackStatus === 'buffering' ? '正在加载…' : playbackStatus === 'error' ? '暂时无法播放，可换一首' : playing ? '正在播放' : '已暂停'}{current.preview ? ' · 试听' : ''}</small></div><button className="session-play" onClick={() => usePlayer.getState().togglePlay()} aria-label={playing ? '暂停 DJ 播放' : '继续 DJ 播放'}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button></div>
          <div className="session-next-label">接下来，我为你选了</div><ol>{upcoming.map(id => { const track = resolveTrack({ importedTracks, remoteTracks }, id); return track ? <li key={id}><button onClick={() => usePlayer.getState().playTrack(id)} aria-label={`播放 ${track.title}`}><img src={track.cover} alt=""/><span><b>{track.title}</b><small>{track.artist}{track.preview ? ' · 试听' : ''}</small></span><Play size={13}/></button></li> : null; })}</ol>
          <p className="session-note" role="status">{notice || '下一段音乐，我会自动接上。'}</p>
        </section>}
        <section className="studio-mood" aria-label="心情坐标">
          {active ? <button className="mood-toggle" aria-expanded={moodOpen} aria-controls="dj-mood-controls" onClick={() => setMoodOpen(v => !v)}><span><Sparkles size={15}/>把氛围调到刚刚好</span><ChevronDown size={15}/></button> : <header><span><Sparkles size={15}/>不想说话？让心情带路</span><small>拖动光点</small></header>}
          <div id="dj-mood-controls" hidden={active && !moodOpen}>
          <div className="mood-map" role="group" aria-label="拖动选择音乐氛围，或使用下方滑块" onPointerDown={e => { if (!busy && !listening) { e.currentTarget.setPointerCapture(e.pointerId); moveMood(e); } }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) moveMood(e); }} style={{ '--mood-x': `${mood.x}%`, '--mood-y': `${100 - mood.y}%` } as CSSProperties}>
            <div className="mood-grid"/><span className="mood-axis axis-top">明亮</span><span className="mood-axis axis-bottom">沉静</span><span className="mood-axis axis-left">轻柔</span><span className="mood-axis axis-right">动感</span><span className="mood-glow"/><span className="mood-point"/>
          </div>
          <div className="mood-accessible"><label>音乐动感<input type="range" min="0" max="100" value={mood.x} disabled={busy || listening} onChange={e => setMood(v => ({ ...v, x: Number(e.target.value) }))}/></label><label>心情明亮<input type="range" min="0" max="100" value={mood.y} disabled={busy || listening} onChange={e => setMood(v => ({ ...v, y: Number(e.target.value) }))}/></label></div>
          <div className="mood-selection"><span>{mood.y > 55 ? '明亮' : mood.y < 45 ? '沉静' : '平和'} · {mood.x > 60 ? '动感' : mood.x < 40 ? '轻柔' : '适中'}</span><button disabled={busy || listening} onClick={() => submit(direction)}>{active ? '按这个氛围调整' : '就从这里开始'}<ArrowUpRight size={15}/></button></div>
          </div>
        </section>
        <div className="studio-scenes">{(active ? ['更安静一点', '更有活力', '换一批'] : SCENES).map(scene => <button key={scene} disabled={busy || listening} onClick={() => submit(scene)}>{scene}<ArrowUpRight size={12}/></button>)}</div>
      </aside>
    </div>
    {error && <div className="studio-error" role="alert">{error}<button disabled={busy} onClick={() => submit(text.trim() || plan?.description || direction)}>再试一次</button></div>}
    <footer className="studio-footer"><span>{active ? '专属频道 · 自动续播' : '随心开场 · 连续播放'}</span><button onClick={() => setSettings(true)}><Settings2 size={13}/>{modelAvailable ? active && mode === 'rules' ? '场景推荐 · AI 暂时不可用' : 'AI 已连接' : '场景推荐 · 连接 AI'}<ChevronRight size={12}/></button></footer>
    {settings && <ModelDialog onClose={() => setSettings(false)}/>}
  </section>;
}
