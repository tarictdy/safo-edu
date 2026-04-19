function normalizeSubjectKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SUBJECT_DEFINITIONS = [
  {
    family: 'math',
    display: 'Math',
    keys: ['math', 'maths', 'mathematique', 'mathematiques']
  },
  {
    family: 'francais',
    display: 'Français',
    keys: ['francais']
  },
  {
    family: 'anglais',
    display: 'Anglais',
    keys: ['anglais']
  },
  {
    family: 'svt',
    display: 'SVT',
    keys: ['svt', 'sciences de la vie et de la terre']
  },
  {
    family: 'physique',
    display: 'Physique-Chimie',
    keys: ['pc', 'physique', 'physique chimie', 'physique chimie pc']
  },
  {
    family: 'hg',
    display: 'Histoire-Géographie',
    keys: ['histoire', 'geo', 'geographie', 'histoire geo', 'histoire geographie', 'hg']
  },
  {
    family: 'philo',
    display: 'Philosophie',
    keys: ['philo', 'philosophie']
  },
  {
    family: 'eps',
    display: 'EPS',
    keys: ['eps', 'education physique et sportive']
  },
  {
    family: 'edhc',
    display: 'EDHC',
    keys: ['edhc', 'education droits homme citoyennete', 'education aux droits de l homme et a la citoyennete']
  },
  {
    family: 'art',
    display: 'Arts plastiques',
    keys: ['art plastique', 'arts plastiques']
  },
  {
    family: 'musique',
    display: 'Musique',
    keys: ['musique', 'education musicale']
  },
  {
    family: 'arts_musique',
    display: 'Arts plastiques / Ed. musicale',
    keys: ['arts musique', 'arts plastiques ed musicale', 'arts plastiques education musicale']
  },
  {
    family: 'lv2',
    display: 'LV2 (Allemand / Espagnol)',
    keys: ['lv2', 'l v 2', 'lv2 allemand espagnol', 'l v 2 all esp']
  },
  {
    family: 'espagnol',
    display: 'Espagnol',
    keys: ['espagnol']
  },
  {
    family: 'allemand',
    display: 'Allemand',
    keys: ['allemand']
  },
  {
    family: 'info',
    display: 'Informatique',
    keys: ['informatique', 'tice']
  },
  {
    family: 'conduite',
    display: 'Conduite',
    keys: ['conduite']
  }
];

const FAMILY_BY_KEY = new Map();
const DISPLAY_BY_KEY = new Map();

SUBJECT_DEFINITIONS.forEach((definition) => {
  definition.keys.forEach((key) => {
    FAMILY_BY_KEY.set(key, definition.family);
    DISPLAY_BY_KEY.set(key, definition.display);
  });
});

const COLOR_BY_FAMILY = {
  math: '#2b8cff',
  francais: '#ff4563',
  anglais: '#4ecdc4',
  svt: '#70c36b',
  physique: '#ff9f43',
  hg: '#8a63ff',
  philo: '#b78cff',
  eps: '#22c55e',
  edhc: '#38bdf8',
  art: '#f472b6',
  musique: '#f59e0b',
  arts_musique: '#f59e0b',
  lv2: '#ef4444',
  espagnol: '#ef4444',
  allemand: '#6366f1',
  info: '#14b8a6',
  conduite: '#64748b',
  other: '#8fa7c7'
};

function getSubjectFamilyKey(value) {
  const normalized = normalizeSubjectKey(value);
  return FAMILY_BY_KEY.get(normalized) || 'other';
}

function getCanonicalSubjectLabel(value) {
  const normalized = normalizeSubjectKey(value);
  return DISPLAY_BY_KEY.get(normalized) || String(value || '').trim() || 'Matiere';
}

function getSubjectColor(value) {
  return COLOR_BY_FAMILY[getSubjectFamilyKey(value)] || COLOR_BY_FAMILY.other;
}

function areSubjectsEquivalent(left, right) {
  const leftKey = normalizeSubjectKey(left);
  const rightKey = normalizeSubjectKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  return getSubjectFamilyKey(leftKey) === getSubjectFamilyKey(rightKey);
}

function getProgramSubjectsByFamily(subjects = [], input) {
  const family = getSubjectFamilyKey(input);
  return subjects.filter((subject) => {
    if (getSubjectFamilyKey(subject.name || subject.subjectCode) === family) return true;
    return (subject.aliases || []).some((alias) => getSubjectFamilyKey(alias) === family);
  });
}

module.exports = {
  normalizeSubjectKey,
  getSubjectFamilyKey,
  getCanonicalSubjectLabel,
  getSubjectColor,
  areSubjectsEquivalent,
  getProgramSubjectsByFamily
};
