import { useState, useEffect, useCallback } from 'react';
import { ADMIN_PW, USER_KEY, ADMIN_KEY, memberColor, getInitials } from './constants.js';
import SuperStriker from './components/SuperStriker.jsx';
import TaskTracker from './components/TaskTracker.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AdminSettings from './components/AdminSettings.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [user, setUser]       = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [authed, setAuthed]   = useState(false);
  const [app, setApp]         = useState('ss');
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem(USER_KEY);
      const a = localStorage.getItem(ADMIN_KEY) === '1';
      if (u) { setUser(u); setIsAdmin(a); setAuthed(true); }
    } catch(e) {}
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  function login(name) {
    try { localStorage.setItem(USER_KEY, name); localStorage.removeItem(ADMIN_KEY); } catch(e) {}
    setUser(name); setIsAdmin(false); setAuthed(true);
    showToast('Welcome, ' + name.split(' ')[0] + '! ⚡');
  }
  function loginAdmin() {
    try { localStorage.setItem(USER_KEY, 'Admin'); localStorage.setItem(ADMIN_KEY, '1'); } catch(e) {}
    setUser('Admin'); setIsAdmin(true); setAuthed(true);
    showToast('Admin mode active ⚡');
  }
  function logout() {
    if (!window.confirm('Log out?')) return;
    try { localStorage.removeItem(USER_KEY); localStorage.removeItem(ADMIN_KEY); } catch(e) {}
    setUser(''); setIsAdmin(false); setAuthed(false);
  }

  if (!authed) return <Login onLogin={login} onAdmin={loginAdmin} />;

  const av = isAdmin ? '⚡' : getInitials(user);
  const avBg = isAdmin ? '#b97cf9' : memberColor(user);

  return (
    <div style={{ minHeight: '100vh', background: '#1a1520' }}>
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(90deg,#1a1520,#2a1a30,#1a1520)', borderBottom: '1px solid rgba(232,24,90,.2)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 200, gap: 10 }}>
        <img src="/logo.webp" alt="ERA92 Elevate" style={{ height: 30, objectFit: 'contain' }} />

        <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(232,24,90,.2)', borderRadius: 8, padding: 3 }}>
          {[['ss','⚡ Super Striker'],['task','📋 Tasks']].map(([id, label]) => (
            <button key={id} onClick={() => setApp(id)} style={{ background: app===id ? 'linear-gradient(135deg,#e8185a,#e8402a)' : 'none', color: app===id ? '#fff' : '#b8a8d0', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontFamily: 'DM Mono,monospace', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: app===id ? 600 : 400 }}>{label}</button>
          ))}
          {isAdmin && [['admin','🔐 Admin'],['settings','⚙️ Settings']].map(([id, label]) => (
            <button key={id} onClick={() => setApp(id)} style={{ background: app===id ? (id==='admin'?'#b97cf9':'rgba(255,255,255,.1)') : 'none', color: app===id ? '#fff' : '#b8a8d0', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 10, fontFamily: 'DM Mono,monospace', letterSpacing: '1.5px', textTransform: 'uppercase', cursor: 'pointer', fontWeight: app===id ? 600 : 400 }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: '#3ecf8e', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, background: '#3ecf8e', borderRadius: '50%', display: 'inline-block' }}/>LIVE
          </span>
          {isAdmin && <span style={{ background: 'rgba(185,124,249,.1)', border: '1px solid #b97cf9', borderRadius: 20, padding: '3px 10px', fontSize: 10, color: '#b97cf9', fontFamily: 'DM Mono,monospace' }}>⚡ ADMIN</span>}
          <div onClick={logout} title="Click to log out" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(232,24,90,.2)', borderRadius: 20, padding: '4px 11px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#f5f0f8' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: avBg, color: '#1a1520', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne,sans-serif' }}>{av}</div>
            <span>{isAdmin ? 'Admin' : user.split(' ')[0]}</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {app === 'ss'       && <SuperStriker   currentUser={user} isAdmin={isAdmin} showToast={showToast} />}
      {app === 'task'     && <TaskTracker    currentUser={user} isAdmin={isAdmin} showToast={showToast} />}
      {app === 'admin'    && isAdmin && <AdminDashboard showToast={showToast} />}
      {app === 'settings' && isAdmin && <AdminSettings  showToast={showToast} />}

      <Toast message={toast} />
    </div>
  );
}

function Login({ onLogin, onAdmin }) {
  const [name, setName]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw]         = useState('');
  const [err, setErr]       = useState('');

  function submit() { if (name.trim()) onLogin(name.trim()); }
  function submitPw() {
    if (pw === ADMIN_PW) { onAdmin(); }
    else { setErr('Incorrect password.'); setPw(''); }
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid #4a4060', borderRadius: 6, padding: '10px 12px', color: '#f5f0f8', fontFamily: 'DM Sans,sans-serif', fontSize: 13, outline: 'none', marginBottom: 10, display: 'block', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg,#1a1520,#2a1a30,#1a1520)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#231e2b', border: '1px solid rgba(232,24,90,.2)', borderRadius: 16, padding: 36, width: '100%', maxWidth: 400, textAlign: 'center', boxShadow: '0 0 60px rgba(232,24,90,.08)' }}>
        <img src="/logo.webp" alt="ERA92 Elevate" style={{ height: 44, objectFit: 'contain', marginBottom: 16 }} />
        <div style={{ fontFamily: 'Syne,sans-serif', fontWeight: 800, fontSize: 22, color: '#f5f0f8', marginBottom: 6 }}>
          Team <span style={{ color: showPw ? '#b97cf9' : '#e8185a' }}>Dashboard</span>
        </div>

        {!showPw ? (<>
          <p style={{ color: '#b8a8d0', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>Enter your name to access the team dashboard.</p>
          <input style={inp} placeholder="Your full name e.g. Joyce Nabukenya" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
          <button onClick={submit} style={{ width: '100%', background: 'linear-gradient(135deg,#e8185a,#e8402a)', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', marginBottom: 10 }}>
            Enter Dashboard →
          </button>
          <button onClick={() => setShowPw(true)} style={{ background: 'none', border: 'none', color: '#8070a0', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono,monospace', textDecoration: 'underline' }}>
            🔐 Admin Login
          </button>
        </>) : (<>
          <p style={{ color: '#b8a8d0', fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>Enter the admin password.</p>
          <input style={inp} type="password" placeholder="Admin password" value={pw}
            onChange={e => { setPw(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && submitPw()} autoFocus />
          {err && <div style={{ color: '#f94040', fontSize: 11, marginBottom: 8, fontFamily: 'DM Mono,monospace' }}>{err}</div>}
          <button onClick={submitPw} style={{ width: '100%', background: '#b97cf9', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', marginBottom: 10 }}>
            Unlock Admin →
          </button>
          <button onClick={() => { setShowPw(false); setErr(''); }} style={{ background: 'none', border: 'none', color: '#8070a0', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Mono,monospace', textDecoration: 'underline' }}>
            ← Back
          </button>
        </>)}
      </div>
    </div>
  );
}
