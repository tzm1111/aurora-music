import { Dialog } from './Dialog';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { ModelStatus } from '../services/api';
const PROVIDERS: Record<string, string> = { deepseek: 'DeepSeek', gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude' };
export function ModelDialog({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState('deepseek');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedProvider, setSavedProvider] = useState('');
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ModelStatus>('/api/dj/status', undefined, controller.signal).then(status => {
      setSaved(status.saved);
      if (status.saved && PROVIDERS[status.provider]) setSavedProvider(status.provider);
      if (PROVIDERS[status.provider]) setProvider(status.provider);
    }).catch(() => {
      if (!controller.signal.aborted) setError('暂时无法读取连接状态。');
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await apiRequest('/api/dj/model', { provider, apiKey: key });
      setKey(''); window.dispatchEvent(new Event('aurora-connections')); onClose();
    } catch (e) { setError(e instanceof Error ? e.message : '连接失败'); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true); setError('');
    try {
      await apiRequest('/api/dj/model/clear', {});
      setSaved(false); setSavedProvider(''); setKey(''); window.dispatchEvent(new Event('aurora-connections'));
    } catch (e) { setError(e instanceof Error ? e.message : '清除失败'); }
    finally { setBusy(false); }
  };
  return <Dialog label="连接 AI DJ" onClose={onClose}>
    <button className="connection-close" title="关闭 AI 设置" onClick={onClose}><X size={20}/></button>
    <h2>AI 设置</h2>
    <p className="model-benefits">连接模型后，DJ 能更细致地理解心情和场景，处理「有点累，但想听轻快、少人声的歌」这类组合要求，并按反馈调整后续推荐。</p>
    {saved && <p className="model-saved" role="status">已保存 {PROVIDERS[savedProvider]} 连接</p>}
    <form onSubmit={e => { e.preventDefault(); void save(); }}><label>模型服务<select value={provider} disabled={busy || checking} onChange={e => setProvider(e.target.value)}><option value="deepseek">DeepSeek</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option><option value="claude">Claude</option></select></label>
      <label>API Key<input type="password" aria-label="模型 API Key" autoComplete="off" value={key} disabled={busy || checking} onChange={e => setKey(e.target.value)} placeholder={saved && provider === savedProvider ? '已保存，填写新 Key 可替换' : 'API Key'}/></label>
      <p className="connection-note">按所选服务计费。</p>
      {error && <p role="alert">{error}</p>}<button className="dj-start" disabled={busy || checking || key.length < 10}>{checking ? '读取连接…' : busy ? '处理中…' : saved ? '更新连接' : '连接 AI DJ'}</button>
      {saved && <button type="button" className="model-clear" disabled={busy} onClick={clear}>清除已保存连接</button>}
    </form>
  </Dialog>;
}
