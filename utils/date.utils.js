function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeDateInput(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return iso;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return iso;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

module.exports = { normalizeDateInput };
