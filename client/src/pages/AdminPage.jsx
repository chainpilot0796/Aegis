import { useState } from 'react';
import { useApi } from '../hooks/useApi';

// Standalone, unlinked admin panel (reached only by typing /admin).
// Switch the active LLM provider/model and manage per-provider API keys.
// Keys are never returned by the server — only a masked hint is shown.

const C = {
  bg: '#07070C',
  card: '#14141F',
  border: '#262640',
  text: '#E8E8F0',
  sub: '#9A9AB2',
  accent: '#A78BFA',
  danger: '#F87171',
  ok: '#34D399',
};

const input = {
  width: '100%',
  padding: '10px 12px',
  background: '#0E0E16',
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: 8,
  outline: 'none',
  fontSize: 14,
};

const btn = (bg) => ({
  padding: '10px 16px',
  background: bg,
  color: '#07070C',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
});

export default function AdminPage() {
  const api = useApi();
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // form state
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [keyInputs, setKeyInputs] = useState({}); // { providerId: 'sk-...' }

  const authHeader = { headers: { 'x-admin-password': password } };

  const applyConfig = (cfg) => {
    setConfig(cfg);
    setProvider(cfg.active.provider);
    setModel(cfg.active.model);
  };

  const unlock = async () => {
    setError('');
    try {
      const cfg = await api.get('/api/admin/llm', authHeader);
      applyConfig(cfg);
      setUnlocked(true);
    } catch (e) {
      setError(e?.response?.status === 401 ? 'Wrong password' : 'Failed to load config');
    }
  };

  const saveActive = async () => {
    setError('');
    setMsg('');
    try {
      const cfg = await api.post('/api/admin/llm', { password, provider, model });
      applyConfig(cfg);
      setMsg(`Active model set → ${cfg.active.provider} / ${cfg.active.model}`);
    } catch (e) {
      setError('Failed to save active model');
    }
  };

  const saveKey = async (pid) => {
    setError('');
    setMsg('');
    const apiKey = (keyInputs[pid] || '').trim();
    if (!apiKey) return setError('Enter a key first');
    try {
      const cfg = await api.post('/api/admin/key', { password, provider: pid, action: 'set', apiKey });
      applyConfig(cfg);
      setKeyInputs((s) => ({ ...s, [pid]: '' }));
      setMsg(`${pid} key saved`);
    } catch (e) {
      setError(`Failed to save ${pid} key`);
    }
  };

  const clearKey = async (pid) => {
    setError('');
    setMsg('');
    try {
      const cfg = await api.post('/api/admin/key', { password, provider: pid, action: 'clear' });
      applyConfig(cfg);
      setMsg(`${pid} admin key removed (falls back to env)`);
    } catch (e) {
      setError(`Failed to remove ${pid} key`);
    }
  };

  const wrap = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
    display: 'flex',
    justifyContent: 'center',
    padding: '48px 16px',
  };

  if (!unlocked) {
    return (
      <div style={wrap}>
        <div style={{ width: 360 }}>
          <h1 style={{ fontSize: 22, marginBottom: 6 }}>Aegis Admin</h1>
          <p style={{ color: C.sub, fontSize: 14, marginBottom: 20 }}>
            Enter the admin password to manage the AI model.
          </p>
          <input
            style={input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
          />
          <button style={{ ...btn(C.accent), width: '100%', marginTop: 12 }} onClick={unlock}>
            Unlock
          </button>
          {error && <p style={{ color: C.danger, marginTop: 12, fontSize: 14 }}>{error}</p>}
        </div>
      </div>
    );
  }

  const activeProvider = config.providers.find((p) => p.id === provider);
  const models = activeProvider ? activeProvider.models : [];

  return (
    <div style={wrap}>
      <div style={{ width: 560, maxWidth: '100%' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Aegis Admin</h1>
        <p style={{ color: C.sub, fontSize: 14, marginBottom: 24 }}>
          Active: <span style={{ color: C.accent }}>{config.active.provider} / {config.active.model}</span>
        </p>

        {/* Active model switch */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>Active provider &amp; model</h2>
          <label style={{ fontSize: 13, color: C.sub }}>Provider</label>
          <select
            style={{ ...input, marginTop: 6, marginBottom: 14 }}
            value={provider}
            onChange={(e) => {
              const pid = e.target.value;
              setProvider(pid);
              const p = config.providers.find((x) => x.id === pid);
              setModel(p ? p.defaultModel : '');
            }}
          >
            {config.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.configured ? '' : '(no key)'}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 13, color: C.sub }}>Model</label>
          <select style={{ ...input, marginTop: 6, marginBottom: 16 }} value={model} onChange={(e) => setModel(e.target.value)}>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button style={btn(C.accent)} onClick={saveActive}>Save active model</button>
        </div>

        {/* API key management */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 14 }}>API keys</h2>
          {config.providers.map((p) => (
            <div key={p.id} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: 12, color: p.configured ? C.ok : C.sub }}>
                  {p.configured
                    ? `${p.keyHint} · via ${p.keySource}`
                    : 'not configured'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={input}
                  type="password"
                  placeholder={`New ${p.label} API key`}
                  value={keyInputs[p.id] || ''}
                  onChange={(e) => setKeyInputs((s) => ({ ...s, [p.id]: e.target.value }))}
                />
                <button style={btn(C.accent)} onClick={() => saveKey(p.id)}>Save</button>
                {p.hasAdminKey && (
                  <button style={{ ...btn(C.danger), color: '#fff' }} onClick={() => clearKey(p.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {msg && <p style={{ color: C.ok, marginTop: 16, fontSize: 14 }}>{msg}</p>}
        {error && <p style={{ color: C.danger, marginTop: 16, fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  );
}
