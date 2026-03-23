export const ADMIN_PW = 'Moryna92';

export const TEAM = [
  'Sera Lynn Elina','Henry Kisambira','Alicia Pieuse Lugano','Amos Bogere',
  'Joyce Nabukenya','Peter Mwanja','David Sekamanya','Timothy Kawanguzi',
  'Edward Kasule','Moreen Nassolo','Meshack','Charles Sekidde',
  'Nicholas Onapa','Alexander Tumusiime','Kelly Kizito'
];

export const INITIALS_MAP = {
  'Sera Lynn Elina':'SL','Henry Kisambira':'HK','Alicia Pieuse Lugano':'AP',
  'Amos Bogere':'AB','Joyce Nabukenya':'JN','Peter Mwanja':'PM',
  'David Sekamanya':'DS','Timothy Kawanguzi':'TK','Edward Kasule':'EK',
  'Moreen Nassolo':'MN','Meshack':'ME','Charles Sekidde':'CS',
  'Nicholas Onapa':'NO','Alexander Tumusiime':'AT','Kelly Kizito':'KK'
};

export const PALETTE = [
  '#d4820a','#4a7c59','#b84c1e','#6a5c48','#8a6a9a','#3a6a8a',
  '#7a9a4a','#9a4a6a','#4a7c8a','#c0522a','#5a8a6a','#8a4a2a',
  '#3a7a9a','#9a6a3a'
];

export const PILLARS = [
  { icon:'🎯', label:'KPI & Target Achievement',     desc:'Hit committed deliverables — client work, training targets, placements, revenue' },
  { icon:'💻', label:'Quality of Work Delivered',     desc:"World-class output — web, design, film, brand work that represents ERA92 Elevate's standard" },
  { icon:'🌍', label:'Mission Impact',                desc:'Directly moved the needle on youth empowerment — reached students, placed someone, opened a door' },
  { icon:'🤝', label:'Team & Community Contribution', desc:'Uplifted teammates, students or community — mentored, collaborated, filled gaps without being asked' },
  { icon:'💡', label:'Innovation & Problem Solving',  desc:'Found a smarter, faster or more creative way — brought a new idea that made ERA92 better' },
  { icon:'🔥', label:'Attitude & Consistency',        desc:'Showed up fully every week — reliable, resilient, solutions-focused especially when things got hard' },
];

export const TASK_COLS = [
  { id:'todo',       name:'To Do',       color:'#4f9cf9' },
  { id:'inprogress', name:'In Progress', color:'#d4820a' },
  { id:'done',       name:'Done',        color:'#3ecf8e' },
];

export const PRIORITY_COLORS = { high:'#f96060', medium:'#d4820a', low:'#3ecf8e' };

export const SS_KEYS  = { scores:'era92_sc', history:'era92_hi', votes:'era92_vo', ann:'era92_an', voted:'era92_vd', taskBonus:'era92_tb' };
export const TASK_BONUS_PTS = 2;
export const TASK_KEY    = 'era92_tasks_v1';
export const SETTINGS_KEY = 'era92_settings_v1';
export const USER_KEY    = 'era92_user';
export const ADMIN_KEY   = 'era92_admin';

export function memberColor(name) {
  return PALETTE[TEAM.indexOf(name) % PALETTE.length] || '#d4820a';
}
export function getInitials(name) {
  if (!name) return '?';
  return (INITIALS_MAP[name] || name.split(' ').map(w => w[0]).slice(0,2).join('')).toUpperCase();
}
export function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
export function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}
export function uid() {
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}
