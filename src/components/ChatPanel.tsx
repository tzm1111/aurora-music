import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { usePlayer } from '../store/usePlayer';
import { recommendByText } from '../lib/recommend';
import { trackById } from '../data/tracks';
import type { ChatMessage } from '../types';

const SUGGESTS = [
  '推荐点雨天的歌',
  '想专注工作',
  '失恋了想哭一下',
  '助眠温柔的',
  '日系下午茶',
  '动感跑步歌单',
];

export function ChatPanel() {
  const messages = usePlayer(s => s.messages);
  const push = usePlayer(s => s.pushMessage);
  const playTrack = usePlayer(s => s.playTrack);
  const [text, setText] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 999999, behavior: 'smooth' });
  }, [messages.length]);

  const send = (raw?: string) => {
    const q = (raw ?? text).trim();
    if (!q) return;
    setText('');
    const userMsg: ChatMessage = { id: 'u' + Date.now(), role: 'user', text: q };
    push(userMsg);
    setTimeout(() => {
      const picks = recommendByText(q, 3);
      if (picks.length === 0) {
        push({ id: 'a' + Date.now(), role: 'ai', text: '嗯…我没完全 get 到，能再描述一下心情或风格吗？' });
        return;
      }
      const head: ChatMessage = {
        id: 'a' + Date.now(),
        role: 'ai',
        text: replyText(q, picks[0].title),
      };
      push(head);
      picks.forEach((t, i) => {
        setTimeout(() => {
          push({
            id: 'a' + Date.now() + '_' + i,
            role: 'ai',
            text: i === 0 ? '试试这首：' : '或者这首：',
            pickedTrackId: t.id,
          });
        }, 200 + i * 220);
      });
    }, 350);
  };

  return (
    <aside className="chat glass">
      <div className="chat-head">
        <span className="ai-dot"/>
        <Sparkles size={16}/> Aurora · 你的音乐伙伴
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.map(m => (
          <Bubble key={m.id} m={m} onPlay={(id) => playTrack(id)} />
        ))}
      </div>

      <div className="suggest-row">
        {SUGGESTS.map(s => (
          <button key={s} className="suggest" onClick={() => send(s)}>{s}</button>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="说说你想听什么…"
        />
        <button className="send" onClick={() => send()}><Send size={16} /></button>
      </div>
    </aside>
  );
}

function Bubble({ m, onPlay }: { m: ChatMessage; onPlay: (id: string) => void }) {
  const track = m.pickedTrackId
    ? usePlayer.getState().importedTracks.find(t => t.id === m.pickedTrackId)
      ?? trackById(m.pickedTrackId)
    : null;
  return (
    <div className={`bubble ${m.role}`}>
      {m.text}
      {track && (
        <div className="pick" onClick={() => onPlay(track.id)}>
          <img src={track.cover} alt="" />
          <div className="meta">
            <b>{track.title}</b>
            <span>{track.artist}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// 生成 AI 回复文案
function replyText(query: string, title: string): string {
  return `懂了，根据「${query}」，我帮你挑了几首。先放《${title}》看看？`;
}
