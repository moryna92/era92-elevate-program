export function getWeekId(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w = new Date(d.getFullYear(), 0, 4);
  return `${d.getFullYear()}-W${String(1 + Math.round(((d - w) / 86400000 - 3 + (w.getDay() + 6) % 7) / 7)).padStart(2, '0')}`;
}

export function getWeekNum(date = new Date()) {
  return parseInt(getWeekId(date).split('-W')[1]);
}

export function getPrevWeekId() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - 1);
  return getWeekId(d);
}

export function getVotingStatus() {
  const n = new Date(), day = n.getDay(), mins = n.getHours() * 60 + n.getMinutes();
  if (day === 1 && mins < 420) return 'soon';
  if ((day === 5 && mins >= 1080) || day === 6 || day === 0) return 'closed';
  return 'open';
}

export function shouldAnnounce() {
  const n = new Date();
  return n.getDay() === 1 && n.getHours() * 60 + n.getMinutes() >= 450;
}

export function countdownTo(tDay, tH, tM) {
  const now = new Date(), next = new Date(now);
  let days = (tDay - now.getDay() + 7) % 7;
  if (days === 0 && now.getHours() * 60 + now.getMinutes() >= tH * 60 + tM) days = 7;
  next.setDate(now.getDate() + days);
  next.setHours(tH, tM, 0, 0);
  const ms = Math.max(next - now, 0);
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  };
}

export function fmtCountdown(cd) {
  return `${cd.d > 0 ? cd.d + 'd ' : ''}${String(cd.h).padStart(2,'0')}h ${String(cd.m).padStart(2,'0')}m ${String(cd.s).padStart(2,'0')}s`;
}

export function getStatusCountdown(status) {
  if (status === 'open')   return countdownTo(5, 18, 0);
  if (status === 'soon')   return countdownTo(1, 7, 0);
  return countdownTo(1, 7, 30);
}

export function getStatusLabel(status) {
  if (status === 'open')   return 'Closes in';
  if (status === 'soon')   return 'Opens in';
  return 'Announces in';
}

// Returns { start: Date (Mon 00:00), end: Date (Sun 23:59) } for the PREVIOUS week
export function getPrevWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon ...
  // Go back to last Monday
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
  lastMon.setHours(0, 0, 0, 0);
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);
  lastSun.setHours(23, 59, 59, 999);
  return { start: lastMon, end: lastSun };
}
