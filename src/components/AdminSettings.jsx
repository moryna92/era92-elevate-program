import { useState, useEffect } from 'react';
import { PALETTE, uid, TEAM, INITIALS_MAP, PILLARS, TASK_BONUS_PTS, ADMIN_PW, SETTINGS_KEY } from '../constants.js';
import { storageGet, storageSet } from '../storage.js';

function buildDefaults() {
  return {
    team: TEAM.map((name, i) => ({
      id: 'm' + i, name,
      initials: (INITIALS_MAP[name] || name.split(' ').map(w=>w[0]).slice(0,2).join('')).toUpperCase(),
      role: '', active: true,
    })),
    pillars: PILLARS.map((p, i) => ({ ...p, id: 'p' + i })),
    taskBonusPts: TASK_BONUS_PTS,
    adminPassword: ADMIN_PW,
    orgName: 'ERA92 Elevate',
    weeklyBonusEnabled: true,
    votingSchedule: { openDay:1, openHour:7, closeDay:5, closeHour:18, announceHour:7, announceMin:30 },
  };
}

function Section({ title, sub, children }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:16 }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, color:'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:'var(--text2)', marginTop:3, fontFamily:'DM Mono,monospace' }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function FRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, flexWrap:'wrap' }}>
      {label && <label style={{ fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--text2)', minWidth:120, flexShrink:0 }}>{label}</label>}
      <div style={{ flex:1, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>{children}</div>
    </div>
  );
}

function SInput({ value, onChange, placeholder, type = 'text', style = {} }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'7px 11px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none', flex:1, minWidth:0, ...style }} />
  );
}

function SSelect({ value, onChange, children, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'7px 11px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none', ...style }}>
      {children}
    </select>
  );
}

function SBtn({ children, onClick, color = 'var(--primary)', textColor = '#fff', ghost = false, small = false, danger = false }) {
  const bg = danger ? 'rgba(249,64,64,.1)' : ghost ? 'transparent' : color;
  const border = danger ? '1px solid rgba(249,64,64,.4)' : ghost ? '1px solid var(--border2)' : 'none';
  const tc = danger ? 'var(--red)' : ghost ? 'var(--text2)' : textColor;
  return (
    <button onClick={onClick}
      style={{ background:bg, color:tc, border, borderRadius:6, padding: small?'5px 10px':'7px 14px', fontSize:small?11:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
      {children}
    </button>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => onChange(!value)}>
      <div style={{ width:36, height:20, borderRadius:10, background:value?'var(--primary)':'var(--border2)', position:'relative', transition:'background .2s', flexShrink:0 }}>
        <div style={{ width:14, height:14, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left:value?19:3, transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.3)' }} />
      </div>
      {label && <span style={{ fontSize:13, color:'var(--text)' }}>{label}</span>}
    </div>
  );
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function AdminSettings({ showToast }) {
  const [local, setLocal]         = useState(buildDefaults);
  const [loaded, setLoaded]       = useState(false);
  const [tab, setTab]             = useState('team');
  const [saved, setSaved]         = useState(false);
  const [newMember, setNewMember] = useState({ name:'', initials:'', role:'' });
  const [newPillar, setNewPillar] = useState({ icon:'⭐', label:'', desc:'' });
  const [pwVisible, setPwVisible] = useState(false);
  const [confirmReset, setConfirmReset] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await storageGet(SETTINGS_KEY);
        if (r && r.team) setLocal(prev => ({ ...prev, ...r }));
      } catch(e) {}
      setLoaded(true);
    })();
  }, []);

  function update(path, value) {
    const next = JSON.parse(JSON.stringify(local));
    const keys = path.split('.');
    let obj = next;
    for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
    obj[keys[keys.length - 1]] = value;
    setLocal(next);
  }

  async function saveAll() {
    try { await storageSet(SETTINGS_KEY, local); } catch(e) {}
    setSaved(true);
    showToast('✓ Settings saved successfully');
    setTimeout(() => setSaved(false), 3000);
  }

  if (!loaded) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--text2)', fontFamily:'DM Mono,monospace', fontSize:12 }}>Loading settings…</div>;

  // Team
  function addMember() {
    const n = newMember.name.trim();
    if (!n) return;
    const ini = (newMember.initials.trim() || n.split(' ').map(w=>w[0]).slice(0,2).join('')).toUpperCase().slice(0,2);
    setLocal(p => ({ ...p, team: [...p.team, { id:uid(), name:n, initials:ini, role:newMember.role.trim(), active:true }] }));
    setNewMember({ name:'', initials:'', role:'' });
    showToast(`${n.split(' ')[0]} added to team ✓`);
  }
  function removeMember(id) {
    if (!window.confirm('Deactivate this member? Their tasks and SS data are kept — they just won\'t appear in new selections.')) return;
    setLocal(p => ({ ...p, team: p.team.map(m => m.id===id ? {...m,active:false} : m) }));
  }
  function restoreMember(id) {
    setLocal(p => ({ ...p, team: p.team.map(m => m.id===id ? {...m,active:true} : m) }));
    showToast('Member restored ✓');
  }
  function deleteMember(id) {
    if (!window.confirm('Permanently delete this member? This cannot be undone.')) return;
    setLocal(p => ({ ...p, team: p.team.filter(m => m.id !== id) }));
  }
  function updateMember(id, field, val) {
    setLocal(p => ({ ...p, team: p.team.map(m => m.id===id ? {...m,[field]:val} : m) }));
  }

  // Pillars
  function addPillar() {
    if (!newPillar.label.trim()) return;
    setLocal(p => ({ ...p, pillars: [...p.pillars, { ...newPillar, id:uid() }] }));
    setNewPillar({ icon:'⭐', label:'', desc:'' });
    showToast('Pillar added ✓');
  }
  function removePillar(id) {
    if (!window.confirm('Remove this pillar?')) return;
    setLocal(p => ({ ...p, pillars: p.pillars.filter(x => x.id!==id) }));
  }
  function updatePillar(id, field, val) {
    setLocal(p => ({ ...p, pillars: p.pillars.map(x => x.id===id ? {...x,[field]:val} : x) }));
  }

  const activeM   = local.team.filter(m => m.active);
  const inactiveM = local.team.filter(m => !m.active);

  const TABS = [
    { id:'team',    label:'👥 Team' },
    { id:'pillars', label:'🎯 Pillars' },
    { id:'scoring', label:'⚡ Scoring' },
    { id:'general', label:'⚙️ General' },
  ];

  return (
    <div style={{ background:'var(--bg)', minHeight:'calc(100vh - 56px)', animation:'fadeUp .3s ease' }}>

      {/* Hero */}
      <div style={{ background:'linear-gradient(135deg,#1a0814,#0d0a0e)', borderBottom:'1px solid rgba(232,24,90,.2)', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <img src="/logo.webp" alt="ERA92 Elevate" style={{ height:32, objectFit:'contain' }} />
          <div style={{ width:1, height:26, background:'rgba(232,24,90,.3)' }} />
          <div>
            <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:3, textTransform:'uppercase', color:'var(--primary)', marginBottom:3 }}>Admin Settings</div>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:800, color:'var(--text)' }}>
              Dashboard <span style={{ background:'linear-gradient(135deg,#e8185a,#e8402a)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Configuration</span>
            </div>
          </div>
        </div>
        <SBtn onClick={saveAll} color={saved?'var(--green)':'var(--primary)'}>
          {saved ? '✓ Saved!' : '💾 Save All Changes'}
        </SBtn>
      </div>

      {/* Sub tabs */}
      <div style={{ display:'flex', background:'var(--surface)', borderBottom:'1px solid rgba(232,24,90,.15)', padding:'0 28px', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--primary)':'transparent'}`,
            color: tab===t.id?'var(--primaryL)':'var(--text2)',
            fontFamily:'DM Mono,monospace', fontSize:10, letterSpacing:'1.5px', textTransform:'uppercase',
            padding:'10px 16px', cursor:'pointer', whiteSpace:'nowrap', transition:'all .2s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth:920, margin:'0 auto', padding:'24px 20px 80px' }}>

        {/* ── TEAM ── */}
        {tab === 'team' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <Section title="➕ Add New Team Member" sub="New members appear in task assignments and Super Striker voting immediately after saving">
              <div style={{ display:'grid', gridTemplateColumns:'2fr 80px 1fr auto', gap:10, alignItems:'end' }}>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>FULL NAME *</div>
                  <SInput value={newMember.name}
                    onChange={v => setNewMember(p => ({ ...p, name:v, initials:v.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() }))}
                    placeholder="e.g. Jane Nakato"
                    onKeyDown={e => e.key==='Enter' && addMember()} />
                </div>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>INITIALS</div>
                  <SInput value={newMember.initials} onChange={v => setNewMember(p=>({...p,initials:v.toUpperCase().slice(0,2)}))} placeholder="JN" style={{ textAlign:'center', letterSpacing:3 }} />
                </div>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>ROLE (optional)</div>
                  <SInput value={newMember.role} onChange={v => setNewMember(p=>({...p,role:v}))} placeholder="e.g. Designer" />
                </div>
                <SBtn onClick={addMember}>+ Add Member</SBtn>
              </div>
            </Section>

            <Section title={`👥 Active Members (${activeM.length})`} sub="Edit names, initials or roles inline — click Save when done">
              {activeM.length === 0 && <div style={{ textAlign:'center', padding:24, color:'var(--text3)', fontSize:12, fontFamily:'DM Mono,monospace' }}>No active members. Add one above.</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {activeM.map((m, i) => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:PALETTE[i%PALETTE.length], color:'var(--ink)', fontSize:11, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>
                      {m.initials}
                    </div>
                    <div style={{ flex:2, minWidth:0 }}>
                      <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', marginBottom:3, letterSpacing:1 }}>FULL NAME</div>
                      <SInput value={m.name} onChange={v => updateMember(m.id,'name',v)} placeholder="Full name" />
                    </div>
                    <div style={{ width:80, flexShrink:0 }}>
                      <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', marginBottom:3, letterSpacing:1 }}>INITIALS</div>
                      <SInput value={m.initials} onChange={v => updateMember(m.id,'initials',v.toUpperCase().slice(0,2))} placeholder="AB" style={{ textAlign:'center', letterSpacing:3 }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', marginBottom:3, letterSpacing:1 }}>ROLE</div>
                      <SInput value={m.role||''} onChange={v => updateMember(m.id,'role',v)} placeholder="Role (optional)" />
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <SBtn onClick={() => removeMember(m.id)} danger small>Deactivate</SBtn>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {inactiveM.length > 0 && (
              <Section title={`🗄 Inactive Members (${inactiveM.length})`} sub="Deactivated members — restore to bring them back, or delete permanently">
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {inactiveM.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'rgba(255,255,255,.02)', border:'1px solid var(--border)', borderRadius:8 }}>
                      <div style={{ flex:1, fontSize:13, color:'var(--text2)' }}>
                        {m.name}
                        {m.role && <span style={{ fontSize:11, color:'var(--text3)', marginLeft:8 }}>· {m.role}</span>}
                        <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'DM Mono,monospace', marginLeft:8 }}>INACTIVE</span>
                      </div>
                      <SBtn onClick={() => restoreMember(m.id)} ghost small>↩ Restore</SBtn>
                      <SBtn onClick={() => deleteMember(m.id)} danger small>🗑 Delete</SBtn>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── PILLARS ── */}
        {tab === 'pillars' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <Section title="✏️ Add New Pillar" sub="Pillars show in the Super Striker nomination form — team members select which apply">
              <div style={{ display:'grid', gridTemplateColumns:'60px 1fr 2fr auto', gap:10, alignItems:'end' }}>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>ICON</div>
                  <SInput value={newPillar.icon} onChange={v => setNewPillar(p=>({...p,icon:v}))} placeholder="🎯" style={{ textAlign:'center', fontSize:18, padding:'6px 4px' }} />
                </div>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>PILLAR NAME *</div>
                  <SInput value={newPillar.label} onChange={v => setNewPillar(p=>({...p,label:v}))} placeholder="e.g. Leadership" />
                </div>
                <div>
                  <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text2)', marginBottom:5, letterSpacing:1 }}>DESCRIPTION</div>
                  <SInput value={newPillar.desc} onChange={v => setNewPillar(p=>({...p,desc:v}))} placeholder="What this pillar means to the team…" />
                </div>
                <SBtn onClick={addPillar}>+ Add</SBtn>
              </div>
            </Section>

            <Section title={`🎯 Current Pillars (${local.pillars.length})`} sub="Edit names, icons and descriptions — click Save when done">
              {local.pillars.length === 0 && <div style={{ textAlign:'center', padding:24, color:'var(--text3)', fontSize:12, fontFamily:'DM Mono,monospace' }}>No pillars defined. Add one above.</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {local.pillars.map((p, i) => (
                  <div key={p.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ fontSize:22, width:42, textAlign:'center', flexShrink:0, paddingTop:6 }}>{p.icon}</div>
                    <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:8 }}>
                        <SInput value={p.icon} onChange={v => updatePillar(p.id,'icon',v)} placeholder="🎯" style={{ textAlign:'center', fontSize:16 }} />
                        <SInput value={p.label} onChange={v => updatePillar(p.id,'label',v)} placeholder="Pillar name" style={{ fontWeight:600 }} />
                      </div>
                      <SInput value={p.desc} onChange={v => updatePillar(p.id,'desc',v)} placeholder="Description shown to voters…" style={{ fontSize:12 }} />
                    </div>
                    <SBtn onClick={() => removePillar(p.id)} danger small>✕</SBtn>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── SCORING ── */}
        {tab === 'scoring' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <Section title="⚡ Super Striker Points" sub="How points are calculated each week">
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  ['+3', 'Win the week', 'Fixed — automatically awarded to the SS winner'],
                  ['+1', 'Per nomination received', 'Fixed — for every vote received from a teammate'],
                ].map(([pts, label, desc]) => (
                  <div key={pts} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, color:'var(--primary)', minWidth:48, textAlign:'center' }}>{pts}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{label}</div>
                      <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>{desc}</div>
                    </div>
                    <div style={{ marginLeft:'auto', fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', background:'var(--border)', padding:'3px 8px', borderRadius:10 }}>FIXED</div>
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', background:'rgba(62,207,142,.04)', border:'1px solid rgba(62,207,142,.2)', borderRadius:8 }}>
                  <div style={{ fontFamily:'Syne,sans-serif', fontSize:28, fontWeight:800, color:'var(--green)', minWidth:48, textAlign:'center' }}>+{local.taskBonusPts}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>Task completion bonus</div>
                    <div style={{ fontSize:11, color:'var(--text2)', marginTop:2 }}>Awarded when all tasks due that week are marked done</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <SInput type="number" value={local.taskBonusPts}
                      onChange={v => update('taskBonusPts', Math.max(1, Math.min(10, parseInt(v)||2)))}
                      style={{ width:70, textAlign:'center', fontFamily:'Syne,sans-serif', fontSize:18, fontWeight:700 }} />
                    <span style={{ fontSize:11, color:'var(--text2)' }}>pts</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="🎯 Task Bonus" sub="Controls whether the weekly task completion bonus runs automatically">
              <FRow label="Enable task bonus">
                <Toggle value={local.weeklyBonusEnabled} onChange={v => update('weeklyBonusEnabled', v)}
                  label={local.weeklyBonusEnabled ? '✅ Active — auto-checks every Monday 7:30 AM' : '❌ Disabled — no bonus awarded'} />
              </FRow>
            </Section>

            <Section title="🗓 Voting Schedule" sub="Times are in local time (Uganda EAT UTC+3)">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:16 }}>
                <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
                  <div style={{ fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--green)', marginBottom:10, letterSpacing:1 }}>🟢 VOTING OPENS</div>
                  <FRow label="Day">
                    <SSelect value={local.votingSchedule.openDay} onChange={v => update('votingSchedule.openDay', parseInt(v))}>
                      {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                    </SSelect>
                  </FRow>
                  <FRow label="Hour">
                    <SInput type="number" value={local.votingSchedule.openHour} onChange={v => update('votingSchedule.openHour', Math.max(0,Math.min(23,parseInt(v)||7)))} style={{ width:80 }} />
                    <span style={{ fontSize:12, color:'var(--text2)' }}>:00</span>
                  </FRow>
                </div>
                <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
                  <div style={{ fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--red)', marginBottom:10, letterSpacing:1 }}>🔴 VOTING CLOSES</div>
                  <FRow label="Day">
                    <SSelect value={local.votingSchedule.closeDay} onChange={v => update('votingSchedule.closeDay', parseInt(v))}>
                      {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                    </SSelect>
                  </FRow>
                  <FRow label="Hour">
                    <SInput type="number" value={local.votingSchedule.closeHour} onChange={v => update('votingSchedule.closeHour', Math.max(0,Math.min(23,parseInt(v)||18)))} style={{ width:80 }} />
                    <span style={{ fontSize:12, color:'var(--text2)' }}>:00</span>
                  </FRow>
                </div>
              </div>
              <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:14 }}>
                <div style={{ fontSize:11, fontFamily:'DM Mono,monospace', color:'var(--amber)', marginBottom:10, letterSpacing:1 }}>🤖 ANNOUNCE (every Monday)</div>
                <FRow label="Time">
                  <SInput type="number" value={local.votingSchedule.announceHour} onChange={v => update('votingSchedule.announceHour', Math.max(0,Math.min(23,parseInt(v)||7)))} style={{ width:72 }} />
                  <span style={{ fontSize:13, color:'var(--text2)' }}>h</span>
                  <SInput type="number" value={local.votingSchedule.announceMin} onChange={v => update('votingSchedule.announceMin', Math.max(0,Math.min(59,parseInt(v)||30)))} style={{ width:72 }} />
                  <span style={{ fontSize:13, color:'var(--text2)' }}>min</span>
                </FRow>
              </div>
              <div style={{ marginTop:10, background:'rgba(232,24,90,.05)', border:'1px solid rgba(232,24,90,.15)', borderRadius:6, padding:'9px 14px', fontSize:11, color:'var(--text2)' }}>
                ⚠️ Schedule changes take effect from next week. Votes in progress are not affected.
              </div>
            </Section>
          </div>
        )}

        {/* ── GENERAL ── */}
        {tab === 'general' && (
          <div style={{ animation:'fadeUp .3s ease' }}>
            <Section title="🏢 Organisation" sub="Displayed across the dashboard">
              <FRow label="Org name">
                <SInput value={local.orgName} onChange={v => update('orgName', v)} placeholder="ERA92 Elevate" style={{ maxWidth:300 }} />
              </FRow>
            </Section>

            <Section title="🔐 Admin Password" sub="Password required to access admin controls">
              <FRow label="Current password">
                <SInput type={pwVisible?'text':'password'} value={local.adminPassword} onChange={v => update('adminPassword', v)} placeholder="Enter new password" style={{ maxWidth:260 }} />
                <SBtn onClick={() => setPwVisible(v => !v)} ghost small>{pwVisible ? '🙈 Hide' : '👁 Show'}</SBtn>
              </FRow>
              <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'DM Mono,monospace', marginTop:2 }}>
                ⚠️ Save changes first. New password takes effect on next login — write it down.
              </div>
            </Section>

            <Section title="🗑 Danger Zone" sub="These actions cannot be undone">
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {/* SS Reset */}
                <div style={{ padding:'14px 16px', background:'rgba(249,64,64,.03)', border:'1px solid rgba(249,64,64,.15)', borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>Reset All Super Striker Scores</div>
                      <div style={{ fontSize:11, color:'var(--text2)', marginTop:3 }}>Clears all SS points, wins, vote history and task bonus records permanently.</div>
                    </div>
                    <SBtn danger onClick={() => {
                      if (confirmReset !== 'RESET') { alert("Type RESET in the box below first."); return; }
                      if (window.confirm('Permanently delete ALL Super Striker scores and history?')) {
                        window.dispatchEvent(new CustomEvent('era92:resetSS'));
                        showToast('Super Striker scores cleared');
                        setConfirmReset('');
                      }
                    }}>🗑 Reset SS Scores</SBtn>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:12, color:'var(--text2)' }}>Type <strong style={{ color:'var(--red)', fontFamily:'DM Mono,monospace' }}>RESET</strong> to enable:</span>
                    <SInput value={confirmReset} onChange={setConfirmReset} placeholder="RESET"
                      style={{ maxWidth:120, borderColor: confirmReset==='RESET'?'var(--red)':'var(--border2)' }} />
                    {confirmReset === 'RESET' && <span style={{ fontSize:11, color:'var(--red)', fontFamily:'DM Mono,monospace' }}>✓ Ready to reset</span>}
                  </div>
                </div>

                {/* Settings Reset */}
                <div style={{ padding:'14px 16px', background:'rgba(249,64,64,.03)', border:'1px solid rgba(249,64,64,.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>Reset Settings to Defaults</div>
                    <div style={{ fontSize:11, color:'var(--text2)', marginTop:3 }}>Reverts all settings to original. Tasks and SS scores are not affected.</div>
                  </div>
                  <SBtn danger onClick={() => {
                    if (window.confirm('Reset all settings to defaults? This will revert team list, pillars and scoring.')) {
                      window.dispatchEvent(new CustomEvent('era92:resetSettings'));
                      showToast('Settings reset to defaults');
                    }
                  }}>↩ Reset to Defaults</SBtn>
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* Sticky save */}
        <div style={{ position:'sticky', bottom:20, display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <SBtn onClick={saveAll} color={saved?'var(--green)':'var(--primary)'} style={{ boxShadow:'0 4px 24px rgba(232,24,90,.25)', padding:'10px 26px', fontSize:14 }}>
            {saved ? '✓ All Changes Saved!' : '💾 Save All Changes'}
          </SBtn>
        </div>
      </div>
    </div>
  );
}
