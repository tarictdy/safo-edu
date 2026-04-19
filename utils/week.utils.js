const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function startOfWeekUTC(inputDate = new Date()) {
  const date = new Date(inputDate);
  const day = date.getUTCDay() || 7;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - day + 1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function addDaysUTC(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toIsoDateUTC(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function weekKeyFromDate(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekKeyToStartDateUTC(weekKey) {
  const match = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfWeekUTC(new Date());

  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  mondayWeek1.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  mondayWeek1.setUTCHours(0, 0, 0, 0);
  return mondayWeek1;
}

function dayNameToIndex(dayName) {
  return jours.indexOf(dayName);
}

function dayIndexToName(dayIndex) {
  return jours[dayIndex] || jours[0];
}

function sessionDateFromWeekKey(weekKey, dayName, hourLabel) {
  const weekStart = weekKeyToStartDateUTC(weekKey);
  const dayIndex = Math.max(0, dayNameToIndex(dayName));
  const sessionDate = addDaysUTC(weekStart, dayIndex);

  const match = String(hourLabel || '').match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : 0;
  const minute = match ? Number(match[2]) : 0;

  sessionDate.setUTCHours(hour, minute, 0, 0);
  return sessionDate;
}

module.exports = {
  jours,
  startOfWeekUTC,
  addDaysUTC,
  toIsoDateUTC,
  weekKeyFromDate,
  weekKeyToStartDateUTC,
  dayNameToIndex,
  dayIndexToName,
  sessionDateFromWeekKey
};
