import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAdminStore } from '../../store/useAdminStore';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from '../shared/StatCard';
import { formatDate, formatTime, timeAgo } from '../../utils/formatters';

/* ── Pipeline Cards ── */
const PIPELINE_ITEMS = [
  { key: 'universe', label: 'Stock Universe', refresh: 'universe', color: '#3b82f6', desc: 'NSE Nifty50 + Next50 + Midcap + Smallcap', schedule: 'Auto-syncs daily at 8AM IST + on startup' },
  { key: 'fundamentals', label: 'Fundamentals', refresh: 'fundamentals', color: '#f59e0b', desc: 'ROE -- D/E -- PE -- margins -- promoter% via Screener.in', schedule: 'Auto-syncs daily at 8PM IST + if stale on startup' },
  { key: 'scored', label: 'Scoring Engine', refresh: 'scoring', color: '#10b981', desc: 'Kite candles -> technicals -> Varsity composite score', schedule: 'Auto-scores daily at 7AM IST + on startup' },
  { key: 'kite', label: 'MF Recommendations', refresh: 'mf', color: '#8b5cf6', desc: 'Tickertape -> Varsity Module 11 scoring', schedule: 'Auto-refreshes every 6 hours' },
];

export default function AdminPage() {
  const {
    pipeline, users, logs, loading, error,
    fetchPipeline, fetchUsers, fetchLogs, clearLogs,
    forceRefresh, createUser, deleteUser, resetPassword,
  } = useAdminStore();

  const logEndRef = useRef(null);
  const logContainerRef = useRef(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [userMsg, setUserMsg] = useState('');
  const [forceRefreshMsg, setForceRefreshMsg] = useState('');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetchPipeline();
    fetchUsers();
  }, [fetchPipeline, fetchUsers]);

  // Poll logs every 3 seconds (unless paused)
  useAutoRefresh(fetchLogs, 3000, !paused);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (!paused && logContainerRef.current) {
      const el = logContainerRef.current;
      const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40;
      if (atBottom) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [logs, paused]);

  // Poll pipeline status every 5 seconds
  useAutoRefresh(fetchPipeline, 5000, true);

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      setUserMsg('Fill all fields');
      return;
    }
    if (newUser.password.length < 6) {
      setUserMsg('Password min 6 chars');
      return;
    }
    try {
      await createUser(newUser.username, newUser.password, newUser.role);
      setNewUser({ username: '', password: '', role: 'user' });
      setUserMsg(`User ${newUser.username} created`);
    } catch (e) {
      setUserMsg(`Failed: ${e.message}`);
    }
  };

  const handleForceRefresh = async (what) => {
    setForceRefreshMsg(`Syncing ${what}...`);
    try {
      await forceRefresh(what);
      setForceRefreshMsg(`${what} sync complete`);
    } catch (e) {
      setForceRefreshMsg(`Error: ${e.message}`);
    }
    setTimeout(() => setForceRefreshMsg(''), 5000);
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>ProTrader Admin</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Real-time data pipeline -- Monitoring -- User management</div>
        </div>
        <div className="flex gap-2 items-center">
          {pipeline?.uptime && <span style={{ fontSize: 10, color: 'var(--text4)' }}>Uptime: {pipeline.uptime}</span>}
          <button onClick={() => handleForceRefresh('all')} style={{
            background: 'rgba(239,68,68,.08)', color: 'var(--red)', border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>Force Refresh All</button>
        </div>
      </div>

      {/* Pipeline Status Cards */}
      <div className="grid gap-2.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {PIPELINE_ITEMS.map((item) => {
          const status = pipeline?.[item.key] || {};
          const isOk = status.ok || status.count > 0;
          const dotColor = isOk ? 'var(--green)' : status.error ? 'var(--red)' : 'var(--amber)';
          return (
            <div key={item.key} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: isOk ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)', color: isOk ? 'var(--green)' : 'var(--amber)' }}>
                  {isOk ? 'OK' : status.status || 'Unknown'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginBottom: 4 }}>{item.desc}</div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginBottom: 6 }}>{item.schedule}</div>
              <div className="flex items-center justify-between">
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                  {status.count != null ? `${status.count} records` : ''}
                  {status.updatedAt ? ` -- ${timeAgo(status.updatedAt)}` : status.last_refresh ? ` -- ${timeAgo(status.last_refresh)}` : ''}
                </div>
                <button onClick={() => handleForceRefresh(item.refresh)} disabled={loading} style={{
                  background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4,
                  padding: '3px 10px', fontSize: 10, color: 'var(--text3)', cursor: loading ? 'wait' : 'pointer',
                }}>Sync</button>
              </div>
            </div>
          );
        })}
      </div>

      {forceRefreshMsg && <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>{forceRefreshMsg}</div>}

      {/* User Management */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 20 }}>
        <div className="flex justify-between items-center mb-3.5">
          <div>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--teal)', marginBottom: 2 }}>User Management</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Create, manage, and remove user accounts</div>
          </div>
        </div>

        {/* Add User Form */}
        <div className="flex gap-2 items-center mb-3.5 flex-wrap">
          <input type="text" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', width: 140 }} />
          <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--text)', outline: 'none', width: 140 }} />
          <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleCreateUser} style={{
            background: 'rgba(34,211,238,.08)', color: 'var(--teal)', border: '1px solid rgba(34,211,238,.3)',
            borderRadius: 6, padding: '6px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>+ Add User</button>
          {userMsg && <span style={{ fontSize: 10, color: userMsg.includes('created') ? 'var(--green)' : 'var(--red)' }}>{userMsg}</span>}
        </div>

        {/* Users Table */}
        {Array.isArray(users) && users.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px' }}>Username</th>
                <th style={{ padding: '6px 8px' }}>Role</th>
                <th style={{ padding: '6px 8px' }}>Created</th>
                <th style={{ padding: '6px 8px' }}>Last Login</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const created = u.created_at ? formatDate(u.created_at) : '-';
                const lastLogin = u.last_login ? `${formatDate(u.last_login)} ${formatTime(u.last_login)}` : 'Never';
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                    <td style={{ padding: 8, fontWeight: 600, color: 'var(--text)' }}>{u.username}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{
                        background: u.role === 'admin' ? 'rgba(245,158,11,.08)' : 'rgba(59,130,246,.08)',
                        color: u.role === 'admin' ? 'var(--amber)' : 'var(--blue)',
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      }}>{u.role === 'admin' ? 'Admin' : 'User'}</span>
                    </td>
                    <td style={{ padding: 8, color: 'var(--text3)' }}>{created}</td>
                    <td style={{ padding: 8, color: 'var(--text3)' }}>{lastLogin}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <button onClick={() => {
                        const pw = prompt(`New password for "${u.username}" (min 6 chars):`);
                        if (pw && pw.length >= 6) resetPassword(u.id, pw);
                        else if (pw !== null) alert('Password must be at least 6 characters');
                      }} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: 'var(--amber)', cursor: 'pointer', marginRight: 4 }}>Reset PW</button>
                      <button onClick={() => {
                        if (confirm(`Delete user "${u.username}"? This cannot be undone.`)) deleteUser(u.id);
                      }} style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: 'var(--red)', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Live Server Logs */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div className="flex justify-between items-center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>Live Server Logs</div>
          <div className="flex gap-2 items-center">
            <span style={{ fontSize: 10, color: paused ? 'var(--amber)' : 'var(--green)' }}>{paused ? 'Paused' : 'Live'}</span>
            <button onClick={() => setPaused(!paused)} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={clearLogs} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>Clear</button>
            <button onClick={() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>Bottom</button>
          </div>
        </div>
        <div ref={logContainerRef} style={{
          fontSize: 10, fontFamily: '"SF Mono","Fira Code",monospace', lineHeight: 1.7,
          padding: '10px 14px', height: 300, overflowY: 'auto',
          background: '#0a0a0a', color: '#94a3b8',
        }}>
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 24 }}>Waiting for log output...</div>
          ) : (
            logs.map((line, i) => {
              const text = typeof line === 'string' ? line : (line.message || JSON.stringify(line));
              const level = typeof line === 'object' ? line.level : null;
              const col = level === 'error' ? '#f87171' : level === 'warn' ? '#fbbf24' : '#94a3b8';
              const ts = typeof line === 'object' && line.timestamp ? new Date(line.timestamp).toLocaleTimeString('en-IN') : '';
              return (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: col }}>
                  {ts && <span style={{ color: '#475569' }}>[{ts}] </span>}{text}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {error && <div className="text-sm mt-4" style={{ color: 'var(--red)' }}>Error: {error}</div>}
    </div>
  );
}
