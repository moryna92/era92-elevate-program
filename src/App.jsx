import { useState, useEffect, useCallback } from 'react';
import { ADMIN_PW, SETTINGS_KEY, USER_KEY, ADMIN_KEY, TEAM as DEFAULT_TEAM,
         INITIALS_MAP, PILLARS, TASK_BONUS_PTS, memberColor, getInitials } from './constants.js';
import { storageGet, storageSet } from './storage.js';
import SuperStriker from './components/SuperStriker.jsx';
import TaskTracker from './components/TaskTracker.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import AdminSettings from './components/AdminSettings.jsx';
import Toast from './components/Toast.jsx';

function buildDefaultSettings() {
  return {
    team: DEFAULT_TEAM.map((name, i) => ({
      id: 'm' + i,
      name,
      initials: (INITIALS_MAP[name] || name.split(' ').map(w=>w[0]).slice(0,2).join('')).toUpperCase(),
      role: '',
      active: true,
    })),
    pillars: PILLARS.map((p, i) => ({ ...p, id: 'p' + i })),
    taskBonusPts: TASK_BONUS_PTS,
    adminPassword: ADMIN_PW,
    orgName: 'ERA92 Elevate',
    weeklyBonusEnabled: true,
    votingSchedule: { openDay:1, openHour:7, closeDay:5, closeHour:18, announceHour:7, announceMin:30 },
  };
}

export default function App() {
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin]         = useState(false);
  const [authed, setAuthed]           = useState(false);
  const [activeApp, setActiveApp]     = useState('ss');
  const [toast, setToast]             = useState(null);
  const [settings, setSettings]       = useState(buildDefaultSettings());

  // Load settings + check saved login on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await storageGet(SETTINGS_KEY);
        if (r && typeof r === 'object' && r.team) {
          setSettings(prev => ({ ...prev, ...r }));
        }
      } catch(e) { /* use defaults */ }

      const u = localStorage.getItem(USER_KEY);
      const a = localStorage.getItem(ADMIN_KEY) === '1';
      if (u) { setCurrentUser(u); setIsAdmin(a); setAuthed(true); }
    })();

    // Listen for danger-zone resets from AdminSettings
    function onResetSS() {
      import('./constants.js').then(({ SS_KEYS }) => {
        import('./storage.js').then(({ storageSet: ss }) => {
          [SS_KEYS.scores, SS_KEYS.history, SS_KEYS.votes, SS_KEYS.ann, SS_KEYS.voted, SS_KEYS.taskBonus]
            .forEach(k => ss(k, {}));
        });
      });
    }
    function onResetSettings() {
      storageSet(SETTINGS_KEY, buildDefaultSettings())
        .then(() => window.location.reload())
        .catch(() => window.location.reload());
    }
    window.addEventListener('era92:resetSS', onResetSS);
    window.addEventListener('era92:resetSettings', onResetSettings);
    return () => {
      window.removeEventListener('era92:resetSS', onResetSS);
      window.removeEventListener('era92:resetSettings', onResetSettings);
    };
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function saveSettings(updated) {
    setSettings(updated);
    try { await storageSet(SETTINGS_KEY, updated); } catch(e) {}
  }

  function handleEnter(name) {
    setCurrentUser(name); setIsAdmin(false);
    localStorage.setItem(USER_KEY, name);
    localStorage.removeItem(ADMIN_KEY);
    setAuthed(true);
    showToast(`Welcome, ${name.split(' ')[0]}! ⚡`);
  }
  function handleAdminEnter() {
    setCurrentUser('Admin'); setIsAdmin(true);
    localStorage.setItem(USER_KEY, 'Admin');
    localStorage.setItem(ADMIN_KEY, '1');
    setAuthed(true);
    showToast('Admin mode active ⚡');
  }
  function handleLogout() {
    if (!window.confirm('Log out?')) return;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setAuthed(false); setCurrentUser(''); setIsAdmin(false);
  }

  if (!authed) return <AuthScreen onEnter={handleEnter} onAdmin={handleAdminEnter} settings={settings} />;

  const team    = (settings?.team || []).filter(m => m.active).map(m => m.name);
  const pillars = settings?.pillars;
  const av      = isAdmin ? '⚡' : getInitials(currentUser);
  const avColor = isAdmin ? 'var(--admin)' : memberColor(currentUser);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <header style={S.header}>
        <div style={S.logo}>
          <img src="/logo.webp" alt="ERA92 Elevate" style={{ height:32, objectFit:'contain' }} />
        </div>
        <div style={S.switcher}>
          <button style={{ ...S.btn, ...(activeApp==='ss'       ? S.btnSS       : {}) }} onClick={() => setActiveApp('ss')}>⚡ Super Striker</button>
          <button style={{ ...S.btn, ...(activeApp==='task'     ? S.btnTask     : {}) }} onClick={() => setActiveApp('task')}>📋 Task Tracker</button>
          {isAdmin && <>
            <button style={{ ...S.btn, ...(activeApp==='admin'    ? S.btnAdmin    : {}) }} onClick={() => setActiveApp('admin')}>🔐 Admin</button>
            <button style={{ ...S.btn, ...(activeApp==='settings' ? S.btnSettings : {}) }} onClick={() => setActiveApp('settings')}>⚙️ Settings</button>
          </>}
        </div>
        <div style={S.right}>
          <div style={S.live}><span style={S.liveDot}/>LIVE</div>
          {isAdmin && <div style={S.adminBadge}>⚡ ADMIN</div>}
          <div style={S.userBadge} onClick={handleLogout} title="Click to log out">
            <div style={{ ...S.av, background:avColor }}>{av}</div>
            <span>{isAdmin ? 'Admin' : currentUser.split(' ')[0]}</span>
          </div>
        </div>
      </header>

      {activeApp === 'ss'       && <SuperStriker   currentUser={currentUser} isAdmin={isAdmin} showToast={showToast} team={team} pillars={pillars} settings={settings} />}
      {activeApp === 'task'     && <TaskTracker    currentUser={currentUser} isAdmin={isAdmin} showToast={showToast} team={team} />}
      {activeApp === 'admin'    && isAdmin && <AdminDashboard showToast={showToast} />}
      {activeApp === 'settings' && isAdmin && <AdminSettings  settings={settings} onSave={saveSettings} showToast={showToast} />}

      <Toast message={toast} />
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────
function AuthScreen({ onEnter, onAdmin, settings }) {
  const [name, setName]     = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw]         = useState('');
  const [pwErr, setPwErr]   = useState(false);

  function submitName() { if (name.trim()) onEnter(name.trim()); }
  function submitAdmin() {
    const correct = settings?.adminPassword || ADMIN_PW;
    if (pw === correct) { onAdmin(); }
    else { setPwErr(true); setPw(''); }
  }

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <img src="/logo.webp" alt="ERA92 Elevate" style={{ height:48, objectFit:'contain', marginBottom:16 }} />
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, marginBottom:6 }}>
          Team <span style={{ color: showPw ? 'var(--admin)' : 'var(--primary)' }}>Dashboard</span>
        </div>
        {!showPw ? (<>
          <p style={S.sub}>Enter your name to access the team dashboard.</p>
          <input style={S.inp} placeholder="Your full name e.g. Joyce Nabukenya" value={name}
            onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submitName()} autoFocus />
          <button style={S.authBtn} onClick={submitName}>Enter Dashboard →</button>
          <button style={S.link} onClick={()=>setShowPw(true)}>🔐 Admin Login</button>
        </>) : (<>
          <p style={S.sub}>Enter the admin password to access full management controls.</p>
          <input style={S.inp} type="password" placeholder="Admin password" value={pw}
            onChange={e=>{setPw(e.target.value);setPwErr(false);}} onKeyDown={e=>e.key==='Enter'&&submitAdmin()} autoFocus />
          {pwErr && <div style={{ color:'var(--red)', fontSize:11, marginBottom:8, fontFamily:'DM Mono,monospace' }}>Incorrect password.</div>}
          <button style={{ ...S.authBtn, background:'var(--admin)' }} onClick={submitAdmin}>Unlock Admin →</button>
          <button style={S.link} onClick={()=>{setShowPw(false);setPwErr(false);}}>← Back</button>
        </>)}
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const S = {
  header:   { background:'linear-gradient(90deg,#0d0a0e,#1a0814,#0d0a0e)', borderBottom:'1px solid rgba(232,24,90,.2)', padding:'0 22px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:300, gap:10, boxShadow:'0 2px 20px rgba(232,24,90,.08)' },
  logo:     { display:'flex', alignItems:'center', flexShrink:0 },
  switcher: { display:'flex', gap:2, background:'rgba(255,255,255,.05)', border:'1px solid rgba(232,24,90,.2)', borderRadius:8, padding:3 },
  btn:      { background:'none', border:'none', borderRadius:6, color:'var(--text2)', fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase', padding:'6px 14px', cursor:'pointer', transition:'all .2s', whiteSpace:'nowrap' },
  btnSS:       { background:'linear-gradient(135deg,#e8185a,#e8402a)', color:'#fff', fontWeight:600 },
  btnTask:     { background:'var(--green)', color:'var(--ink)', fontWeight:600 },
  btnAdmin:    { background:'var(--admin)', color:'#fff', fontWeight:600 },
  btnSettings: { background:'var(--surface3)', color:'var(--text)', fontWeight:600, border:'1px solid var(--border2)' },
  right:    { display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' },
  live:     { fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--green)', display:'flex', alignItems:'center', gap:4, whiteSpace:'nowrap' },
  liveDot:  { width:6, height:6, background:'var(--green)', borderRadius:'50%', display:'inline-block', animation:'pulse 2s infinite' },
  adminBadge: { background:'rgba(185,124,249,.1)', border:'1px solid var(--admin)', borderRadius:20, padding:'3px 10px', fontSize:10, color:'var(--admin)', fontFamily:'DM Mono,monospace', letterSpacing:'1px' },
  userBadge:  { background:'rgba(255,255,255,.05)', border:'1px solid rgba(232,24,90,.2)', borderRadius:20, padding:'4px 11px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' },
  av:       { width:20, height:20, borderRadius:'50%', color:'#fff', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 },
  overlay:  { position:'fixed', inset:0, background:'linear-gradient(135deg,#0d0a0e,#1a0814,#0d0a0e)', display:'flex', alignItems:'center', justifyContent:'center', padding:16, zIndex:400 },
  card:     { background:'var(--surface)', border:'1px solid rgba(232,24,90,.2)', borderRadius:16, padding:36, width:'100%', maxWidth:400, textAlign:'center', boxShadow:'0 0 60px rgba(232,24,90,.08)' },
  sub:      { color:'var(--text2)', fontSize:12, marginBottom:18, lineHeight:1.6 },
  inp:      { width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid var(--border2)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none', marginBottom:10, display:'block' },
  authBtn:  { width:'100%', background:'linear-gradient(135deg,#e8185a,#e8402a)', color:'#fff', border:'none', borderRadius:6, padding:'11px 0', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', marginBottom:10 },
  link:     { background:'none', border:'none', color:'var(--text3)', fontSize:11, cursor:'pointer', fontFamily:'DM Mono,monospace', textDecoration:'underline', display:'block', margin:'0 auto' },
};
