const { OFFICIAL_ACADEMIC_PROGRAMS } = require('./official-coefficients');

function subject(subjectCode, name, coefficient, isCore = false, aliases = []) {
  return { subjectCode, name, coefficient, isCore, aliases };
}

function normalizeAcademicKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function subjectFamilyKey(value) {
  const key = normalizeAcademicKey(value);
  if (['math', 'maths', 'mathematique', 'mathematiques'].includes(key)) return 'math';
  if (key === 'francais') return 'francais';
  if (key === 'anglais') return 'anglais';
  if (key === 'svt') return 'svt';
  if (['pc', 'physique', 'physique chimie', 'physique chimie pc'].includes(key)) return 'physique';
  if (['histoire', 'geo', 'geographie', 'histoire geo', 'histoire geographie', 'hg'].includes(key)) return 'hg';
  if (['philo', 'philosophie'].includes(key)) return 'philo';
  if (['eps', 'education physique et sportive'].includes(key)) return 'eps';
  if (['edhc', 'education droits homme citoyennete', 'education aux droits de l homme et a la citoyennete'].includes(key)) return 'edhc';
  if (['art plastique', 'arts plastiques'].includes(key)) return 'art';
  if (['musique', 'education musicale'].includes(key)) return 'musique';
  if (['arts musique', 'arts plastiques ed musicale', 'arts plastiques education musicale'].includes(key)) return 'arts_musique';
  if (key === 'espagnol') return 'espagnol';
  if (key === 'allemand') return 'allemand';
  if (['lv2', 'l v 2', 'lv2 allemand espagnol', 'l v 2 all esp'].includes(key)) return 'lv2';
  if (['informatique', 'tice'].includes(key)) return 'info';
  if (key === 'conduite') return 'conduite';
  return key || 'other';
}

function mergeSubjectAliases(left = [], right = []) {
  return [...new Set([...(left || []), ...(right || [])].filter(Boolean))];
}

function normalizeCatalogSubject(candidate) {
  const next = { ...candidate };
  const family = subjectFamilyKey(next.subjectCode || next.name);

  if (family === 'hg') {
    next.subjectCode = 'histoire_geographie';
    next.name = 'Histoire-Géographie';
    next.coefficient = Number(next.coefficient || 2);
    next.isCore = next.isCore !== false;
    next.aliases = mergeSubjectAliases(next.aliases, HG_ALIASES);
  }

  return next;
}

function mergeSubjectLists(defaultSubjects = [], storedSubjects = []) {
  const merged = [];
  const indexByFamily = new Map();

  function addOrMerge(candidate, preferCandidate = true) {
    if (!candidate || typeof candidate !== 'object') return;
    const normalizedCandidate = normalizeCatalogSubject(candidate);
    const family = subjectFamilyKey(normalizedCandidate.subjectCode || normalizedCandidate.name);
    const existingIndex = indexByFamily.get(family);

    if (existingIndex === undefined) {
      indexByFamily.set(family, merged.length);
      merged.push(normalizedCandidate);
      return;
    }

    const existing = merged[existingIndex];
    const next = preferCandidate
      ? { ...existing, ...normalizedCandidate }
      : { ...normalizedCandidate, ...existing };

    if (family === 'hg') {
      next.subjectCode = 'histoire_geographie';
      next.name = 'Histoire-Géographie';
      next.isCore = Boolean(existing.isCore || normalizedCandidate.isCore);
      next.coefficient = Math.max(Number(existing.coefficient || 0), Number(normalizedCandidate.coefficient || 0), 2);
    }

    next.aliases = mergeSubjectAliases(existing.aliases, normalizedCandidate.aliases);
    merged[existingIndex] = next;
  }

  defaultSubjects.forEach((item) => addOrMerge(item, false));
  storedSubjects.forEach((item) => addOrMerge(item, true));

  return merged;
}

const HG_ALIASES = ['Histoire', 'Géographie', 'Geo', 'HG', 'Histoire Geo', 'Histoire-Géographie'];

function histoireGeographie(coefficient = 2, isCore = true) {
  return subject('histoire_geographie', 'Histoire-Géographie', coefficient, isCore, HG_ALIASES);
}

function commonOptionalSubjects({ includeLv2 = false, includeArts = true, includeInfo = false } = {}) {
  const values = [
    subject('edhc', 'EDHC', 1, false, ['Education aux droits de l’homme et à la citoyenneté']),
    subject('eps', 'EPS', 1, false, ['Education physique et sportive'])
  ];

  if (includeArts) {
    values.push(
      subject('arts_plastiques', 'Arts plastiques', 1, false, ['Art plastique']),
      subject('musique', 'Musique', 1, false, ['Education musicale'])
    );
  }

  if (includeLv2) {
    values.push(
      subject('espagnol', 'Espagnol', 1, false, ['LV2 Espagnol']),
      subject('allemand', 'Allemand', 1, false, ['LV2 Allemand'])
    );
  }

  if (includeInfo) {
    values.push(subject('informatique', 'Informatique', 1, false, ['TICE']));
  }

  return values;
}

function collegeSeries(label, order, coefficients = {}) {
  const mathCoefficient = coefficients.math || (label === '4e' || label === '3e' ? 4 : 3);
  const francaisCoefficient = coefficients.francais || (label === '3e' ? 4 : 3);

  return {
    label,
    cycle: 'college',
    order,
    subjects: [
      subject('francais', 'Français', francaisCoefficient, true),
      subject('math', 'Math', mathCoefficient, true, ['Mathématiques', 'Maths']),
      histoireGeographie(2, true),
      subject('anglais', 'Anglais', 2, true),
      subject('physique', 'Physique-Chimie', 2, true, ['Physique', 'PC']),
      subject('svt', 'SVT', 2, true),
      ...commonOptionalSubjects({ includeLv2: order >= 3, includeInfo: order >= 3 })
    ]
  };
}

function secondSeries(label, order) {
  return {
    label,
    cycle: 'lycee',
    order,
    subjects: [
      subject('francais', 'Français', 3, true),
      subject('math', 'Math', 4, true, ['Mathématiques', 'Maths']),
      subject('physique', 'Physique-Chimie', 3, true, ['Physique', 'PC']),
      subject('svt', 'SVT', 3, true),
      histoireGeographie(2, true),
      subject('anglais', 'Anglais', 2, true),
      ...commonOptionalSubjects({ includeLv2: true, includeInfo: true })
    ]
  };
}

function humanitiesSeries(label, order) {
  return {
    label,
    cycle: 'lycee',
    order,
    subjects: [
      subject('francais', 'Français', 5, true),
      subject('philo', 'Philosophie', 4, true),
      histoireGeographie(4, true),
      subject('anglais', 'Anglais', 3, true),
      subject('math', 'Math', 2, false, ['Mathématiques', 'Maths']),
      ...commonOptionalSubjects({ includeLv2: true, includeInfo: true })
    ]
  };
}

function scienceSeries(label, order, mainCoefficient = 6) {
  return {
    label,
    cycle: 'lycee',
    order,
    subjects: [
      subject('math', 'Math', mainCoefficient, true, ['Mathématiques', 'Maths']),
      subject('physique', 'Physique-Chimie', mainCoefficient, true, ['Physique', 'PC']),
      subject('svt', 'SVT', Math.max(mainCoefficient - 1, 4), true),
      subject('francais', 'Français', 2, false),
      subject('anglais', 'Anglais', 2, false),
      subject('philo', 'Philosophie', 2, false),
      histoireGeographie(2, true),
      ...commonOptionalSubjects({ includeLv2: true, includeInfo: true })
    ]
  };
}

const LEGACY_ACADEMIC_PROGRAMS = {
  '6e': collegeSeries('6e', 1),
  '5e': collegeSeries('5e', 2),
  '4e': collegeSeries('4e', 3),
  '3e': collegeSeries('3e', 4),
  'Seconde A': secondSeries('Seconde A', 5),
  'Seconde B': secondSeries('Seconde B', 6),
  'Seconde C': secondSeries('Seconde C', 7),
  'Seconde D': secondSeries('Seconde D', 8),
  'Seconde E': secondSeries('Seconde E', 9),
  'Première A': humanitiesSeries('Première A', 10),
  'Première B': humanitiesSeries('Première B', 11),
  'Première C': scienceSeries('Première C', 12, 6),
  'Première D': scienceSeries('Première D', 13, 5),
  'Première E': scienceSeries('Première E', 14, 4),
  'Terminale A': humanitiesSeries('Terminale A', 15),
  'Terminale B': humanitiesSeries('Terminale B', 16),
  'Terminale C': scienceSeries('Terminale C', 17, 7),
  'Terminale D': scienceSeries('Terminale D', 18, 6),
  'Terminale E': scienceSeries('Terminale E', 19, 5),
  Seconde: secondSeries('Seconde', 20)
};

const ACADEMIC_PROGRAMS = {
  ...LEGACY_ACADEMIC_PROGRAMS,
  ...OFFICIAL_ACADEMIC_PROGRAMS
};

function buildProgramSubjectOptions(program = {}) {
  return [...new Set((program.subjects || []).map((item) => item.name).filter(Boolean))];

}

function normalizeAcademicProgram(program = {}) {
  const subjects = mergeSubjectLists(program.subjects || [], []);

  return {
    ...program,
    subjects,
    subjectOptions: buildProgramSubjectOptions({ subjects })
  };
}

function hasSubjectFamily(subjects = [], family) {
  return subjects.some((item) => subjectFamilyKey(item.subjectCode || item.name) === family);
}

function findSubjectByFamily(subjects = [], family) {
  return subjects.find((item) => subjectFamilyKey(item.subjectCode || item.name) === family) || null;
}

function completeAcademicProgram(classCode, storedProgram = {}, defaultProgram = {}) {
  const hasStoredSubjects = Array.isArray(storedProgram.subjects) && storedProgram.subjects.length > 0;
  const sourceProgram = hasStoredSubjects ? storedProgram : defaultProgram;
  const subjects = mergeSubjectLists([], sourceProgram.subjects || []);
  const defaultHg = findSubjectByFamily(defaultProgram.subjects || [], 'hg');

  if (defaultHg && !hasSubjectFamily(subjects, 'hg')) {
    subjects.push(normalizeCatalogSubject(defaultHg));
  }

  return normalizeAcademicProgram({
    ...defaultProgram,
    ...storedProgram,
    subjects
  });
}

function mergeAcademicPrograms(defaultPrograms = ACADEMIC_PROGRAMS, storedPrograms = {}) {
  const hasStoredPrograms = Object.keys(storedPrograms || {}).length > 0;
  const keys = hasStoredPrograms
    ? [...new Set([...Object.keys(defaultPrograms || {}), ...Object.keys(storedPrograms || {})])]
    : Object.keys(defaultPrograms || {});

  return keys.reduce((acc, classCode) => {
    const defaults = defaultPrograms[classCode] || {};
    const stored = storedPrograms[classCode] || {};
    acc[classCode] = completeAcademicProgram(classCode, stored, defaults);
    return acc;
  }, {});
}

module.exports = {
  ACADEMIC_PROGRAMS,
  buildProgramSubjectOptions,
  completeAcademicProgram,
  mergeAcademicPrograms,
  normalizeAcademicProgram,
  subjectFamilyKey
};
