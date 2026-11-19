import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { ArrowUpRight, LoaderCircle, Settings2, Mic, Square, ListMusic, ChevronRight, ChevronDown, Play, Pause, Sparkles, CircleAlert, Keyboard, AudioLines, Sun, Cloud, CloudRain, Snowflake, Moon, Clock3 } from 'lucide-react';
import { usePlayer, resolveTrack } from '../store/usePlayer';
import { startDJ, startContextDJ } from '../lib/djController';
import { useContextPlaylist } from '../lib/useContextPlaylist';
import { API_BASE, ONLINE_PLAYER_URL, apiRequest } from '../services/api';
import { ModelDialog } from './ModelDialog';
import { startVoiceInput } from '../lib/voiceInput';
import type { VoiceSession, VoicePhase } from '../lib/voiceInput';
import { useVisualMotion } from '../lib/useVisualMotion';

const SCENES = ['放松一下', '专注工作', '提提精神', '陪我入睡'];
const moodDescription = (x: number, y: number) => `${y > 55 ? '明亮愉悦' : y < 45 ? '沉静内敛' : '平和舒适'}，${x > 60 ? '节奏动感，有活力' : x < 40 ? '轻柔舒缓，节奏慢一些' : '节奏适中'}的音乐`;

export function DJHome() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState(false);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const listening = voicePhase === 'listening';
  const voiceActive = voicePhase !== 'idle';
  const [voiceError, setVoiceError] = useState('');
  const [mood, setMood] = useState({ x: 35, y: 60 });
  const [moodOpen, setMoodOpen] = useState(false);
  const voice = useRef<VoiceSession | null>(null);
  const contextRequested = useRef(false);
  const composer = useRef<HTMLInputElement>(null);
  const active = usePlayer(s => s.djActive);
  const playing = usePlayer(s => s.isPlaying);
  const playbackStatus = usePlayer(s => s.playbackStatus);
  const busy = usePlayer(s => s.djBusy);
  const error = usePlayer(s => s.djError);
  const plan = usePlayer(s => s.djPlan);
  const mode = usePlayer(s => s.djMode);
  const queue = usePlayer(s => s.queue);
  const index = usePlayer(s => s.currentIndex);
  const importedTracks = usePlayer(s => s.importedTracks);
  const remoteTracks = usePlayer(s => s.remoteTracks);
  const histories = usePlayer(s => s.djPlaylists);
  const current = resolveTrack({ importedTracks, remoteTracks }, queue[index]);
  const upcoming = queue.slice(Math.max(0, index + 1), Math.max(0, index + 1) + 3);
  const animate = useVisualMotion(true);
  const orbitMotion = useVisualMotion(true);
  const status = voicePhase === 'starting' ? '开启麦克风…' : listening ? '正在听' : busy ? '选歌中…' : active ? plan?.label || '专属频道' : '想听什么？';
  const direction = moodDescription(mood.x, mood.y);
  const contextMix = useContextPlaylist();
  const ContextIcon = contextMix.context.weather ? ({ sunny: Sun, cloudy: Cloud, rainy: CloudRain, snowy: Snowflake, night: Moon })[contextMix.context.weather] : Clock3;
  const playContext = async () => {
    contextRequested.current = true;
    voice.current?.abort(); setVoicePhase('idle'); setVoiceError('');
    const draft = text;
    if (await startContextDJ()) { setText(value => value === draft ? '' : value); setMoodOpen(false); }
  };
  useEffect(() => () => voice.current?.abort(), []);
  const record = () => {
    if (voiceActive) { voice.current?.stop(); return; }
    voice.current?.abort(); setVoiceError('');
    const prefix = text.trim();
    voice.current = startVoiceInput({ onText: value => setText([prefix, value].filter(Boolean).join('，').slice(0, 300)), onListening: () => {}, onPhase: setVoicePhase, onError: setVoiceError });
  };
  useEffect(() => {
    const update = () => apiRequest<{ available: boolean }>('/api/dj/status').then(data => setModelAvailable(data.available)).catch(() => setModelAvailable(false));
    void update(); window.addEventListener('aurora-connections', update);
    return () => window.removeEventListener('aurora-connections', update);
  }, []);
  const submit = async (description: string) => {
    contextRequested.current = false;
    voice.current?.abort(); setVoicePhase('idle'); setVoiceError('');
    const draft = text;
    const success = await startDJ(description, active);
    if (success) { setText(value => value === draft ? '' : value); setMoodOpen(false); }
    else setText(value => value || description);
  };
  const moveMood = (event: PointerEvent<HTMLDivElement>) => {
    if (busy || voiceActive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setMood({ x: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))), y: Math.round(Math.max(0, Math.min(100, 100 - (event.clientY - rect.top) / rect.height * 100))) });
  };
  return <section className={`dj-studio ${active ? 'has-session' : ''} ${animate ? 'motion-on' : ''} ${orbitMotion ? 'orbits-on' : ''} ${listening ? 'is-listening' : busy ? 'is-thinking' : 'is-ready'}`}>
    <header className="studio-toolbar"><span className="studio-brand">AI DJ</span><div className="studio-tools"><button className="studio-history" onClick={() => usePlayer.getState().setView('djplaylists')} aria-label={`DJ 歌单，${histories.length} 张`} title="DJ 歌单"><ListMusic size={17}/>歌单</button><button className="studio-settings" onClick={() => setSettings(true)} aria-label="AI 设置" title={modelAvailable && mode !== 'rules' ? 'AI 已连接' : 'AI 设置'}><Settings2 size={17}/><i className={modelAvailable ? 'connected' : ''}/></button></div></header>
    <div className="studio-layout">
      <section className="studio-presence" aria-label="与 DJ 对话">
        <div className="presence-scene">
          <div className="presence-aura" aria-hidden="true"/>

          <div className="presence-orbit solar-system" aria-hidden="true">{[1, 2, 3].map(i => <div key={i} className={`solar-lane solar-lane-${i}`}><div className="solar-revolution"><span className="solar-planet"/></div></div>)}</div>
          <button className="presence-orb" disabled={busy} onClick={record} aria-label={voicePhase === 'starting' ? '取消开启麦克风' : listening ? '结束语音输入' : '和 DJ 说话'} aria-pressed={voiceActive}>
            <span className="presence-fluid fluid-one"/><span className="presence-fluid fluid-two"/><span className="presence-fluid fluid-three"/>
            <span className="presence-voice">{listening ? <span className="voice-bars" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i}/>)}</span> : busy || voicePhase === 'starting' ? <LoaderCircle size={30} className="spin"/> : <AudioLines size={36} strokeWidth={1.3}/>}</span>
          </button>
        </div>
        <h1 aria-live="polite">{status}</h1>
        <form className="studio-composer" onSubmit={e => { e.preventDefault(); if (!busy && !voiceActive && text.trim()) void submit(text.trim()); }}>
          <input ref={composer} aria-label="告诉 DJ 当前心情" value={text} onChange={e => setText(e.target.value)} readOnly={voiceActive} maxLength={300} placeholder={voiceActive ? '…' : active ? '换个氛围…' : '说说此刻的心情…'}/>
          <button type="button" className={`composer-mic ${voiceActive ? 'active' : ''}`} disabled={busy} onClick={record} aria-label={voicePhase === 'starting' ? '取消开启麦克风' : listening ? '结束语音输入' : '语音输入'} aria-pressed={voiceActive} title="语音输入">{voicePhase === 'starting' ? <LoaderCircle size={18} className="spin"/> : listening ? <Square size={16}/> : <Mic size={19}/>}</button>
          <button type="submit" disabled={busy || voiceActive || !text.trim()} aria-label={active ? '提交音乐调整' : '提交心情'}><ArrowUpRight size={19}/></button>
        </form>
        {voiceError && <div className="studio-feedback compact-feedback"><details><summary aria-label="查看语音错误详情"><CircleAlert size={16}/></summary><p>{voiceError}</p></details><button className="voice-keyboard" onClick={() => composer.current?.focus()}><Keyboard size={15}/>键盘语音</button></div>}
        <button className="context-mix" disabled={busy || voiceActive} onClick={playContext} aria-label={`播放此刻歌单：${contextMix.name}`}>
          <span className="context-mix-icon"><ContextIcon size={20} strokeWidth={1.5}/></span>
          <span className="context-mix-copy"><small>此刻 · {contextMix.timeLabel}</small><b>{contextMix.title}</b></span>
          {busy && plan?.context ? <LoaderCircle size={17} className="spin"/> : <Play size={16} fill="currentColor"/>}
        </button>
        <div className="studio-scenes">{(active ? ['更安静', '更有活力', '换一批'] : SCENES).map(scene => <button key={scene} disabled={busy || voiceActive} onClick={() => submit(scene)}>{scene}</button>)}</div>
      </section>
      <aside className="studio-side">
        {active && current && <section className="studio-session" aria-label="DJ 推荐歌单">
          <header><span><ListMusic size={15}/>推荐歌单</span><button onClick={() => usePlayer.getState().setQueueOpen(true)} aria-label="查看完整推荐歌单">{queue.length} 首<ChevronRight size={15}/></button></header>
          <div className="session-current"><button className="session-cover" aria-label={`展开播放器：${current.title}`} onClick={() => usePlayer.getState().setNowPlayingOpen(true)}><img src={current.cover} alt=""/></button><div><h2>{current.title}</h2><p>{current.artist}</p>{current.preview && <small>试听</small>}</div><button className="session-play" onClick={() => usePlayer.getState().togglePlay()} aria-label={playing ? '暂停 DJ 播放' : '继续 DJ 播放'}>{playbackStatus === 'loading' || playbackStatus === 'buffering' ? <LoaderCircle size={17} className="spin"/> : playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button></div>
          <ol>{upcoming.map(id => { const track = resolveTrack({ importedTracks, remoteTracks }, id); return track ? <li key={id}><button onClick={() => usePlayer.getState().playTrack(id)} aria-label={`播放 ${track.title}`}><img src={track.cover} alt=""/><span><b>{track.title}</b><small>{track.artist}{track.preview ? ' · 试听' : ''}</small></span><Play size={13}/></button></li> : null; })}</ol>
        </section>}
        <section className={`studio-mood ${moodOpen ? 'is-open' : ''}`} aria-label="心情坐标">
          <button className="mood-toggle" aria-expanded={moodOpen} aria-controls="dj-mood-controls" onClick={() => setMoodOpen(v => !v)}><span><Sparkles size={15}/>氛围</span><ChevronDown size={15}/></button>
          <div id="dj-mood-controls" hidden={!moodOpen}>
          <div className="mood-map" role="group" aria-label="拖动选择音乐氛围，或使用下方滑块" onPointerDown={e => { if (!busy && !voiceActive) { e.currentTarget.setPointerCapture(e.pointerId); moveMood(e); } }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) moveMood(e); }} style={{ '--mood-x': `${mood.x}%`, '--mood-y': `${100 - mood.y}%` } as CSSProperties}>
            <div className="mood-grid"/><span className="mood-axis axis-top">明亮</span><span className="mood-axis axis-bottom">沉静</span><span className="mood-axis axis-left">轻柔</span><span className="mood-axis axis-right">动感</span><span className="mood-glow"/><span className="mood-point"/>
          </div>
          <div className="mood-accessible"><label>音乐动感<input type="range" min="0" max="100" value={mood.x} disabled={busy || voiceActive} onChange={e => setMood(v => ({ ...v, x: Number(e.target.value) }))}/></label><label>心情明亮<input type="range" min="0" max="100" value={mood.y} disabled={busy || voiceActive} onChange={e => setMood(v => ({ ...v, y: Number(e.target.value) }))}/></label></div>
          <div className="mood-selection"><span>{mood.y > 55 ? '明亮' : mood.y < 45 ? '沉静' : '平和'} · {mood.x > 60 ? '动感' : mood.x < 40 ? '轻柔' : '适中'}</span><button disabled={busy || voiceActive} onClick={() => submit(direction)}>{active ? '调整' : '开始'}<ArrowUpRight size={15}/></button></div>
          </div>
        </section>
      </aside>
    </div>
    {error && <div className="studio-error compact-feedback"><details><summary aria-label="查看推荐错误详情"><CircleAlert size={16}/></summary><p>{error}</p></details><button disabled={busy} onClick={() => contextRequested.current ? playContext() : submit(text.trim() || plan?.description || direction)}>重试</button>{API_BASE && <a href={ONLINE_PLAYER_URL} target="_blank" rel="noopener noreferrer">打开魔搭完整版</a>}</div>}
    {settings && <ModelDialog onClose={() => setSettings(false)}/>}
  </section>;
}
