// time_utils.js — centralized timezone, market hours, expiry calc.
// CONVENTION: DB stores UTC. UI/log displays IST. NEVER mix.
'use strict';

const IST_OFFSET_MIN = 330;  // IST = UTC + 5:30

function nowUtc() { return new Date(); }

function nowIst() {
  const d = new Date();
  return new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
}

function utcToIst(date) {
  return new Date(date.getTime() + IST_OFFSET_MIN * 60 * 1000);
}

function istToUtc(date) {
  return new Date(date.getTime() - IST_OFFSET_MIN * 60 * 1000);
}

function fmtIst(date) {
  if (!date) return '';
  const ist = utcToIst(date);
  return ist.toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

// IST clock returns 'HH:MM' or 'HH:MM:SS'
function istClock(date = new Date(), withSeconds = false) {
  const ist = utcToIst(date);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  if (!withSeconds) return `${hh}:${mm}`;
  const ss = String(ist.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Market schedule (NSE F&O)
function isMarketHoliday(date = nowIst()) {
  const ist = date.getUTCDay !== undefined ? date : utcToIst(date);
  const dow = ist.getUTCDay();
  if (dow === 0 || dow === 6) return true;  // weekend
  // TODO: hook into NSE holiday calendar via DB lookup. For now, just weekends.
  return false;
}

function isMarketOpen(date = nowUtc()) {
  if (isMarketHoliday(date)) return false;
  const ist = utcToIst(date);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

function minutesAfterIst(hh, mm, date = nowUtc()) {
  const ist = utcToIst(date);
  return (ist.getUTCHours() * 60 + ist.getUTCMinutes()) - (hh * 60 + mm);
}

function dayOfWeek(date = nowUtc()) {
  const ist = utcToIst(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][ist.getUTCDay()];
}

// NIFTY weekly expiry: Tuesday post-Aug 2024, Thursday before. Returns Date in UTC at 15:30 IST.
function currentWeeklyExpiryDay(date = nowUtc()) {
  const cutover = new Date('2024-08-26T00:00:00Z');  // approximate flip date
  return date >= cutover ? 'Tue' : 'Thu';
}

function nextWeeklyExpiry(date = nowUtc()) {
  const targetDayName = currentWeeklyExpiryDay(date);
  const targetDay = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }[targetDayName];
  const ist = utcToIst(date);
  const dow = ist.getUTCDay();
  let diff = (targetDay - dow + 7) % 7;
  if (diff === 0) {
    // If today IS expiry day, check if we're past 15:30 IST
    const minNow = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    if (minNow >= 15 * 60 + 30) diff = 7;  // already expired today, get next week
  }
  const expiryDate = new Date(ist);
  expiryDate.setUTCDate(ist.getUTCDate() + diff);
  expiryDate.setUTCHours(10, 0, 0, 0);  // 15:30 IST = 10:00 UTC
  return istToUtc(expiryDate);
}

function dteToNextExpiry(date = nowUtc()) {
  const expiry = nextWeeklyExpiry(date);
  const diffMs = expiry - date;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function isExpiryToday(date = nowUtc()) {
  return dayOfWeek(date) === currentWeeklyExpiryDay(date);
}

// Date string in IST DD-MMM-YYYY (matches Stockmock CSVs)
function istDateString(date = nowUtc()) {
  const ist = utcToIst(date);
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ist.getUTCMonth()];
  const yyyy = ist.getUTCFullYear();
  return `${dd}-${mon}-${yyyy}`;
}

// ISO date for DB (UTC, YYYY-MM-DD)
function isoDate(date = nowUtc()) {
  return date.toISOString().slice(0, 10);
}

module.exports = {
  IST_OFFSET_MIN,
  nowUtc, nowIst, utcToIst, istToUtc,
  fmtIst, istClock, istDateString, isoDate,
  isMarketHoliday, isMarketOpen, minutesAfterIst, dayOfWeek,
  currentWeeklyExpiryDay, nextWeeklyExpiry, dteToNextExpiry, isExpiryToday,
};
