function pad(value) {
  return String(value).padStart(2, '0');
}

export function normalizeTypedBirthDate(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  const slashMatch = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  return '';
}

export function setupBirthDateFields({ inputId = 'dateNaissance', hiddenId = 'dateNaissance' } = {}) {
  const inputEl = document.getElementById(inputId);
  const hiddenEl = document.getElementById(hiddenId);
  if (!inputEl) return '';

  const normalized = normalizeTypedBirthDate(inputEl.value);
  if (hiddenEl && hiddenEl !== inputEl) {
    hiddenEl.value = normalized;
  } else {
    inputEl.dataset.normalizedBirthdate = normalized;
  }
  return normalized;
}

export function bindBirthDateInput({ inputId = 'dateNaissance', hiddenId = 'dateNaissance' } = {}) {
  const inputEl = document.getElementById(inputId);
  const hiddenEl = document.getElementById(hiddenId);
  if (!inputEl) return;

  function syncBirthDate() {
    const normalized = normalizeTypedBirthDate(inputEl.value);
    if (hiddenEl && hiddenEl !== inputEl) {
      hiddenEl.value = normalized;
    } else {
      inputEl.dataset.normalizedBirthdate = normalized;
    }
  }

  inputEl.addEventListener('input', syncBirthDate);
  inputEl.addEventListener('blur', syncBirthDate);
  syncBirthDate();
}

export function getBirthDate(inputId = 'dateNaissance') {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return '';
  return inputEl.dataset.normalizedBirthdate || normalizeTypedBirthDate(inputEl.value);
}

export function isOlderThan(dateString, minimumAge) {
  if (!dateString) return false;
  const birthDate = new Date(dateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= minimumAge;
}

globalThis.setupBirthDateFields = setupBirthDateFields;
