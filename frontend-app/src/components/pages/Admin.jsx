import React, { useEffect, useState, useRef } from 'react';
import { apiGet, apiPost } from '../../api/client';

const PIPELINE = [
  { key: 'universe', label: 'Stock Universe', endpoint: '/api/universe/refresh', color: 'var(--brand-text)' },
  { key: 'fundamentals', label: 'Fundamentals', endpoint: '/api/fundamentals/refresh', color: 'var(--amber-text)' },
  { key: 'scoring', label: 'Scoring Engine', endpoint: '/api/stocks/rescore', color: 'var(--green-text)' },
  { key: 'mf', label: 'MF Recommendations', endpoint: '/api/mf/rebuild-cache', color: 'var(--purple-text)' },
];

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [msg, setMsg] = useState('');
  const [refreshMsg, setRefreshMsg] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    apiGet('/api/admin/users').then((d) => setUsers(d.users || d || [])).catch(() => {});
    const pollLogs = () => apiGet('/api/admin/logs').then((d) => setLogs(d.logs || d || [])).catch(() => {});
    pollLogs();
    const id = setInterval(pollLogs, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleRefresh = async (ep) => {
    setRefreshMsg('Running…');
    try {
      await apiPost(ep);
      setRefreshMsg('Done');
    } catch (e) { setRefreshMsg(`Error: ${e.message}`); }
    setTimeout(() => setRefreshMsg(''), 3000);
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return;
    try {
      await apiPost('/api/admin/users', newUser);
      setMsg('Created'); setNewUser({ username: '', password: '', role: 'user' });
      apiGet('/api/admin/users').then((d) => setUsers(d.users || d || []));
    } catch (e) { setMsg(`Error: ${e.message}`); }
  };

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(167,139,250,0.10) 100%)',
        border: '1px solid var(--border)', borderRadius: 18, padding: '28px 32px', marginBottom: 28,
      }}>
        <div className="label-xs" style={{ marginBottom: 8 }}>Admin · Pipeline · Monitoring</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', color: 'var(--text)' }}>
          <span className="gradient-fill">ProTrader Admin</span>
        </h1>
      </div>

      {/* Pipeline */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          Automated Data Pipeline
          {refreshMsg && <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--brand-text)', fontWeight: 500 }}>{refreshMsg}</span>}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {PIPELINE.map((p) => (
            <div key={p.key} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: p.color }}>{p.label}</div>
              </div>
              <button onClick={() => handleRefresh(p.endpoint)} className="btn btn-secondary" style={{ height: 32, fontSize: 12, padding: '0 12px' }}>
                Sync
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* User Management */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>User Management</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{ height: 38, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 160 }}
          />
          <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            style={{ height: 38, padding: '0 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 160 }}
          />
          <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{ height: 38, padding: '0 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleAddUser} className="btn btn-primary" style={{ height: 38, fontSize: 13 }}>+ Add User</button>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('E') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</span>}
        </div>
        {users.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>{['Username', 'Role', 'Created', 'Last Login'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.username}</td>
                  <td style={{ padding: '10px 14px', color: u.role === 'admin' ? 'var(--amber-text)' : 'var(--brand-text)' }}>{u.role}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Live Logs */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Live Server Logs</h2>
          <div className="chip chip-brand" style={{ gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            Live
          </div>
        </div>
        <div ref={logRef} style={{
          background: '#0A0A10', borderRadius: 12, padding: 16, maxHeight: 320, overflowY: 'auto',
          fontFamily: '"SF Mono","JetBrains Mono",monospace', fontSize: 12, lineHeight: 1.6, color: 'var(--text2)',
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text3)' }}>Waiting for logs…</div>
          ) : (
            logs.slice(-50).map((line, i) => <div key={i}>{typeof line === 'string' ? line : JSON.stringify(line)}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
