import { Dialog } from './Dialog';
import { useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../services/api';
export function ModelDialog({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState('deepseek');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await apiRequest('/api/dj/model', { provider, apiKey: key });
      setKey(''); window.dispatchEvent(new Event('aurora-connections')); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); }
    finally { setBusy(false); }
  };
  return <Dialog label="连接 AI DJ" onClose={onClose}>
    <button className="connection-close" title="关闭 AI 设置" onClick={onClose}><X size={20}/></button>
    <p className="dj-eyebrow">专属 DJ</p><h2>让音乐更懂你</h2><p>连接大模型后，DJ 会理解更细腻的心情与偏好。未连接时也能使用场景推荐。</p>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><label>模型服务<select value={provider} onChange={e => setProvider(e.target.value)}><option value="deepseek">DeepSeek</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option><option value="claude">Claude</option></select></label>
      <label>API Key<input type="password" aria-label="模型 API Key" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="在这里填写你的 Key"/></label>
      <p className="connection-note">Key 仅供本机后端使用，不写入浏览器存储；会话或服务重启后需重新连接。模型调用按所选服务计费。</p>
      {error && <p role="alert">{error}</p>}<button className="dj-start" disabled={busy || key.length < 10}>{busy ? '正在连接…' : '连接 AI DJ'}</button>
    </form>
  </Dialog>;
}
