import { useState, useEffect, useCallback, useRef } from 'react';
import { TEAM, TASK_COLS, PRIORITY_COLORS, TASK_KEY, memberColor, getInitials, uid, fmtDate } from '../constants.js';
import { storageGet, storageSet } from '../storage.js';

const SC = { todo:'#4f9cf9', inprogress:'#d4820a', done:'#3ecf8e' };
const SL = { todo:'To Do', inprogress:'In Progress', done:'Done' };

function defaultTasks() {
  const now = Date.now();
  return [
    { id:uid(), title:'Plan first book club session',         desc:'Decide format, date and book for session 1',                     assignee:'Sera Lynn Elina',    status:'inprogress', priority:'high',   tag:'Planning',      due:'2026-03-20', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Create welcome onboarding document',   desc:'Write a guide explaining how the book club works',               assignee:'Henry Kisambira',    status:'todo',       priority:'high',   tag:'Communication', due:'2026-03-28', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Curate reading list with access links',desc:'Compile affordable book resources for members',                  assignee:'Alicia Pieuse Lugano',status:'todo',      priority:'medium', tag:'Research',      due:'2026-03-30', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Set up hybrid meeting platform',       desc:'Configure Zoom/Meet for virtual sessions',                       assignee:'Amos Bogere',        status:'inprogress', priority:'medium', tag:'Tech',          due:'2026-03-25', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Send intro message to all 41 members', desc:'Welcome email with club structure and first session details',    assignee:'Joyce Nabukenya',    status:'done',       priority:'high',   tag:'Communication', due:'2026-03-14', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Design session discussion guide',      desc:'Create a reusable template for book discussions',                assignee:'Peter Mwanja',       status:'todo',       priority:'medium', tag:'Design',        due:'2026-03-28', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Source physical books for onsite',     desc:'Find affordable book options or library partnerships',           assignee:'David Sekamanya',    status:'todo',       priority:'medium', tag:'Logistics',     due:'2026-04-01', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Build club WhatsApp group',            desc:'Set up group chat and share joining instructions',               assignee:'Timothy Kawanguzi',  status:'done',       priority:'high',   tag:'Communication', due:'2026-03-14', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Compile member goals summary',         desc:'Summarise key goals from the pre-launch survey',                assignee:'Edward Kasule',      status:'inprogress', priority:'low',    tag:'Research',      due:'2026-03-28', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Prepare buddy pairing list',           desc:'Pair advanced readers with beginners for mentorship',           assignee:'Moreen Nassolo',     status:'todo',       priority:'medium', tag:'Planning',      due:'2026-03-30', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Create social media announcement',     desc:'Draft announcement post for the club launch',                   assignee:'Meshack',            status:'todo',       priority:'low',    tag:'Marketing',     due:'2026-03-25', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Set up task tracking board',           desc:'Ensure all team members can access and update the board',       assignee:'Charles Sekidde',    status:'done',       priority:'high',   tag:'Tech',          due:'2026-03-14', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Coordinate external speaker sessions', desc:'Identify and invite guest speakers for club sessions',          assignee:'Nicholas Onapa',     status:'todo',       priority:'medium', tag:'Outreach',      due:'2026-04-05', createdBy:'Admin', createdAt:now },
    { id:uid(), title:'Design club branding & visual identity',desc:'Create logo, colour palette and design assets',                assignee:'Alexander Tumusiime',status:'inprogress', priority:'high',   tag:'Design',        due:'2026-03-28', createdBy:'Admin', createdAt:now },
  ];
}

export default function TaskTracker({ currentUser, isAdmin, showToast }) {
  const TEAM_LIST = TEAM;
  const [tasks, setTasks]       = useState([]);
  const [loaded, setLoaded]     = useState(false);
  const [curView, setCurView]   = useState('board');
  const [curPrio, setCurPrio]   = useState('');
  const [curMember, setCurMember] = useState('');
  const [editId, setEditId]     = useState(null);
  const [reassignId, setReassignId] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [form, setForm]         = useState({ title:'', desc:'', assignee:'', due:'', status:'todo', priority:'medium', tag:'' });
  const [rForm, setRForm]       = useState({ assignee:'', status:'todo' });
  const dragRef                 = useRef(null);

  // Load
  useEffect(() => {
    (async () => {
      const r = await storageGet(TASK_KEY);
      setTasks(r?.tasks?.length ? r.tasks : defaultTasks());
      setLoaded(true);
    })();
  }, []);

  // Live refresh
  useEffect(() => {
    const iv = setInterval(async () => {
      const r = await storageGet(TASK_KEY);
      if (r?.tasks) setTasks(r.tasks);
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  const save = useCallback((t) => {
    storageSet(TASK_KEY, { tasks: t, ts: Date.now() });
  }, []);

  const filtered = tasks.filter(t => {
    if (curView === 'mine' && t.assignee !== currentUser) return false;
    if (curPrio && t.priority !== curPrio) return false;
    if (curMember && t.assignee !== curMember) return false;
    return true;
  });

  const members = [...new Set(tasks.map(t => t.assignee).filter(Boolean))];
  const done  = tasks.filter(t => t.status === 'done').length;
  const pct   = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  function openAdd(defaultStatus) {
    setEditId(null);
    setForm({ title:'', desc:'', assignee: isAdmin ? '' : currentUser, due:'', status: defaultStatus||'todo', priority:'medium', tag:'' });
    setShowModal(true);
  }
  function openEdit(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    setEditId(id);
    setForm({ title:t.title, desc:t.desc||'', assignee:t.assignee||'', due:t.due||'', status:t.status, priority:t.priority, tag:t.tag||'' });
    setShowModal(true);
  }
  function saveTask() {
    if (!form.title.trim()) return;
    let next;
    if (editId) {
      next = tasks.map(t => t.id === editId ? { ...t, ...form } : t);
      showToast('Task updated ✓');
    } else {
      next = [...tasks, { id:uid(), ...form, createdBy:currentUser, createdAt:Date.now() }];
      showToast('Task added ✓');
    }
    setTasks(next); save(next); setShowModal(false); setEditId(null);
  }
  function delTask(id) {
    if (!window.confirm('Delete this task?')) return;
    const next = tasks.filter(t => t.id !== id);
    setTasks(next); save(next); showToast('Task deleted');
  }
  function openReassign(id) {
    const t = tasks.find(x => x.id === id); if (!t) return;
    setReassignId(id);
    setRForm({ assignee: t.assignee||'', status: t.status });
    setShowReassign(true);
  }
  function saveReassign() {
    const next = tasks.map(t => t.id === reassignId ? { ...t, ...rForm } : t);
    setTasks(next); save(next); setShowReassign(false); showToast('Task reassigned ✓');
  }
  function dropToCol(colId) {
    if (!dragRef.current) return;
    const t = tasks.find(x => x.id === dragRef.current);
    if (t && t.status !== colId) {
      const next = tasks.map(x => x.id === dragRef.current ? { ...x, status: colId } : x);
      setTasks(next); save(next);
    }
    dragRef.current = null;
  }
  function clearAll() {
    if (!window.confirm('⚠️ Delete ALL tasks for everyone? This cannot be undone.')) return;
    setTasks([]); save([]); showToast('All tasks cleared');
  }

  if (!loaded) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'var(--text3)', fontFamily:'DM Mono,monospace', fontSize:12 }}>Loading tasks…</div>;

  return (
    <div style={{ display:'flex', height:'calc(100vh - 106px)', animation:'fadeUp .35s ease' }}>

      {/* SIDEBAR */}
      <div style={{ width:206, background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'14px 0', flexShrink:0, overflowY:'auto' }}>
        <SbSection label="Views">
          <SbItem active={curView==='board'} onClick={() => setCurView('board')}>⊞ Board <SbCt>{tasks.length}</SbCt></SbItem>
          <SbItem active={curView==='mine'}  onClick={() => setCurView('mine')}>👤 My Tasks <SbCt>{tasks.filter(t=>t.assignee===currentUser).length}</SbCt></SbItem>
          {isAdmin && <SbItem active={curView==='admin'} admin onClick={() => setCurView('admin')}>⚡ Admin <SbCt style={{ background:'rgba(185,124,249,.15)', color:'var(--admin)' }}>ALL</SbCt></SbItem>}
        </SbSection>
        <SbSection label="Priority">
          <SbItem active={curPrio===''} onClick={() => setCurPrio('')}>◈ All</SbItem>
          <SbItem active={curPrio==='high'} onClick={() => setCurPrio('high')}><span style={{color:'var(--red)'}}>▲</span> High</SbItem>
          <SbItem active={curPrio==='medium'} onClick={() => setCurPrio('medium')}><span style={{color:'var(--amber)'}}>●</span> Medium</SbItem>
          <SbItem active={curPrio==='low'} onClick={() => setCurPrio('low')}><span style={{color:'var(--green)'}}>▼</span> Low</SbItem>
        </SbSection>
        <SbSection label="Team">
          {members.map(m => (
            <div key={m} onClick={() => setCurMember(m === curMember ? '' : m)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px', borderRadius:5, cursor:'pointer', fontSize:11, color: m===curMember?'var(--text)':'var(--text2)', background: m===curMember?'var(--surface2)':'none' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:memberColor(m), flexShrink:0 }} />
              <span>{m}</span>
              <span style={{ marginLeft:'auto', fontFamily:'DM Mono,monospace', fontSize:9, color:'var(--text3)' }}>{tasks.filter(t=>t.assignee===m).length}</span>
            </div>
          ))}
        </SbSection>
      </div>

      {/* BOARD or ADMIN */}
      {curView !== 'admin' ? (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {/* header */}
          <div style={{ padding:'12px 18px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, gap:8 }}>
            <div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700 }}>{curView==='mine'?'My Tasks':'Team Task Board'}</div>
              <div style={{ fontSize:10, color:'var(--text2)', marginTop:1, fontFamily:'DM Mono,monospace' }}>All tasks · live · shared</div>
            </div>
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => openAdd()} style={btnStyle}>+ Add Task</button>
              <button onClick={async()=>{const r=await storageGet(TASK_KEY);if(r?.tasks){setTasks(r.tasks);showToast('Refreshed ✓');}}} style={ghostBtn}>↻</button>
            </div>
          </div>
          {/* stats */}
          <div style={{ display:'flex', gap:7, padding:'8px 18px', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
            {[[tasks.length,'Total','var(--text)'],[tasks.filter(t=>t.status==='todo').length,'To Do','var(--blue)'],[tasks.filter(t=>t.status==='inprogress').length,'In Progress','var(--amber)'],[done,'Done','var(--green)']].map(([n,l,c])=>(
              <div key={l} style={{ display:'flex', alignItems:'center', gap:7, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 11px', whiteSpace:'nowrap' }}>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, lineHeight:1, color:c }}>{n}</div>
                <div style={{ fontSize:10, color:'var(--text2)' }}>{l}</div>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 11px', whiteSpace:'nowrap', marginLeft:'auto' }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:700, lineHeight:1, color:'var(--green)' }}>{pct}%</div>
              <div style={{ fontSize:10, color:'var(--text2)' }}>Complete</div>
              <div style={{ width:50 }}><div style={{ height:3, background:'var(--border)', borderRadius:2 }}><div style={{ height:'100%', background:'var(--green)', borderRadius:2, width:`${pct}%`, transition:'width .5s' }} /></div></div>
            </div>
          </div>
          {/* member filter */}
          <div style={{ display:'flex', gap:5, padding:'7px 18px', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto', alignItems:'center' }}>
            <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' }}>MEMBER:</span>
            <Chip active={curMember===''} onClick={() => setCurMember('')}>All</Chip>
            {members.map(m => <Chip key={m} active={curMember===m} onClick={() => setCurMember(m===curMember?'':m)}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:memberColor(m), display:'inline-block', flexShrink:0 }} />{m.split(' ')[0]}
            </Chip>)}
          </div>
          {/* kanban */}
          <div style={{ flex:1, display:'flex', overflowX:'auto', padding:12, gap:11, alignItems:'flex-start' }}>

            {/* ── TO DO column — grouped by month ── */}
            <TodoMonthColumn
              tasks={filtered.filter(t => t.status === 'todo')}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={delTask}
              onReassign={openReassign}
              onDragStart={id => dragRef.current = id}
              onDropToCol={dropToCol}
              onAdd={() => openAdd('todo')}
              onComplete={id => { const next = tasks.map(x => x.id===id ? {...x, status:'done'} : x); setTasks(next); save(next); showToast('✅ Task marked as done!'); }}
            />

            {/* ── IN PROGRESS & DONE columns ── */}
            {TASK_COLS.filter(c => c.id !== 'todo').map(col => {
              const ct = filtered.filter(t => t.status === col.id);
              return (
                <div key={col.id} style={{ width:264, flexShrink:0, display:'flex', flexDirection:'column' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'7px 7px 0 0', borderBottom:'none' }}>
                    <div style={{ width:8, height:8, borderRadius:3, background:col.color }} />
                    <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12, flex:1 }}>{col.name}</div>
                    <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text2)', background:'var(--surface2)', padding:'2px 6px', borderRadius:8 }}>{ct.length}</div>
                  </div>
                  <div onDragOver={e => e.preventDefault()} onDrop={() => dropToCol(col.id)}
                    style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'0 0 7px 7px', overflowY:'auto', minHeight:80, padding:7, display:'flex', flexDirection:'column', gap:7, maxHeight:'calc(100vh - 300px)' }}>
                    {ct.length === 0 && <div style={{ textAlign:'center', color:'var(--text3)', fontSize:11, padding:'14px 8px', fontFamily:'DM Mono,monospace' }}>No tasks</div>}
                    {ct.map(t => <TaskCard key={t.id} task={t} currentUser={currentUser} isAdmin={isAdmin} onEdit={openEdit} onDelete={delTask} onReassign={openReassign} onDragStart={id => dragRef.current=id} onComplete={id => { const next = tasks.map(x => x.id===id ? {...x, status:'done'} : x); setTasks(next); save(next); showToast('✅ Task marked as done!'); }} />)}
                    <button onClick={() => openAdd(col.id)} style={{ background:'transparent', border:'1px dashed var(--border2)', borderRadius:7, padding:8, color:'var(--text3)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'DM Sans,sans-serif' }}>+ Add task</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <AdminPanel tasks={tasks} onAdd={openAdd} onEdit={openEdit} onDelete={delTask} onReassign={openReassign} onComplete={id => { const next = tasks.map(x => x.id===id ? {...x, status:'done'} : x); setTasks(next); save(next); showToast('✅ Task marked as done!'); }} onClear={clearAll} onRefresh={async()=>{const r=await storageGet(TASK_KEY);if(r?.tasks){setTasks(r.tasks);showToast('Refreshed ✓');}}} />
      )}

      {/* TASK MODAL */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:16 }}>{editId?'Edit Task':'New Task'}</div>
          <FG label="Task Title *"><FI value={form.title} onChange={v => setForm(f=>({...f,title:v}))} placeholder="What needs to be done?" /></FG>
          <FG label="Description"><FT value={form.desc} onChange={v => setForm(f=>({...f,desc:v}))} placeholder="Add more details…" /></FG>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FG label="Assigned To">
              <FI value={form.assignee} onChange={v => setForm(f=>({...f,assignee:v}))} placeholder="Name" list="tSuggest" />
              <datalist id="tSuggest">{[...new Set([...members,...TEAM_LIST])].map(m=><option key={m} value={m}/>)}</datalist>
            </FG>
            <FG label="Due Date"><FI type="date" value={form.due} onChange={v => setForm(f=>({...f,due:v}))} /></FG>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <FG label="Status"><FS value={form.status} onChange={v => setForm(f=>({...f,status:v}))}>{TASK_COLS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</FS></FG>
            <FG label="Priority"><FS value={form.priority} onChange={v => setForm(f=>({...f,priority:v}))}><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></FS></FG>
          </div>
          <FG label="Tag / Category"><FI value={form.tag} onChange={v => setForm(f=>({...f,tag:v}))} placeholder="e.g. Design, Research" /></FG>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={() => setShowModal(false)} style={ghostBtn}>Cancel</button>
            <button onClick={saveTask} style={btnStyle}>{editId?'Update Task':'Save Task'}</button>
          </div>
        </Modal>
      )}

      {/* REASSIGN MODAL */}
      {showReassign && (
        <Modal onClose={() => setShowReassign(false)}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, marginBottom:6 }}>⇄ Reassign Task</div>
          <p style={{ fontSize:12, color:'var(--text2)', marginBottom:14 }}>{tasks.find(t=>t.id===reassignId)?.title}</p>
          <FG label="Reassign To">
            <FI value={rForm.assignee} onChange={v => setRForm(f=>({...f,assignee:v}))} placeholder="Team member name" list="rSuggest" />
            <datalist id="rSuggest">{[...new Set([...members,...TEAM_LIST])].map(m=><option key={m} value={m}/>)}</datalist>
          </FG>
          <FG label="Update Status"><FS value={rForm.status} onChange={v => setRForm(f=>({...f,status:v}))}>{TASK_COLS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</FS></FG>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={() => setShowReassign(false)} style={ghostBtn}>Cancel</button>
            <button onClick={saveReassign} style={{ ...btnStyle, background:'var(--admin)', color:'#fff' }}>Save Changes</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── TODO MONTH COLUMN ────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function TodoMonthColumn({ tasks, currentUser, isAdmin, onEdit, onDelete, onReassign, onDragStart, onDropToCol, onAdd, onComplete }) {
  // Group tasks by due month. Tasks with no due date go in "No Date"
  const groups = {};
  tasks.forEach(t => {
    const key = t.due ? new Date(t.due + 'T00:00:00').getMonth() : 'none';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  // Sort month keys chronologically, "none" at end
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    return Number(a) - Number(b);
  });

  const [collapsed, setCollapsed] = useState({});
  function toggleGroup(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Column header */}
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 11px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'7px 7px 0 0', borderBottom:'none' }}>
        <div style={{ width:8, height:8, borderRadius:3, background:'#4f9cf9' }} />
        <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:12, flex:1 }}>To Do</div>
        <div style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text2)', background:'var(--surface2)', padding:'2px 6px', borderRadius:8 }}>{tasks.length}</div>
      </div>

      {/* Scrollable body */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={() => onDropToCol('todo')}
        style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'0 0 7px 7px', overflowY:'auto', minHeight:80, padding:7, display:'flex', flexDirection:'column', gap:6, maxHeight:'calc(100vh - 300px)' }}
      >
        {tasks.length === 0 && (
          <div style={{ textAlign:'center', color:'var(--text3)', fontSize:11, padding:'14px 8px', fontFamily:'DM Mono,monospace' }}>No tasks to do</div>
        )}

        {sortedKeys.map(key => {
          const label = key === 'none' ? 'No Due Date' : MONTH_NAMES[Number(key)];
          const groupTasks = groups[key];
          const isCollapsed = collapsed[key];
          const overdueCount = groupTasks.filter(t => t.due && new Date(t.due + 'T00:00:00') < new Date()).length;

          return (
            <div key={key}>
              {/* Month group header */}
              <div
                onClick={() => toggleGroup(key)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 8px', cursor:'pointer', borderRadius:5, marginBottom:4, background:'var(--surface2)', border:'1px solid var(--border)' }}
              >
                <span style={{ fontSize:10 }}>{isCollapsed ? '▶' : '▼'}</span>
                <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, fontWeight:600, color: key === 'none' ? 'var(--text3)' : '#4f9cf9', flex:1, letterSpacing:'0.5px', textTransform:'uppercase' }}>{label}</span>
                <span style={{ fontFamily:'DM Mono,monospace', fontSize:10, color:'var(--text3)' }}>{groupTasks.length}</span>
                {overdueCount > 0 && (
                  <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, color:'var(--red)', background:'rgba(249,96,96,.1)', border:'1px solid rgba(249,96,96,.2)', borderRadius:10, padding:'1px 6px' }}>⚠ {overdueCount}</span>
                )}
              </div>

              {/* Tasks in group */}
              {!isCollapsed && (
                <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:4, marginBottom:4 }}>
                  {groupTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      currentUser={currentUser}
                      isAdmin={isAdmin}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onReassign={onReassign}
                      onDragStart={onDragStart}
                      onComplete={onComplete}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button onClick={onAdd} style={{ background:'transparent', border:'1px dashed var(--border2)', borderRadius:7, padding:8, color:'var(--text3)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'DM Sans,sans-serif', marginTop:2 }}>
          + Add task
        </button>
      </div>
    </div>
  );
}

// ── TASK CARD ────────────────────────────────────────────────
function TaskCard({ task: t, currentUser, isAdmin, onEdit, onDelete, onReassign, onDragStart, onComplete }) {
  const [hov, setHov]       = useState(false);
  const [checking, setCheck] = useState(false);
  const pc      = PRIORITY_COLORS[t.priority] || '#555';
  const isDone  = t.status === 'done';
  const overdue = t.due && new Date(t.due) < new Date() && !isDone;
  const canEdit = isAdmin || t.assignee === currentUser || t.createdBy === currentUser;

  function handleCheck(e) {
    e.stopPropagation();
    if (isDone) return; // already done — uncheck via drag or edit
    setCheck(true);
    setTimeout(() => { setCheck(false); onComplete(t.id); }, 350);
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(t.id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isDone ? 'rgba(62,207,142,.04)' : 'var(--surface2)',
        border: `1px solid ${isDone ? 'rgba(62,207,142,.25)' : hov ? 'var(--border)' : 'var(--border2)'}`,
        borderRadius: 7, padding: 10, cursor: 'grab', position: 'relative',
        animation: 'cardIn .2s ease',
        boxShadow: hov ? '0 4px 18px rgba(0,0,0,.5)' : 'none',
        opacity: isDone ? 0.75 : 1,
        transition: 'opacity .3s, border-color .2s',
      }}
    >
      {/* priority stripe */}
      <div style={{ width:3, position:'absolute', left:0, top:7, bottom:7, borderRadius:'0 2px 2px 0', background: isDone ? 'var(--green)' : pc }} />

      {/* action buttons — show on hover */}
      {canEdit && hov && (
        <div style={{ position:'absolute', top:7, right:7, display:'flex', gap:3 }}>
          <TBtn onClick={() => onEdit(t.id)} title="Edit">✎</TBtn>
          {isAdmin && <TBtn onClick={() => onReassign(t.id)} title="Reassign" style={{ color:'var(--admin)' }}>⇄</TBtn>}
          <TBtn onClick={() => onDelete(t.id)} title="Delete" danger>✕</TBtn>
        </div>
      )}

      {/* title row with checkbox */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom: t.desc ? 4 : 6, paddingRight: canEdit && hov ? 52 : 4 }}>
        {/* CHECKBOX */}
        <div
          onClick={handleCheck}
          title={isDone ? 'Done' : 'Mark as complete'}
          style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
            border: `2px solid ${isDone ? 'var(--green)' : checking ? 'var(--green)' : 'var(--border2)'}`,
            background: isDone || checking ? 'var(--green)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isDone ? 'default' : 'pointer',
            transition: 'all .2s',
          }}
        >
          {(isDone || checking) && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="#0f0d08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        {/* title */}
        <div style={{
          fontWeight: 600, fontSize: 12, lineHeight: 1.4, flex: 1,
          textDecoration: isDone ? 'line-through' : 'none',
          color: isDone ? 'var(--text2)' : 'var(--text)',
        }}>{t.title}</div>
      </div>

      {t.desc && <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.5, marginBottom:6, paddingLeft:24 }}>{t.desc}</div>}

      {/* tag */}
      {t.tag && (
        <div style={{ paddingLeft:24, marginBottom:6 }}>
          <span style={{ fontSize:9, padding:'2px 6px', borderRadius:8, fontFamily:'DM Mono,monospace', background:`${pc}20`, color:pc }}>{t.tag}</span>
        </div>
      )}

      {/* footer: assignee + due date */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingLeft:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text2)' }}>
          {t.assignee ? (
            <>
              <div style={{ width:16, height:16, borderRadius:'50%', background:memberColor(t.assignee), color:'var(--ink)', fontSize:8, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', flexShrink:0 }}>{getInitials(t.assignee)}</div>
              <span>{t.assignee.split(' ')[0]}</span>
            </>
          ) : <span style={{ color:'var(--text3)' }}>Unassigned</span>}
        </div>

        {/* DUE DATE — always visible */}
        {t.due ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontFamily: 'DM Mono,monospace',
            color: isDone ? 'var(--green)' : overdue ? 'var(--red)' : 'var(--text3)',
            background: isDone ? 'rgba(62,207,142,.08)' : overdue ? 'rgba(249,96,96,.08)' : 'var(--surface)',
            border: `1px solid ${isDone ? 'rgba(62,207,142,.2)' : overdue ? 'rgba(249,96,96,.2)' : 'var(--border)'}`,
            borderRadius: 4, padding: '2px 6px',
          }}>
            {isDone ? '✓ ' : overdue ? '⚠ ' : '📅 '}
            {fmtDate(t.due)}
          </div>
        ) : (
          <div style={{ fontSize:10, fontFamily:'DM Mono,monospace', color:'var(--text3)', opacity:.5 }}>No due date</div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN PANEL ──────────────────────────────────────────────
function AdminPanel({ tasks, onAdd, onEdit, onDelete, onReassign, onComplete, onClear, onRefresh }) {
  const members = [...new Set(tasks.map(t => t.assignee).filter(Boolean))];
  const done = tasks.filter(t => t.status === 'done').length;
  const pct  = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const overdue = tasks.filter(t => t.due && new Date(t.due)<new Date() && t.status!=='done').length;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:18, display:'flex', flexDirection:'column', gap:18 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:800 }}>Admin <span style={{ color:'var(--admin)' }}>Dashboard</span></div>
          <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'DM Mono,monospace', marginTop:2 }}>Full team task overview · live</div>
        </div>
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          <button onClick={onRefresh} style={ghostBtn}>↻ Refresh</button>
          <button onClick={() => onAdd()} style={{ ...btnStyle, background:'var(--admin)', color:'#fff' }}>+ Task</button>
          <button onClick={onClear} style={{ ...btnStyle, background:'var(--red)', color:'#fff' }}>🗑 Clear All</button>
        </div>
      </div>

      {/* stats grid */}
      <div>
        <SectionTitle>📊 Analytics</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10 }}>
          {[[tasks.length,'Total Tasks','var(--text)'],[done,'Completed','var(--green)'],[tasks.filter(t=>t.status==='inprogress').length,'In Progress','var(--amber)'],[overdue,'Overdue','var(--red)'],[members.length,'Members','var(--blue)'],[pct+'%','Completion','var(--green)']].map(([n,l,c])=>(
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:13 }}>
              <div style={{ fontSize:9, fontFamily:'DM Mono,monospace', color:'var(--text2)', letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>{l}</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, lineHeight:1, color:c }}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* per member */}
      <div>
        <SectionTitle>👥 Per-Member Breakdown</SectionTitle>
        {members.map(m => {
          const mt = tasks.filter(t => t.assignee === m);
          const md = mt.filter(t => t.status === 'done').length;
          const pr = mt.length ? Math.round(md/mt.length*100) : 0;
          return (
            <div key={m} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 14px' }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:memberColor(m), color:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:12, flexShrink:0 }}>{getInitials(m)}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13, fontFamily:'Syne,sans-serif' }}>{m}</div>
                  <div style={{ fontSize:10, color:'var(--text2)', fontFamily:'DM Mono,monospace', marginTop:2 }}>{mt.length} tasks · {md} done · {mt.filter(t=>t.status==='inprogress').length} active</div>
                </div>
                <div style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color: pr>60?'var(--green)':pr>30?'var(--amber)':'var(--red)' }}>{pr}%</div>
                <button onClick={() => onAdd()} style={{ ...btnStyle, fontSize:10, padding:'4px 9px', background:'var(--admin)', color:'#fff' }}>+ Assign</button>
              </div>
              <div style={{ borderTop:'1px solid var(--border)', padding:'10px 14px' }}>
                {mt.map(t => {
                  const sc = TASK_COLS.find(c => c.id === t.status);
                  const pc = PRIORITY_COLORS[t.priority] || '#555';
                  const isDone = t.status === 'done';
                  const overdue = t.due && new Date(t.due) < new Date() && !isDone;
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', background:'var(--surface2)', borderRadius:5, fontSize:11, marginBottom:4, opacity: isDone ? 0.7 : 1 }}>
                      {/* checkbox */}
                      <div onClick={() => !isDone && onComplete(t.id)} title={isDone?'Done':'Mark complete'}
                        style={{ width:14, height:14, borderRadius:3, flexShrink:0, border:`2px solid ${isDone?'var(--green)':'var(--border2)'}`, background:isDone?'var(--green)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:isDone?'default':'pointer', transition:'all .2s' }}>
                        {isDone && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#0f0d08" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex:1, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:isDone?'line-through':'none', color:isDone?'var(--text2)':'var(--text)' }}>{t.title}</div>
                      {t.due && <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, padding:'2px 5px', borderRadius:3, background:isDone?'rgba(62,207,142,.08)':overdue?'rgba(249,96,96,.08)':'var(--surface)', color:isDone?'var(--green)':overdue?'var(--red)':'var(--text3)', border:`1px solid ${isDone?'rgba(62,207,142,.2)':overdue?'rgba(249,96,96,.2)':'var(--border)'}`, whiteSpace:'nowrap' }}>{isDone?'✓ ':overdue?'⚠ ':'📅 '}{fmtDate(t.due)}</span>}
                      <span style={{ fontFamily:'DM Mono,monospace', fontSize:9, padding:'2px 6px', borderRadius:8, background:`${sc.color}20`, color:sc.color }}>{sc.name}</span>
                      <TBtn onClick={() => onReassign(t.id)} style={{ color:'var(--admin)' }}>⇄</TBtn>
                      <TBtn onClick={() => onEdit(t.id)}>✎</TBtn>
                      <TBtn onClick={() => onDelete(t.id)} danger>✕</TBtn>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SMALL SHARED COMPONENTS ──────────────────────────────────
function SbSection({ label, children }) {
  return (
    <div style={{ padding:'0 10px', marginBottom:18 }}>
      <div style={{ fontFamily:'DM Mono,monospace', fontSize:9, letterSpacing:'2.5px', textTransform:'uppercase', color:'var(--text3)', padding:'0 8px', marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}
function SbItem({ children, active, admin, onClick }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:500, color: active?(admin?'var(--admin)':'var(--amber)'):'var(--text2)', background: active?(admin?'rgba(185,124,249,.1)':'rgba(212,130,10,.1)'):'none', transition:'all .15s' }}>
      {children}
    </div>
  );
}
function SbCt({ children, style }) {
  return <span style={{ marginLeft:'auto', background:'var(--surface2)', borderRadius:10, padding:'1px 6px', fontSize:9, fontFamily:'DM Mono,monospace', color:'var(--text2)', ...style }}>{children}</span>;
}
function Chip({ children, active, onClick }) {
  return (
    <div onClick={onClick} style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${active?'var(--amber)':'var(--border2)'}`, background: active?'var(--amber)':'transparent', color: active?'var(--ink)':'var(--text2)', whiteSpace:'nowrap', fontFamily:'DM Sans,sans-serif', display:'inline-flex', alignItems:'center', gap:4 }}>
      {children}
    </div>
  );
}
function TBtn({ children, onClick, danger, style }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:20, height:20, borderRadius:4, background: h&&danger?'rgba(249,96,96,.12)':h?'var(--border2)':'var(--surface)', border:`1px solid ${h&&danger?'var(--red)':'var(--border2)'}`, color: h&&danger?'var(--red)':h?'var(--text)':'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:700, marginBottom:9, display:'flex', alignItems:'center', gap:8, color:'var(--text)' }}>
      {children}
      <div style={{ flex:1, height:1, background:'var(--border)' }} />
    </div>
  );
}
function Modal({ children, onClose }) {
  return (
    <div onClick={e => e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:350, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:12, padding:22, width:'100%', maxWidth:450, animation:'fadeUp .2s ease' }}>
        {children}
      </div>
    </div>
  );
}
function FG({ label, children }) {
  return <div style={{ marginBottom:12 }}><label style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:1, color:'var(--text2)', fontFamily:'DM Mono,monospace', marginBottom:5, display:'block' }}>{label}</label>{children}</div>;
}
function FI({ value, onChange, placeholder, type, list }) {
  return <input type={type||'text'} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} list={list} style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none' }} />;
}
function FT({ value, onChange, placeholder }) {
  return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none', minHeight:65, resize:'vertical' }} />;
}
function FS({ value, onChange, children }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'8px 11px', color:'var(--text)', fontFamily:'DM Sans,sans-serif', fontSize:13, outline:'none' }}>{children}</select>;
}

const btnStyle   = { background:'var(--amber)', color:'var(--ink)', border:'none', borderRadius:6, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', display:'inline-flex', alignItems:'center', gap:5, whiteSpace:'nowrap' };
const ghostBtn   = { background:'transparent', color:'var(--text)', border:'1px solid var(--border2)', borderRadius:6, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', display:'inline-flex', alignItems:'center', gap:5 };
