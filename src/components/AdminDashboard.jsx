import { useState, useEffect } from 'react';
import { TEAM, INITIALS_MAP, memberColor, getInitials, fmtDate, SS_KEYS, TASK_KEY, TASK_BONUS_PTS } from '../constants.js';
import { storageGet } from '../storage.js';
import { getWeekNum, getWeekId } from '../weekUtils.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function Bar({ pct, color, height = 8 }) {
  return (
    <div style={{ background:'var(--border)', borderRadius:4, height, overflow:'hidden', flex:1 }}>
      <div style={{ height:'100%', borderRadius:4, background:color, width:`${Math.min(pct,100)}%`, transition:'width .7s ease' }} />
    </div>
  );
}

function StatCard({ label, value, sub, color = 'var(--amber)', icon }) {
  return (
    <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
      <div style={{ fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--text2)', letterSpacing:1, textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:30, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text2)', marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
      <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{children}</div>
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  );
}

export default function AdminDashboard({ showToast }) {
  const [tasks, setTasks]       = useState([]);
  const [ssScores, setSsScores] = useState({});
  const [ssHistory, setSsHistory] = useState([]);
  const [allVotes, setAllVotes]   = useState({});
  const [taskBonus, setTaskBonus] = useState({});
  const [loaded, setLoaded]       = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    (async () => {
      try { const r = await storageGet(TASK_KEY);          if (r?.tasks) setTasks(r.tasks); }    catch(e){}
      try { const r = await storageGet(SS_KEYS.scores);    if (r)        setSsScores(r); }        catch(e){}
      try { const r = await storageGet(SS_KEYS.history);   if (r)        setSsHistory(r); }       catch(e){}
      try { const r = await storageGet(SS_KEYS.votes);     if (r)        setAllVotes(r); }        catch(e){}
      try { const r = await storageGet(SS_KEYS.taskBonus); if (r)        setTaskBonus(r); }       catch(e){}
      setLoaded(true);
    })();
    // Refresh every 15s
    const iv = setInterval(async () => {
      try { const r = await storageGet(TASK_KEY);          if (r?.tasks) setTasks(r.tasks); }    catch(e){}
      try { const r = await storageGet(SS_KEYS.scores);    if (r)        setSsScores(r); }        catch(e){}
      try { const r = await storageGet(SS_KEYS.history);   if (r)        setSsHistory(r); }       catch(e){}
      try { const r = await storageGet(SS_KEYS.votes);     if (r)        setAllVotes(r); }        catch(e){}
      try { const r = await storageGet(SS_KEYS.taskBonus); if (r)        setTaskBonus(r); }       catch(e){}
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  // ── Computed metrics ───────────────────────────────────────
  const totalTasks   = tasks.length;
  const doneTasks    = tasks.filter(t => t.status === 'done').length;
  const inProg       = tasks.filter(t => t.status === 'inprogress').length;
  const todoTasks    = tasks.filter(t => t.status === 'todo').length;
  const overallPct   = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;
  const today        = new Date();
  const overdueTasks = tasks.filter(t => t.due && new Date(t.due) < today && t.status !== 'done');

  // Per-member task stats
  const memberStats = TEAM.map(name => {
    const mt      = tasks.filter(t => t.assignee === name);
    const done    = mt.filter(t => t.status === 'done').length;
    const overdue = mt.filter(t => t.due && new Date(t.due) < today && t.status !== 'done').length;
    const inprog  = mt.filter(t => t.status === 'inprogress').length;
    const todo    = mt.filter(t => t.status === 'todo').length;
    const pct     = mt.length ? Math.round(done / mt.length * 100) : 0;
    const ss      = ssScores[name] || { score: 0, wins: 0, reason: 'No nominations yet' };
    return { name, total: mt.length, done, overdue, inprog, todo, pct, ss, tasks: mt };
  }).filter(m => m.total > 0 || ssScores[m?.name]?.score > 0);

  // Weekly progress — tasks completed per week (from history + task completedAt if available)
  // We approximate using SS history as weekly signal
  const last8Weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 * (7 - i)));
    return { wk: getWeekNum(d), label: `W${getWeekNum(d)}` };
  });

  // Tasks completed (done) — group by due month as proxy for completion month
  const completedByMonth = {};
  tasks.filter(t => t.status === 'done' && t.due).forEach(t => {
    const m = new Date(t.due + 'T00:00:00').getMonth();
    completedByMonth[m] = (completedByMonth[m] || 0) + 1;
  });
  const todoByMonth = {};
  tasks.filter(t => t.status !== 'done' && t.due).forEach(t => {
    const m = new Date(t.due + 'T00:00:00').getMonth();
    todoByMonth[m] = (todoByMonth[m] || 0) + 1;
  });
  const activeMonths = [...new Set([...Object.keys(completedByMonth), ...Object.keys(todoByMonth)])].map(Number).sort((a,b)=>a-b);

  // SS leaderboard sorted
  const ssLeaderboard = TEAM.map(n => ({ name: n, ...(ssScores[n] || { score:0, wins:0, reason:'No nominations yet' }) }))
    .sort((a,b) => b.score - a.score);
  const maxSsScore = Math.max(...ssLeaderboard.map(s => s.score), 1);
  // Task bonus winners from most recent week awarded
  const allBonusWeeks = Object.keys(taskBonus).sort().reverse();
  const recentBonusWinners = allBonusWeeks.length ? (taskBonus[allBonusWeeks[0]] || []) : [];

  const tabs = ['overview', 'members', 'progress', 'superstriker'];
  const tabLabels = { overview:'📊 Overview', members:'👥 Members', progress:'📈 Progress', superstriker:'⚡ Super Striker' };

  if (!loaded) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:32, animation:'spin 1s linear infinite' }}>⚡</div>
      <div style={{ fontFamily:'DM Mono,monospace', fontSize:11, color:'var(--amber)', letterSpacing:2 }}>LOADING DASHBOARD…</div>
    </div>
  );

  return (
    <div style={{ background:'var(--bg)', minHeight:'calc(100vh - 56px)', animation:'fadeUp .35s ease' }}>

      {/* ADMIN HERO BANNER */}
      <div style={{ background:'linear-gradient(135deg, #1a0814 0%, #0d0a0e 60%, #1a080a 100%)', borderBottom:'1px solid rgba(232,24,90,0.2)', padding:'20px 28px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="/logo.webp" alt="ERA92 Elevate" style={{ height:38, width:'auto', objectFit:'contain' }} />
          <div style={{ width:1, height:32, background:'rgba(232,24,90,0.3)' }} />
          <div>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:3, textTransform:'uppercase', color:'var(--primary)', marginBottom:5 }}>Private Admin Dashboard · Moreen Nassolo</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, color:'var(--text)' }}>
              Command <span style={{ background:'linear-gradient(135deg,#e8185a,#e8402a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Centre</span>
            </div>
            <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>Full team visibility · Tasks + Super Striker · Confidential</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ background:'rgba(62,207,142,.1)', border:'1px solid rgba(62,207,142,.3)', borderRadius:20, padding:'4px 12px', fontSize:10, color:'var(--green)', fontFamily:'DM Mono,monospace', letterSpacing:1, display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block', animation:'pulse 2s infinite' }} />
            LIVE · Auto-refresh 15s
          </div>
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:8, padding:'6px 14px', fontSize:11, color:'var(--text2)', fontFamily:'DM Mono,monospace' }}>
            Week {getWeekNum()} · {new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
          </div>
        </div>
      </div>

      {/* SUB TABS */}
      <div style={{ display:'flex', background:'var(--surface)', borderBottom:'1px solid rgba(232,24,90,0.15)', padding:'0 28px', overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            background:'none', border:'none', borderBottom:`2px solid ${activeTab===t?'var(--primary)':'transparent'}`,
            color: activeTab===t ? 'var(--primaryL)' : 'var(--text2)',
            fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase',
            padding:'10px 16px', cursor:'pointer', whiteSpace:'nowrap', transition:'all .2s',
          }}>{tabLabels[t]}</button>
        ))}
      </div>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'24px 20px 60px' }}>

        {/* ════ OVERVIEW TAB ════ */}
        {activeTab === 'overview' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            {/* Top stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:12, marginBottom:28 }}>
              <StatCard icon="📋" label="Total Tasks"       value={totalTasks}  color="var(--text)" />
              <StatCard icon="✅" label="Completed"         value={doneTasks}   color="var(--green)"  sub={`${overallPct}% of all tasks`} />
              <StatCard icon="⏳" label="In Progress"       value={inProg}      color="var(--amber)"  sub={`${tasks.length ? Math.round(inProg/tasks.length*100) : 0}% active`} />
              <StatCard icon="📋" label="To Do"             value={todoTasks}   color="var(--blue)"   sub="Not started yet" />
              <StatCard icon="⚠️" label="Overdue"           value={overdueTasks.length} color="var(--red)" sub="Past due date" />
              <StatCard icon="👥" label="Active Members"    value={memberStats.length}  color="var(--purple)" sub="With tasks assigned" />
            </div>

            {/* Overall completion ring + bar */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:28 }}>
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
                <SectionHeader>Overall Team Completion</SectionHeader>
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  {/* Donut */}
                  <svg width="100" height="100" viewBox="0 0 100 100" style={{ flexShrink:0 }}>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--border)" strokeWidth="12" />
                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--green)" strokeWidth="12"
                      strokeDasharray={`${overallPct * 2.389} ${238.9 - overallPct * 2.389}`}
                      strokeDashoffset="59.7" strokeLinecap="round" style={{ transition:'stroke-dasharray .7s ease' }} />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="var(--text)"
                      fontFamily="Syne,sans-serif" fontSize="16" fontWeight="800">{overallPct}%</text>
                  </svg>
                  <div style={{ flex:1 }}>
                    {[['Done', doneTasks, 'var(--green)'], ['In Progress', inProg, 'var(--amber)'], ['To Do', todoTasks, 'var(--blue)'], ['Overdue', overdueTasks.length, 'var(--red)']].map(([l,n,c]) => (
                      <div key={l} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }} />
                        <div style={{ flex:1, fontSize:12, color:'var(--text2)' }}>{l}</div>
                        <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, color:c }}>{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick overdue list */}
              <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
                <SectionHeader>⚠️ Overdue Tasks</SectionHeader>
                {overdueTasks.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'var(--green)', fontSize:13 }}>🎉 No overdue tasks!</div>
                ) : (
                  <div style={{ overflowY:'auto', maxHeight:180 }}>
                    {overdueTasks.slice(0,8).map(t => (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                        <div style={{ width:6, height:6, borderRadius:2, background:'var(--red)', flexShrink:0 }} />
                        <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                          {t.assignee && <div style={{ width:18, height:18, borderRadius:'50%', background:memberColor(t.assignee), color:'var(--ink)', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif' }}>{getInitials(t.assignee)}</div>}
                          <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'var(--red)' }}>{fmtDate(t.due)}</span>
                        </div>
                      </div>
                    ))}
                    {overdueTasks.length > 8 && <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:'6px 0', fontFamily:'DM Mono,monospace' }}>+{overdueTasks.length - 8} more</div>}
                  </div>
                )}
              </div>
            </div>

            {/* Member completion quick view */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <SectionHeader>👥 Team Completion Snapshot</SectionHeader>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                {memberStats.sort((a,b) => b.pct - a.pct).map(m => (
                  <div key={m.name} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:memberColor(m.name), color:'var(--ink)', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{getInitials(m.name)}</div>
                      <div style={{ flex:1, overflow:'hidden' }}>
                        <div style={{ fontWeight:600, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name.split(' ')[0]}</div>
                        <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'DM Mono,monospace' }}>{m.done}/{m.total} tasks</div>
                      </div>
                      <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color: m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{m.pct}%</div>
                    </div>
                    <Bar pct={m.pct} color={m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--amber)' : 'var(--red)'} />
                    {m.overdue > 0 && <div style={{ fontSize:10, color:'var(--red)', marginTop:5, fontFamily:'DM Mono,monospace' }}>⚠ {m.overdue} overdue</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ MEMBERS TAB ════ */}
        {activeTab === 'members' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <SectionHeader>👥 Per-Member Task Breakdown</SectionHeader>
            {memberStats.length === 0 && <div style={{ textAlign:'center', padding:40, color:'var(--text2)', fontSize:13 }}>No tasks assigned yet.</div>}
            {memberStats.sort((a,b) => b.pct - a.pct).map(m => (
              <div key={m.name} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
                {/* Member header */}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'16px 18px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:memberColor(m.name), color:'var(--ink)', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{INITIALS_MAP[m.name] || getInitials(m.name)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15 }}>{m.name}</div>
                    <div style={{ fontSize:11, color:'var(--text2)', fontFamily:'DM Mono,monospace', marginTop:2 }}>
                      {m.total} tasks · {m.done} done · {m.inprog} in progress · {m.todo} to do
                      {m.overdue > 0 && <span style={{ color:'var(--red)', marginLeft:8 }}>· ⚠ {m.overdue} overdue</span>}
                    </div>
                  </div>
                  {/* Completion circle */}
                  <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink:0 }}>
                    <circle cx="26" cy="26" r="20" fill="none" stroke="var(--border)" strokeWidth="6" />
                    <circle cx="26" cy="26" r="20" fill="none"
                      stroke={m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--amber)' : 'var(--red)'}
                      strokeWidth="6"
                      strokeDasharray={`${m.pct * 1.257} ${125.7 - m.pct * 1.257}`}
                      strokeDashoffset="31.4" strokeLinecap="round"
                      style={{ transition:'stroke-dasharray .7s ease' }} />
                    <text x="26" y="26" textAnchor="middle" dominantBaseline="central"
                      fill="var(--text)" fontFamily="Syne,sans-serif" fontSize="10" fontWeight="800">{m.pct}%</text>
                  </svg>
                  {/* SS score badge */}
                  <div style={{ background:'var(--amberP)', border:'1px solid var(--amber)', borderRadius:8, padding:'8px 14px', textAlign:'center', flexShrink:0 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800, color:'var(--amber)', lineHeight:1 }}>{m.ss.score}</div>
                    <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'var(--text2)', letterSpacing:1, marginTop:2 }}>SS pts</div>
                  </div>
                </div>

                {/* Stat bars */}
                <div style={{ padding:'14px 18px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, borderBottom:'1px solid var(--border)' }}>
                  {[['✅ Done', m.done, m.total, 'var(--green)'], ['⏳ In Progress', m.inprog, m.total, 'var(--amber)'], ['⚠️ Overdue', m.overdue, m.total, 'var(--red)']].map(([l,n,tot,c]) => (
                    <div key={l}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
                        <span style={{ color:'var(--text2)' }}>{l}</span>
                        <span style={{ fontFamily:'DM Mono,monospace', fontWeight:600, color:c }}>{n}</span>
                      </div>
                      <Bar pct={tot ? n/tot*100 : 0} color={c} height={6} />
                    </div>
                  ))}
                </div>

                {/* Task list */}
                {m.tasks.length > 0 && (
                  <div style={{ padding:'12px 18px' }}>
                    <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>Tasks</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {m.tasks.map(t => {
                        const isDone = t.status === 'done';
                        const isOv   = t.due && new Date(t.due) < today && !isDone;
                        const stColor = isDone ? 'var(--green)' : t.status === 'inprogress' ? 'var(--amber)' : 'var(--blue)';
                        const stLabel = isDone ? 'Done' : t.status === 'inprogress' ? 'In Progress' : 'To Do';
                        return (
                          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'var(--surface2)', borderRadius:6, fontSize:12, opacity: isDone ? 0.7 : 1 }}>
                            <div style={{ width:6, height:6, borderRadius:2, background: isDone ? 'var(--green)' : isOv ? 'var(--red)' : stColor, flexShrink:0 }} />
                            <div style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--text2)' : 'var(--text)' }}>{t.title}</div>
                            {t.tag && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:8, background:'var(--border)', color:'var(--text2)', fontFamily:'DM Mono,monospace', flexShrink:0 }}>{t.tag}</span>}
                            <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, padding:'2px 6px', borderRadius:8, background:`${stColor}20`, color:stColor, flexShrink:0 }}>{stLabel}</span>
                            {t.due && <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, color: isOv ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--text3)', flexShrink:0 }}>{isOv ? '⚠ ' : ''}{fmtDate(t.due)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════ PROGRESS TAB ════ */}
        {activeTab === 'progress' && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* Monthly task distribution chart */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:20 }}>
              <SectionHeader>📅 Tasks by Month</SectionHeader>
              {activeMonths.length === 0 ? (
                <div style={{ textAlign:'center', padding:30, color:'var(--text2)', fontSize:13 }}>No due dates set on tasks yet.</div>
              ) : (
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160, padding:'0 4px' }}>
                  {activeMonths.map(m => {
                    const done = completedByMonth[m] || 0;
                    const todo = todoByMonth[m] || 0;
                    const total = done + todo;
                    const maxVal = Math.max(...activeMonths.map(mo => (completedByMonth[mo]||0)+(todoByMonth[mo]||0)), 1);
                    const barH = Math.round((total / maxVal) * 130);
                    const doneH = total ? Math.round((done / total) * barH) : 0;
                    const todoH = barH - doneH;
                    return (
                      <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                        <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)' }}>{total}</div>
                        <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:1, alignItems:'stretch' }}>
                          <div style={{ height:todoH, background:'var(--blue)', borderRadius:'3px 3px 0 0', opacity:.8, minHeight: todo > 0 ? 3 : 0 }} title={`To Do: ${todo}`} />
                          <div style={{ height:doneH, background:'var(--green)', borderRadius: todo > 0 ? '0' : '3px 3px 0 0', minHeight: done > 0 ? 3 : 0 }} title={`Done: ${done}`} />
                        </div>
                        <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)' }}>{MONTHS[m]}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display:'flex', gap:16, marginTop:12, justifyContent:'center' }}>
                {[['var(--green)','Completed'],['var(--blue)','To Do / Pending']].map(([c,l]) => (
                  <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text2)' }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:c }} />{l}
                  </div>
                ))}
              </div>
            </div>

            {/* Completion rate leaderboard */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:20 }}>
              <SectionHeader>🏅 Completion Rate — Team Ranking</SectionHeader>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {memberStats.filter(m => m.total > 0).sort((a,b) => b.pct - a.pct).map((m, i) => (
                  <div key={m.name} style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, width:24, textAlign:'center', color: i===0?'#c9a227':i===1?'#8a9ba8':i===2?'#a0522d':'var(--text3)' }}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                    </div>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:memberColor(m.name), color:'var(--ink)', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{getInitials(m.name)}</div>
                    <div style={{ width:130, fontSize:12, fontWeight:600, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                    <Bar pct={m.pct} color={m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--amber)' : 'var(--red)'} />
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, minWidth:42, textAlign:'right', color: m.pct >= 70 ? 'var(--green)' : m.pct >= 40 ? 'var(--amber)' : 'var(--red)' }}>{m.pct}%</div>
                    <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', minWidth:60, textAlign:'right' }}>{m.done}/{m.total}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue detail */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <SectionHeader>⚠️ Overdue Tasks Detail</SectionHeader>
              {overdueTasks.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--green)', fontSize:13 }}>🎉 No overdue tasks across the team!</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {overdueTasks.sort((a,b) => new Date(a.due) - new Date(b.due)).map(t => {
                    const daysOver = Math.floor((today - new Date(t.due + 'T00:00:00')) / 86400000);
                    return (
                      <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(249,96,96,.04)', border:'1px solid rgba(249,96,96,.2)', borderRadius:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:13 }}>{t.title}</div>
                          {t.desc && <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{t.desc}</div>}
                        </div>
                        {t.tag && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:8, background:'var(--border)', color:'var(--text2)', fontFamily:'DM Mono,monospace', flexShrink:0 }}>{t.tag}</span>}
                        {t.assignee && (
                          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                            <div style={{ width:22, height:22, borderRadius:'50%', background:memberColor(t.assignee), color:'var(--ink)', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif' }}>{getInitials(t.assignee)}</div>
                            <span style={{ fontSize:11, color:'var(--text2)' }}>{t.assignee.split(' ')[0]}</span>
                          </div>
                        )}
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--red)', fontWeight:600 }}>📅 {fmtDate(t.due)}</div>
                          <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--red)', opacity:.7 }}>{daysOver}d overdue</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ SUPER STRIKER TAB ════ */}
        {activeTab === 'superstriker' && (
          <div style={{ animation:'fadeUp .3s ease' }}>

            {/* Quick stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
              <StatCard icon="⚡" label="Weeks Completed"   value={ssHistory.length} color="var(--amber)" sub="of 52 this year" />
              <StatCard icon="🏆" label="Total Nominations" value={Object.values(allVotes).flat().length} color="var(--amberL)" />
              <StatCard icon="🎖️" label="Most Wins"         value={Math.max(...TEAM.map(n => ssScores[n]?.wins||0), 0)} color="var(--green)" sub={TEAM.find(n => (ssScores[n]?.wins||0) === Math.max(...TEAM.map(n2 => ssScores[n2]?.wins||0), 0)) || '—'} />
              <StatCard icon="📊" label="Top Score"         value={Math.max(...TEAM.map(n => ssScores[n]?.score||0), 0)} color="var(--amber)" sub={TEAM.find(n => (ssScores[n]?.score||0) === Math.max(...TEAM.map(n2 => ssScores[n2]?.score||0), 0)) || '—'} />
              <StatCard icon="🎯" label="Task Bonuses Given" value={Object.values(taskBonus).flat().length} color="var(--green)" sub="+2 pts each" />
            </div>

            {/* Task Bonus Panel */}
            <div style={{ background:'rgba(62,207,142,.04)', border:'1px solid rgba(62,207,142,.2)', borderRadius:10, padding:20, marginBottom:20 }}>
              <SectionHeader>🎯 Task Completion Bonus History</SectionHeader>
              <div style={{ fontSize:12, color:'var(--text2)', marginBottom:14, lineHeight:1.6 }}>
                Auto-awarded every <strong style={{ color:'var(--text)' }}>Monday 7:30 AM</strong> — members who completed <strong style={{ color:'var(--text)' }}>all tasks due that week</strong> earn <strong style={{ color:'var(--green)' }}>+2 SS points</strong>. This runs alongside the regular vote announcement.
              </div>
              {Object.keys(taskBonus).length === 0 ? (
                <div style={{ textAlign:'center', padding:'16px 0', color:'var(--text3)', fontSize:12, fontFamily:'DM Mono,monospace' }}>No task bonuses awarded yet. First check runs Monday 7:30 AM.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {Object.keys(taskBonus).sort().reverse().map(wkId => {
                    const winners = taskBonus[wkId] || [];
                    const wkNum = wkId.split('-W')[1];
                    return (
                      <div key={wkId} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--surface2)', border:'1px solid rgba(62,207,142,.15)', borderLeft:'3px solid var(--green)', borderRadius:'0 8px 8px 0' }}>
                        <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text2)', whiteSpace:'nowrap', minWidth:52 }}>Week {wkNum}</div>
                        <div style={{ flex:1, display:'flex', flexWrap:'wrap', gap:6 }}>
                          {winners.map(name => (
                            <div key={name} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(62,207,142,.1)', border:'1px solid rgba(62,207,142,.25)', borderRadius:20, padding:'3px 10px', fontSize:11 }}>
                              <div style={{ width:18, height:18, borderRadius:'50%', background:memberColor(name), color:'var(--ink)', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif' }}>{getInitials(name)}</div>
                              <span style={{ fontWeight:600, color:'var(--text)' }}>{name.split(' ')[0]}</span>
                              <span style={{ color:'var(--green)', fontFamily:'DM Mono,monospace', fontSize:10 }}>+2</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--green)', flexShrink:0 }}>{winners.length} member{winners.length!==1?'s':''}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SS Leaderboard */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:20 }}>
              <SectionHeader>🏆 Super Striker Leaderboard</SectionHeader>
              {ssLeaderboard.map((m, i) => {
                const pct = Math.round(m.score / maxSsScore * 100);
                const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1;
                const barC  = i===0?'#c9a227':i===1?'#8a9ba8':i===2?'#a0522d':'var(--amber)';
                return (
                  <div key={m.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background: i < 3 ? `${barC}08` : 'transparent', border:`1px solid ${i < 3 ? barC+'30' : 'transparent'}`, borderRadius:6, marginBottom:6 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, width:26, textAlign:'center', flexShrink:0 }}>{medal}</div>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:memberColor(m.name), color:'var(--ink)', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{INITIALS_MAP[m.name] || getInitials(m.name)}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                        {m.name}
                        {recentBonusWinners.includes(m.name) && (
                          <span style={{ fontSize:9, background:'rgba(62,207,142,.12)', border:'1px solid rgba(62,207,142,.3)', color:'var(--green)', borderRadius:10, padding:'1px 7px', fontFamily:'DM Mono,monospace' }}>🎯 +2</span>
                        )}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text2)', marginTop:1, fontStyle:'italic' }}>{m.wins} win{m.wins!==1?'s':''} · {m.reason}</div>
                    </div>
                    <Bar pct={pct} color={barC} />
                    <div style={{ textAlign:'right', minWidth:40 }}>
                      <div style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:700, color:barC, lineHeight:1 }}>{m.score}</div>
                      <div style={{ fontSize:9, color:'var(--text2)', fontFamily:'DM Mono,monospace' }}>pts</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly winners history */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 }}>
              <SectionHeader>📅 All Weekly Winners</SectionHeader>
              {ssHistory.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text2)', fontSize:13 }}>No winners announced yet. First announcement is Monday 7:30 AM.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[...ssHistory].reverse().map((w, i) => (
                    <div key={i} style={{ display:'flex', gap:12, padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderLeft:`3px solid var(--amber)`, borderRadius:'0 6px 6px 0' }}>
                      <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text2)', whiteSpace:'nowrap', marginTop:2, minWidth:48 }}>Week {w.weekNum}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:24, height:24, borderRadius:'50%', background:memberColor(w.winner), color:'var(--ink)', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{getInitials(w.winner)}</div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{w.winner} ⚡</div>
                          <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--amber)' }}>{w.votes} nomination{w.votes!==1?'s':''}</span>
                        </div>
                        <div style={{ fontSize:11, color:'var(--text2)', marginTop:3, fontStyle:'italic' }}>"{w.reason}"</div>
                      </div>
                      <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', flexShrink:0, whiteSpace:'nowrap' }}>{new Date(w.ts).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
