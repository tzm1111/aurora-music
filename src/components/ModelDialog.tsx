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
    <h2>AI 设置</h2>
    <p className="model-benefits">连接模型后，DJ 能更细致地理解心情和场景，处理「有点累，但想听轻快、少人声的歌」这类组合要求，并按反馈调整后续推荐。</p>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><label>模型服务<select value={provider} onChange={e => setProvider(e.target.value)}><option value="deepseek">DeepSeek</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option><option value="claude">Claude</option></select></label>
      <label>API Key<input type="password" aria-label="模型 API Key" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="API Key"/></label>
      <p className="connection-note">按所选服务计费。</p>
      {error && <p role="alert">{error}</p>}<button className="dj-start" disabled={busy || key.length < 10}>{busy ? '正在连接…' : '连接 AI DJ'}</button>
    </form>
  </Dialog>;
}
