// Local leaderboard rules (Ticket-04 §3). Pure functions, shared by server.js and tests.
// Entry: { name, score, nights_won, achieved_at (ISO 8601 with offset), seed }.
// Top 10, score descending; equal scores -> whoever achieved it first ranks higher.

export const MAX_ENTRIES = 10;
// Required: 3–12 chars of [A-Za-z0-9_]. Bonus: Vietnamese letters with diacritics are also accepted.
const NAME_RE = /^[\p{L}\p{M}0-9_]{3,12}$/u;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function normalizeName(name) {
  return typeof name === 'string' ? name.normalize('NFC').trim() : '';
}

export function validName(name) {
  const n = normalizeName(name);
  const len = [...n].length; // count characters, not UTF-16 units
  return NAME_RE.test(n) && len >= 3 && len <= 12;
}

export function isoWithOffset(d = new Date()) {
  const pad = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

export function validateEntry(e) {
  const errors = [];
  if (!e || typeof e !== 'object') return ['entry must be an object'];
  if (!validName(e.name)) errors.push('name must be 3–12 characters: letters, digits or _');
  if (!Number.isInteger(e.score) || e.score < 0) errors.push('score must be an integer >= 0');
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) errors.push('nights_won must be 0–3');
  if (!Number.isInteger(e.seed)) errors.push('seed must be an integer');
  if (e.achieved_at !== undefined && !(typeof e.achieved_at === 'string' && ISO_RE.test(e.achieved_at))) errors.push('achieved_at must be ISO 8601 with offset');
  return errors;
}

const time = (e) => Date.parse(e.achieved_at);
export function sortEntries(entries) {
  return [...entries].sort((a, b) => b.score - a.score || time(a) - time(b));
}

export function addEntry(entries, e) {
  const entry = { name: normalizeName(e.name), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at || isoWithOffset(), seed: e.seed };
  const list = sortEntries([...entries, entry]).slice(0, MAX_ENTRIES);
  return { entries: list, rank: list.indexOf(entry) + 1 }; // rank 0 = did not make the top 10
}
