import { useState, useEffect, useRef, useCallback } from 'react';
import { TEAM, INITIALS_MAP, PILLARS, SS_KEYS, TASK_BONUS_PTS, PALETTE, memberColor, getInitials } from '../constants.js';
import { storageGet, storageSet } from '../storage.js';
import {
  getWeekId, getWeekNum, getPrevWeekId, getPrevWeekBounds, getVotingStatus,
  shouldAnnounce, fmtCountdown, getStatusCountdown, getStatusLabel,
} from '../weekUtils.js';

const C = {
  ink:'#1a1520', paper:'#f5f0f8', amber:'#e8185a', amberL:'#ff4d82',
  rust:'#e8402a', sage:'#2ab87a', cream:'#faf7fc', mid:'#8070a0', border:'#d8cce8',
};

function blankScores(teamList) {
  return Object.fromEntries((teamList || TEAM).map(n => [n, { score:0, wins:0, reason:'No nominations yet' }]));
}

export default function SuperStriker({ currentUser, isAdmin, showToast }) {
  const TEAM_LIST   = TEAM;
  const PILLAR_LIST = PILLARS;
  const [tab, setTab]           = useState('board');
  const [scores, setScores]     = useState(() => blankScores(TEAM));
  const [history, setHistory]   = useState([]);
  const [allVotes, setAllVotes] = useState({});
  const [announced, setAnn]     = useState({});
  const [votedMap, setVotedMap] = useState({});
  const [taskBonus, setTaskBonus] = useState({});
  const [loaded, setLoaded]     = useState(false);
  const [tick, setTick]         = useState(0);
  const timerRef                = useRef(null);

  const weekId   = getWeekId();
  const weekNum  = getWeekNum();
  const status   = getVotingStatus();
  const weekVotes = allVotes[weekId] || [];
  const cd       = getStatusCountdown(status);
  const cdLabel  = getStatusLabel(status);

  // Load data
  useEffect(() => {
    (async () => {
      try { const r = await storageGet(SS_KEYS.scores);   if (r) setScores(r); } catch(e) {}
      try { const r = await storageGet(SS_KEYS.history);  if (r) setHistory(r); } catch(e) {}
      try { const r = await storageGet(SS_KEYS.votes);    if (r) setAllVotes(r); } catch(e) {}
      try { const r = await storageGet(SS_KEYS.ann);      if (r) setAnn(r); } catch(e) {}
      try { const r = await storageGet(SS_KEYS.voted);    if (r) setVotedMap(r); } catch(e) {}
      try { const r = await storageGet(SS_KEYS.taskBonus);if (r) setTaskBonus(r); } catch(e) {}
      setLoaded(true);
    })();
  }, []);

  // Countdown tick
  useEffect(() => {
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-announce
  useEffect(() => {
    if (!loaded) return;
    tryAutoAnnounce();
    const iv = setInterval(tryAutoAnnounce, 60000);
    return () => clearInterval(iv);
  }, [loaded, announced, allVotes]);

  function tryAutoAnnounce() {
    if (!shouldAnnounce()) return;
    const prev = getPrevWeekId();
    if (announced[prev]) return;
    const votes = allVotes[prev] || [];
    if (!votes.length) return;
    const entry = buildWinner(votes, prev);
    if (!entry) return;
    doAnnounce(entry, prev);
    // Also check task completion bonus for previous week
    checkTaskBonus(prev);
    showToast(`⚡ ${entry.winner} is Super Striker of Week ${entry.weekNum}!`);
  }

  async function checkTaskBonus(wkId) {
    // Don't award twice for same week
    if (taskBonus[wkId]) return;
    // Load latest tasks
    let tasks = [];
    try { const r = await storageGet('era92_tasks_v1'); if (r?.tasks) tasks = r.tasks; } catch(e) {}
    if (!tasks.length) return;

    const { start, end } = getPrevWeekBounds();
    const bonusWinners = [];

    TEAM_LIST.forEach(name => {
      // Tasks due in prev week assigned to this member
      const weekTasks = tasks.filter(t =>
        t.assignee === name &&
        t.due &&
        new Date(t.due + 'T00:00:00') >= start &&
        new Date(t.due + 'T00:00:00') <= end
      );
      if (!weekTasks.length) return; // no tasks due = no bonus
      const allDone = weekTasks.every(t => t.status === 'done');
      if (allDone) bonusWinners.push(name);
    });

    if (!bonusWinners.length) return;

    // Award +2 to each winner
    setScores(prev => {
      const next = { ...prev };
      bonusWinners.forEach(name => {
        if (!next[name]) next[name] = { score: 0, wins: 0, reason: '' };
        next[name] = { ...next[name], score: (next[name].score || 0) + TASK_BONUS_PTS };
      });
      storageSet(SS_KEYS.scores, next);
      return next;
    });

    // Record which week was awarded + who got it
    const updated = { ...taskBonus, [wkId]: bonusWinners };
    setTaskBonus(updated);
    storageSet(SS_KEYS.taskBonus, updated);

    showToast(`🎯 Task bonus +${TASK_BONUS_PTS} awarded to ${bonusWinners.length} member${bonusWinners.length > 1 ? 's' : ''}!`);
  }

  function buildWinner(votes, wkId) {
    if (!votes.length) return null;
    const tally = {};
    votes.forEach(v => { tally[v.nominee] = (tally[v.nominee] || 0) + 1; });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const [winner] = sorted[0];
    const cCount = {};
    votes.filter(v => v.nominee === winner).forEach(v => (v.pillars || []).forEach(p => { cCount[p] = (cCount[p] || 0) + 1; }));
    const topP = Object.entries(cCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(([p]) => p);
    const reasons = votes.filter(v => v.nominee === winner && v.reason).map(v => v.reason);
    const reason = topP.length
      ? `Recognised for: ${topP.join(', ')}${reasons[0] ? ` — "${reasons[0]}"` : ''}`
      : (reasons[0] || 'Outstanding performance this week');
    return { wkId, weekNum: getWeekNum(), winner, votes: sorted[0][1], reason, tally: Object.fromEntries(sorted), ts: new Date().toISOString() };
  }

  function doAnnounce(entry, wkId) {
    setScores(prev => {
      const next = { ...prev };
      Object.entries(entry.tally).forEach(([name, count], i) => {
        if (!next[name]) next[name] = { score:0, wins:0, reason:'' };
        next[name] = { ...next[name], score: (next[name].score || 0) + count + (i === 0 ? 3 : 0) };
      });
      next[entry.winner] = { ...next[entry.winner], wins:(next[entry.winner].wins||0)+1, reason:entry.reason };
      storageSet(SS_KEYS.scores, next);
      return next;
    });
    setHistory(prev => { const n = [...prev, entry]; storageSet(SS_KEYS.history, n); return n; });
    setAnn(prev => { const n = { ...prev, [wkId]:true }; storageSet(SS_KEYS.ann, n); return n; });
  }

  async function submitVote(voter, nominee, pillars, reason) {
    if (status !== 'open') return { err: 'Voting is closed.' };
    if ((votedMap[weekId] || []).includes(voter)) return { err: 'You already voted this week.' };
    if (voter === nominee) return { err: 'You cannot nominate yourself.' };
    const vote = { voter, nominee, pillars, reason, ts: new Date().toISOString() };
    const nv = { ...allVotes, [weekId]: [...weekVotes, vote] };
    const nd = { ...votedMap, [weekId]: [...(votedMap[weekId] || []), voter] };
    setAllVotes(nv); setVotedMap(nd);
    await storageSet(SS_KEYS.votes, nv);
    await storageSet(SS_KEYS.voted, nd);
    return { ok: true };
  }

  async function forceAnnounce() {
    if (!weekVotes.length) { alert('No votes yet this week.'); return; }
    if (announced[weekId]) { alert('Already announced this week.'); return; }
    const entry = buildWinner(weekVotes, weekId);
    doAnnounce(entry, weekId);
    showToast(`⚡ ${entry.winner} is Super Striker of Week ${weekNum}!`);
  }

  async function resetWeek() {
    if (!window.confirm('Reset all votes for the current week?')) return;
    const nv = { ...allVotes }; delete nv[weekId];
    const nd = { ...votedMap }; delete nd[weekId];
    const na = { ...announced }; delete na[weekId];
    setAllVotes(nv); setVotedMap(nd); setAnn(na);
    await storageSet(SS_KEYS.votes, nv);
    await storageSet(SS_KEYS.voted, nd);
    await storageSet(SS_KEYS.ann, na);
    showToast('Week reset.');
  }

  const latestWin = [...history].reverse()[0] || null;
  const sorted = TEAM_LIST.map(n => ({ name:n, ...(scores[n]||{score:0,wins:0,reason:'No nominations yet'}) })).sort((a,b)=>b.score-a.score);
  const maxScore = Math.max(...sorted.map(s => s.score), 1);
  // Members who got a task bonus this week or last week
  const recentBonusWeek = taskBonus[getPrevWeekId()] || taskBonus[getWeekId()] || [];

  const statusColor = status==='open'?C.sage:status==='soon'?C.amber:C.rust;
  const statusLabel = status==='open'?'🟢 VOTING OPEN':status==='soon'?'⏳ OPENS SOON':'🔴 VOTING CLOSED';

  if (!loaded) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:40, animation:'spin 1s linear infinite' }}>⚡</div>
      <div style={{ fontFamily:'DM Mono,monospace', color:C.amber, letterSpacing:3, fontSize:11 }}>LOADING...</div>
    </div>
  );

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      {/* HERO */}
      <div style={{ background:'linear-gradient(135deg, #1a0814 0%, #0d0a0e 60%, #1a080a 100%)', padding:'24px 32px 18px', position:'relative', overflow:'hidden', borderBottom:'1px solid rgba(232,24,90,0.15)' }}>
        <div style={{ position:'absolute', top:-60, right:-40, width:250, height:250, border:'38px solid rgba(232,24,90,0.06)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, right:80, width:150, height:150, border:'24px solid rgba(232,64,42,0.05)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:3, textTransform:'uppercase', color:'var(--primary)' }}>ERA92 Elevate · 2026 Performance Tracker</div>
        </div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(20px,3vw,34px)', fontWeight:900, lineHeight:1.05, color:C.paper }}>
          Super Striker <span style={{ background:'linear-gradient(135deg,#e8185a,#e8402a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>of the Week</span>
        </h1>
        <p style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>6-pillar peer nomination · Auto-announced every Monday 7:30 AM</p>
        <div style={{ display:'flex', gap:7, marginTop:9, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ background:statusColor, color:'#fff', padding:'3px 11px', borderRadius:3, fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:'1.5px', fontWeight:600 }}>{statusLabel}</span>
          <span style={{ background:'rgba(255,255,255,.05)', color:'var(--text2)', padding:'3px 11px', borderRadius:3, fontFamily:'DM Mono,monospace', fontSize:10 }}>{cdLabel}: {fmtCountdown(cd)}</span>
          <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text3)' }}>WEEK {weekNum} · {new Date().getFullYear()} · {weekVotes.length} vote{weekVotes.length!==1?'s':''}</span>
        </div>
      </div>

      {/* NAV */}
      <div style={{ display:'flex', background:'var(--surface)', borderBottom:'1px solid rgba(232,24,90,0.1)', padding:'0 32px', overflowX:'auto' }}>
        {[['board','🏆 Leaderboard'],['vote','⚡ Nominate'],['history','📅 Winners'],['howto','ℹ️ How It Works'],
          ...(isAdmin ? [['ssadmin','🔐 SS Admin']] : [])].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background:'none', border:'none', borderBottom:`2px solid ${tab===id?'var(--primary)':'transparent'}`,
            color: tab===id ? 'var(--primaryL)' : 'var(--text2)', fontFamily:'DM Mono,monospace', fontSize:10,
            letterSpacing:'2px', textTransform:'uppercase', padding:'10px 14px', cursor:'pointer', whiteSpace:'nowrap',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth:1000, margin:'0 auto', padding:'24px 18px 60px' }}>

        {/* LEADERBOARD */}
        {tab === 'board' && (
          <div style={{ animation:'fadeUp .35s ease' }}>
            {/* stats strip */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', background:'linear-gradient(135deg,#e8185a,#e8402a)', borderRadius:4, overflow:'hidden', marginBottom:18 }}>
              {[[14,'Strikers'],[history.length,'Weeks Done'],[weekVotes.length,'Votes This Week'],[52-history.length,'Weeks Left']].map(([n,l])=>(
                <div key={l} style={{ padding:'14px 8px', borderRight:'1px solid rgba(255,255,255,.18)', textAlign:'center' }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:C.ink, lineHeight:1 }}>{n}</div>
                  <div style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'1.5px', color:'rgba(26,18,8,.58)', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* winner banner */}
            {latestWin ? (
              <div style={{ background:'linear-gradient(135deg,#130f05,#1e1608)', border:'2px solid #c9a227', borderRadius:5, padding:'18px 22px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ fontSize:40, flexShrink:0 }}>⚡</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:3, textTransform:'uppercase', color:C.amber, marginBottom:3 }}>Super Striker · Week {latestWin.weekNum} · Announced Monday 7:30 AM</div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(18px,2.5vw,26px)', fontWeight:900, color:C.amberL, lineHeight:1.1 }}>{latestWin.winner}</div>
                  <div style={{ fontSize:12, color:'#a89880', marginTop:4, fontStyle:'italic' }}>"{latestWin.reason}"</div>
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:36, fontWeight:700, color:'#c9a227', lineHeight:1 }}>{latestWin.votes}</div>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'#6a5c48', letterSpacing:2, textTransform:'uppercase' }}>nominations</div>
                </div>
              </div>
            ) : (
              <div style={{ background:'var(--surface2)', border:'2px dashed var(--border2)', borderRadius:5, padding:'18px 22px', marginBottom:16, textAlign:'center' }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, marginBottom:4, color:'var(--text)' }}>⚡ Week {weekNum} — Voting in Progress</div>
                <p style={{ fontSize:12, color:C.mid }}>First Super Striker auto-announced <strong>Monday 7:30 AM</strong>. Cast your nomination!</p>
              </div>
            )}

            {/* countdown */}
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, padding:'10px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'var(--text3)', letterSpacing:2, textTransform:'uppercase' }}>{cdLabel}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.amberL }}>{fmtCountdown(cd)}</div>
            </div>

            {/* leaderboard rows */}
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, marginBottom:3, color:'var(--text)' }}>Annual Leaderboard</div>
            <div style={{ fontSize:11, color:C.mid, fontFamily:'DM Mono,monospace', marginBottom:14 }}>6 ERA92 pillars · Auto-updated Monday 7:30 AM · Top scorer wins Year-End Award</div>
            {sorted.map((m, i) => {
              const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1;
              const bg    = i===0?'rgba(201,162,39,.08)':i===1?'rgba(138,155,168,.05)':i===2?'rgba(160,82,45,.05)':'var(--surface)';
              const bd    = i===0?'rgba(201,162,39,.3)':i===1?'rgba(138,155,168,.2)':i===2?'rgba(160,82,45,.2)':'var(--border)';
              const bar   = i===0?'#c9a227':i===1?'#8a9ba8':i===2?'#a0522d':'var(--amber)';
              const pct   = Math.round(m.score/maxScore*100);
              return (
                <div key={m.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', background:bg, border:`1px solid ${bd}`, borderRadius:4, marginBottom:7 }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, width:26, textAlign:'center', flexShrink:0 }}>{medal}</div>
                  <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, background:`${memberColor(m.name)}22`, color:memberColor(m.name), flexShrink:0, fontFamily:'Syne,sans-serif' }}>{INITIALS_MAP[m.name]||getInitials(m.name)}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                      {m.name}
                      {recentBonusWeek.includes(m.name) && (
                        <span title={`+${TASK_BONUS_PTS} task completion bonus`} style={{ fontSize:10, background:'rgba(62,207,142,.12)', border:'1px solid rgba(62,207,142,.3)', color:'var(--green)', borderRadius:10, padding:'1px 7px', fontFamily:'DM Mono,monospace', letterSpacing:.5 }}>🎯 +{TASK_BONUS_PTS}</span>
                      )}
                    </div>
                    <div style={{ fontSize:10, color:C.mid, marginTop:1, fontStyle:'italic' }}>{m.wins} win{m.wins!==1?'s':''} · {m.reason}</div>
                  </div>
                  <div style={{ width:64, flexShrink:0 }}>
                    <div style={{ background:C.border, borderRadius:2, height:5 }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:2, background:bar, transition:'width .8s' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right', minWidth:44 }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:bar, lineHeight:1 }}>{m.score}</div>
                    <div style={{ fontSize:9, color:C.mid, fontFamily:'DM Mono,monospace' }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NOMINATE */}
        {tab === 'vote' && (
          <VoteTab weekNum={weekNum} weekId={weekId} votedMap={votedMap} submitVote={submitVote} status={status} cd={cd} cdLabel={cdLabel} C={C} team={TEAM_LIST} pillarList={PILLAR_LIST} />
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div style={{ animation:'fadeUp .35s ease' }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, marginBottom:3, color:'var(--text)' }}>Weekly Winners · 2026</div>
            <div style={{ fontSize:11, color:C.mid, fontFamily:'DM Mono,monospace', marginBottom:16 }}>Auto-announced every Monday 7:30 AM</div>
            {history.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:C.mid, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4 }}>
                <div style={{ fontSize:30, marginBottom:8 }}>⚡</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, marginBottom:4 }}>No winners yet</div>
                <div style={{ fontSize:12 }}>First Super Striker auto-announced Monday 7:30 AM!</div>
              </div>
            ) : [...history].reverse().map((w, i) => (
              <div key={i} style={{ display:'flex', gap:13, padding:'12px 15px', background:C.paper, border:`1px solid ${C.border}`, borderLeft:`4px solid ${C.amber}`, borderRadius:'0 4px 4px 0', marginBottom:8 }}>
                <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:C.mid, textTransform:'uppercase', whiteSpace:'nowrap', marginTop:2, minWidth:50 }}>Week {w.weekNum}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:C.ink }}>{w.winner} ⚡</div>
                  <div style={{ fontSize:10, color:C.amber, fontFamily:'DM Mono,monospace' }}>{w.votes} nominations · {new Date(w.ts).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>
                  <div style={{ fontSize:12, color:C.mid, marginTop:2, fontStyle:'italic' }}>"{w.reason}"</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HOW IT WORKS */}
        {tab === 'howto' && <HowItWorks C={C} />}

        {/* SS ADMIN */}
        {tab === 'ssadmin' && isAdmin && (
          <SSAdmin weekNum={weekNum} weekVotes={weekVotes} scores={scores} taskBonus={taskBonus} C={C} forceAnnounce={forceAnnounce} resetWeek={resetWeek} checkTaskBonus={checkTaskBonus} prevWeekId={getPrevWeekId()} team={TEAM_LIST} />
        )}
      </div>
    </div>
  );
}

// ── VOTE TAB ─────────────────────────────────────────────────
function VoteTab({ weekNum, weekId, votedMap, submitVote, status, cd, cdLabel, C, team, pillarList }) {
  const [voter, setVoter]   = useState('');
  const [nominee, setNom]   = useState('');
  const [pillars, setPills] = useState([]);
  const [reason, setReason] = useState('');
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState('');
  const [loading, setLoad]  = useState(false);
  const alreadyVoted = voter && (votedMap[weekId] || []).includes(voter);

  const sel = { background:C.cream, border:`1px solid ${C.border}`, borderRadius:3, padding:'9px 12px', fontSize:13, color:C.ink, outline:'none', width:'100%', cursor:'pointer', marginBottom:12, fontFamily:'DM Sans,sans-serif' };

  if (status === 'closed' || status === 'soon') {
    return (
      <div style={{ animation:'fadeUp .35s ease', textAlign:'center', maxWidth:460, margin:'0 auto' }}>
        <div style={{ background:C.ink, borderRadius:5, padding:'36px 28px' }}>
          <div style={{ fontSize:44, marginBottom:12 }}>{status==='closed'?'🔴':'⏳'}</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:C.amberL, marginBottom:8 }}>{status==='closed'?'Voting is Closed':'Voting Opens Soon'}</div>
          <div style={{ fontSize:13, color:'#a89880', lineHeight:1.8, marginBottom:20 }} dangerouslySetInnerHTML={{ __html: status==='closed'
            ? 'Voting closed <strong style="color:#fff">Friday at 6:00 PM</strong>.<br/>Next window opens <strong style="color:#fff">Monday at 7:00 AM</strong>.<br/>Winner announced <strong style="color:#fff">Monday at 7:30 AM</strong>.'
            : 'Voting opens today at <strong style="color:#fff">7:00 AM</strong>. Come back then!' }} />
          <div style={{ background:'rgba(255,255,255,.06)', borderRadius:3, padding:'12px 16px', display:'inline-block' }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'#6a5c48', letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>{cdLabel}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:C.amberL }}>{fmtCountdown(cd)}</div>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!voter) { setErr('Please select your name.'); return; }
    if (!nominee) { setErr('Please select a teammate.'); return; }
    if (!pillars.length) { setErr('Please select at least one pillar.'); return; }
    if (!reason.trim()) { setErr('Please describe what they did that stood out.'); return; }
    setLoad(true); setErr('');
    const r = await submitVote(voter, nominee, pillars, reason);
    setLoad(false);
    if (r.err) { setErr(r.err); return; }
    setDone(true);
  }

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, marginBottom:3, color:'var(--text)' }}>Nominate a Super Striker</div>
      <div style={{ fontSize:11, color:C.mid, fontFamily:'DM Mono,monospace', marginBottom:18 }}>Week {weekNum} · 🟢 Voting Open · Closes Friday 6:00 PM · {fmtCountdown(cd)} remaining</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'2.5px', textTransform:'uppercase', color:C.amber, marginBottom:14 }}>Your Nomination</div>
          {done ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'28px 16px', gap:10, animation:'pop .4s ease' }}>
              <div style={{ fontSize:44 }}>⚡</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:C.sage }}>Nomination Submitted!</div>
              <div style={{ fontSize:12, color:C.mid, maxWidth:260, lineHeight:1.6 }}>Your vote is saved privately. Winner auto-announced <strong>Monday 7:30 AM</strong>.</div>
              <div style={{ background:C.ink, color:C.amberL, fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:2, padding:'8px 16px', borderRadius:3, textTransform:'uppercase' }}>🤖 Auto-Announce: Monday 7:30 AM</div>
            </div>
          ) : (
            <div>
              <div style={{ background:C.ink, color:C.amberL, borderRadius:3, padding:'9px 12px', fontSize:11, fontFamily:'DM Mono,monospace', lineHeight:1.6, marginBottom:12 }}>🔒 Your vote is completely private.</div>
              {err && <div style={{ background:'rgba(184,76,30,.1)', border:`1px solid ${C.rust}`, borderRadius:3, padding:'9px 12px', fontSize:12, color:C.rust, marginBottom:10 }}>{err}</div>}
              <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', letterSpacing:'1.5px', textTransform:'uppercase', color:C.mid, marginBottom:5 }}>Your Name</div>
              <select style={sel} value={voter} onChange={e => { setVoter(e.target.value); setErr(''); }}>
                <option value="">— Who are you? —</option>
                {team.map(n => <option key={n}>{n}</option>)}
              </select>
              {alreadyVoted && <div style={{ fontSize:11, color:C.rust, marginBottom:8, fontFamily:'DM Mono,monospace' }}>⚠ You already voted this week.</div>}
              <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', letterSpacing:'1.5px', textTransform:'uppercase', color:C.mid, marginBottom:5 }}>Nominate a Teammate</div>
              <select style={sel} value={nominee} onChange={e => { setNom(e.target.value); setErr(''); }}>
                <option value="">— Select a teammate —</option>
                {team.filter(n => n !== voter).map(n => <option key={n}>{n}</option>)}
              </select>
              <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', letterSpacing:'1.5px', textTransform:'uppercase', color:C.mid, marginBottom:8 }}>Why do they deserve it?</div>
              {pillarList.map(p => {
                const isSelected = pillars.includes(p.label);
                return (
                  <div key={p.label} onClick={() => setPills(prev => prev.includes(p.label) ? prev.filter(x => x !== p.label) : [...prev, p.label])}
                    style={{ display:'flex', alignItems:'flex-start', gap:9, padding:'9px 11px', borderRadius:3, cursor:'pointer', marginBottom:6, background:isSelected?'rgba(212,130,10,.08)':C.paper, border:`1px solid ${isSelected?C.amber:C.border}`, transition:'all .15s' }}>
                    <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>{p.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:12, color:C.ink }}>{p.label}</div>
                      <div style={{ fontSize:10, color:C.mid, marginTop:1, lineHeight:1.4 }}>{p.desc}</div>
                    </div>
                    {isSelected && <span style={{ color:C.amber, fontWeight:700, fontSize:13, flexShrink:0 }}>✓</span>}
                  </div>
                );
              })}
              <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', letterSpacing:'1.5px', textTransform:'uppercase', color:C.mid, marginTop:10, marginBottom:5 }}>What did they do that stood out?</div>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe specifically what they did this week…"
                style={{ background:C.paper, border:`1px solid ${C.border}`, borderRadius:3, padding:'9px 12px', fontSize:13, color:C.ink, outline:'none', width:'100%', resize:'vertical', minHeight:68, fontFamily:'DM Sans,sans-serif' }} />
              <button onClick={handleSubmit} disabled={!status==='open'||alreadyVoted||loading}
                style={{ background:alreadyVoted?'#ddd4bc':C.amber, color:alreadyVoted?'#a89880':C.ink, border:'none', borderRadius:3, padding:'11px 22px', fontSize:13, fontWeight:600, cursor:alreadyVoted?'not-allowed':'pointer', width:'100%', marginTop:12, fontFamily:'DM Sans,sans-serif' }}>
                {loading?'Submitting…':alreadyVoted?'Already Voted This Week':'Submit Nomination ⚡'}
              </button>
            </div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.amber, marginBottom:12 }}>🕐 Schedule</div>
            {[['🟢','Monday 7:00 AM','Voting opens'],['🔴','Friday 6:00 PM','Voting closes'],['🤖','Monday 7:30 AM','Winner auto-announced']].map(([ic,t,d])=>(
              <div key={t} style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom:10 }}>
                <span style={{ fontSize:14, flexShrink:0 }}>{ic}</span>
                <div style={{ fontSize:12, color:C.ink }}><strong>{t}</strong><br/><span style={{ color:C.mid, fontSize:11 }}>{d}</span></div>
              </div>
            ))}
          </div>
          <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.amber, marginBottom:12 }}>Scoring</div>
            {[['+3','Win the week'],['+1','Per nomination received'],['×2','Double week (admin)']].map(([p,d])=>(
              <div key={p} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                <span style={{ color:C.mid }}>{d}</span><strong style={{ color:C.amber, fontFamily:'DM Mono,monospace' }}>{p}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HOW IT WORKS ─────────────────────────────────────────────
function HowItWorks({ C }) {
  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, marginBottom:3, color:'var(--text)' }}>How It Works</div>
      <div style={{ fontSize:11, color:C.mid, fontFamily:'DM Mono,monospace', marginBottom:18 }}>Everything the ERA92 Elevate team needs to know</div>
      <div style={{ background:C.ink, borderRadius:4, padding:'20px 24px', marginBottom:18 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:C.amberL, marginBottom:12 }}>🤖 Fully Automated — You Do Nothing</div>
        {[['1','Monday 7:00 AM','Voting opens. Each member submits one private nomination.'],
          ['2','Mon–Fri','Vote any time. Voting window closes Friday at 6:00 PM sharp.'],
          ['3','Monday 7:30 AM','System auto-tallies, picks winner, updates scores, announces result.'],
          ['4','Year-End','Highest cumulative score after 52 weeks wins Super Striker of the Year.']].map(([n,t,d])=>(
          <div key={n} style={{ display:'flex', gap:10, marginBottom:10 }}>
            <div style={{ background:C.amber, color:C.ink, borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:10, flexShrink:0, marginTop:1 }}>{n}</div>
            <div style={{ fontSize:13, color:'#c8b89a' }}><strong style={{ color:C.paper }}>{t}:</strong> {d}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.amber, marginBottom:14 }}>The 6 ERA92 Pillars</div>
          {pillarList.map(p => (
            <div key={p.label} style={{ display:'flex', gap:9, alignItems:'flex-start', padding:'8px 10px', background:C.paper, border:`1px solid ${C.border}`, borderRadius:3, marginBottom:7 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{p.icon}</span>
              <div><div style={{ fontWeight:600, fontSize:12, color:C.ink }}>{p.label}</div><div style={{ fontSize:10, color:C.mid, marginTop:1, lineHeight:1.4 }}>{p.desc}</div></div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.amber, marginBottom:12 }}>Privacy Rules</div>
            {[['🙈','No live vote counts shown during the week'],['🔒','Nobody sees who you nominated'],['📣','Only winner + reason announced'],['🚫','You cannot nominate yourself']].map(([i,t])=>(
              <div key={t} style={{ display:'flex', gap:8, fontSize:12, marginBottom:9, alignItems:'flex-start' }}><span style={{ fontSize:14 }}>{i}</span><span style={{ color:C.mid }}>{t}</span></div>
            ))}
          </div>
          <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:20 }}>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:C.amber, marginBottom:12 }}>Scoring</div>
            {[['+3','Win the week'],['+1','Per nomination received'],['×2','Double week (admin)']].map(([p,d])=>(
              <div key={p} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span style={{ color:C.mid }}>{d}</span><strong style={{ color:C.amber, fontFamily:'DM Mono,monospace' }}>{p}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SS ADMIN ─────────────────────────────────────────────────
function SSAdmin({ weekNum, weekVotes, scores, taskBonus, C, forceAnnounce, resetWeek, checkTaskBonus, prevWeekId, team }) {
  const tally = {};
  weekVotes.forEach(v => { tally[v.nominee] = (tally[v.nominee] || 0) + 1; });
  const tallyList = Object.entries(tally).sort((a,b) => b[1]-a[1]);
  const prevBonusWinners = taskBonus[prevWeekId] || [];

  return (
    <div style={{ animation:'fadeUp .35s ease' }}>
      <div style={{ background:'var(--rust)', color:'#fff', borderRadius:4, padding:'12px 18px', marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700 }}>🔐 Super Striker Admin</div>
          <div style={{ fontSize:11, opacity:.8 }}>Confidential — do not share this screen.</div>
        </div>
      </div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ fontSize:24 }}>🤖</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, color:'var(--amberL)', marginBottom:2 }}>Automation Active</div>
          <div style={{ fontSize:12, color:'var(--text2)' }}>Opens Mon 7:00 AM · Closes Fri 6:00 PM · Announces Mon 7:30 AM · Task bonus auto-checks same time.</div>
        </div>
        <div style={{ background:'var(--sage)', color:'#fff', padding:'3px 11px', borderRadius:3, fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:2 }}>● RUNNING</div>
      </div>

      {/* Task Bonus section */}
      <div style={{ background:'rgba(62,207,142,.05)', border:'1px solid rgba(62,207,142,.2)', borderRadius:8, padding:16, marginBottom:16 }}>
        <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--green)', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
          <span>🎯 Task Completion Bonus — +{TASK_BONUS_PTS} pts</span>
          <button onClick={() => checkTaskBonus(prevWeekId)} style={{ background:'var(--green)', color:'var(--ink)', border:'none', borderRadius:4, padding:'5px 12px', fontSize:10, fontFamily:'DM Mono,monospace', letterSpacing:1, cursor:'pointer' }}>
            ↻ Re-check Now
          </button>
        </div>
        <div style={{ fontSize:12, color:'var(--text2)', marginBottom:10 }}>
          Automatically awarded every Monday 7:30 AM to members who completed <strong style={{ color:'var(--text)' }}>all their tasks due last week</strong>.
        </div>
        {prevBonusWinners.length === 0 ? (
          <div style={{ fontSize:12, color:'var(--text3)', fontFamily:'DM Mono,monospace', padding:'8px 0' }}>No task bonuses awarded last week yet.</div>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
            {prevBonusWinners.map(name => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(62,207,142,.1)', border:'1px solid rgba(62,207,142,.3)', borderRadius:20, padding:'4px 12px', fontSize:12 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:memberColor(name), color:'var(--ink)', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif' }}>{getInitials(name)}</div>
                <span style={{ fontWeight:600, color:'var(--text)' }}>{name.split(' ')[0]}</span>
                <span style={{ color:'var(--green)', fontFamily:'DM Mono,monospace', fontSize:10 }}>+{TASK_BONUS_PTS}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'2.5px', textTransform:'uppercase', color:C.rust, marginBottom:12 }}>Week {weekNum} Live Tally</div>
          {tallyList.length === 0
            ? <div style={{ textAlign:'center', padding:18, color:C.mid, fontSize:12 }}>No votes yet this week.</div>
            : tallyList.map(([name, count], i) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px', background:i===0?'#fffae8':C.paper, border:`1px solid ${i===0?'#c9a227':C.border}`, borderRadius:4, marginBottom:6 }}>
                {i===0 && <span>👑</span>}
                <div style={{ flex:1, fontWeight:600, fontSize:13, color:C.ink }}>{name}</div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:C.amber }}>{count}</div>
                <div style={{ fontSize:10, color:C.mid, fontFamily:'DM Mono,monospace' }}>votes</div>
              </div>
            ))}
          <div style={{ background:'rgba(232,24,90,.06)', border:`1px solid rgba(232,24,90,.2)`, borderRadius:4, padding:12, marginTop:12 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:3, color:C.ink }}>Manual Controls</div>
            <div style={{ fontSize:11, color:C.mid, marginBottom:9 }}>System auto-announces Monday 7:30 AM. Use only if needed.</div>
            <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
              <button onClick={forceAnnounce} style={{ background:'var(--sage)', color:'#fff', border:'none', borderRadius:3, padding:'8px 13px', fontSize:11, fontFamily:'DM Mono,monospace', letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>⚡ Announce Now</button>
              <button onClick={resetWeek} style={{ background:'none', color:C.rust, border:`1px solid ${C.rust}`, borderRadius:3, padding:'8px 13px', fontSize:11, fontFamily:'DM Mono,monospace', letterSpacing:1, textTransform:'uppercase', cursor:'pointer' }}>🗑 Reset Week</button>
            </div>
          </div>
        </div>
        <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'2.5px', textTransform:'uppercase', color:C.rust, marginBottom:12 }}>Raw Votes ({weekVotes.length})</div>
          <div style={{ overflowY:'auto', maxHeight:300 }}>
            {weekVotes.length === 0
              ? <div style={{ textAlign:'center', padding:18, color:C.mid, fontSize:12 }}>No votes submitted yet.</div>
              : weekVotes.map((v, i) => (
                <div key={i} style={{ padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontWeight:600, color:C.ink }}>{v.voter}</span>
                    <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:C.mid }}>{new Date(v.ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <div style={{ color:C.ink }}>→ <span style={{ background:'rgba(232,24,90,.1)', border:`1px solid rgba(232,24,90,.3)`, borderRadius:10, padding:'1px 9px', fontSize:10, fontFamily:'DM Mono,monospace' }}>{v.nominee}</span></div>
                  {v.reason && <div style={{ fontSize:11, color:C.mid, fontStyle:'italic', marginTop:2 }}>"{v.reason}"</div>}
                </div>
              ))}
          </div>
        </div>
      </div>
      <div style={{ background:C.cream, border:`1px solid ${C.border}`, borderRadius:4, padding:18 }}>
        <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'2.5px', textTransform:'uppercase', color:C.rust, marginBottom:12 }}>All Scores</div>
        {team.map(n => {
          const s = scores[n] || { score:0, wins:0 };
          const hasBonusThisWeek = prevBonusWinners.includes(n);
          return (
            <div key={n} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 11px', background:C.paper, border:`1px solid ${C.border}`, borderRadius:3, marginBottom:5 }}>
              <div style={{ flex:1, fontWeight:500, fontSize:12, color:C.ink }}>{n}</div>
              {hasBonusThisWeek && <span style={{ fontSize:9, color:'var(--green)', fontFamily:'DM Mono,monospace', background:'rgba(62,207,142,.1)', border:'1px solid rgba(62,207,142,.25)', borderRadius:10, padding:'1px 6px' }}>🎯 bonus</span>}
              <div style={{ fontSize:10, color:C.mid, fontFamily:'DM Mono,monospace' }}>{s.wins} win{s.wins!==1?'s':''}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, color:C.amber, minWidth:30, textAlign:'right' }}>{s.score}</div>
              <div style={{ fontSize:9, color:C.mid, fontFamily:'DM Mono,monospace' }}>pts</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
