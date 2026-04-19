const OFFICIAL_SOURCE = {
  document: 'Circulaire n 270/MENA/DPFC',
  schoolYear: '2023-2024',
  title: 'Coefficients du 1er et du 2nd cycles de l enseignement secondaire general'
};

function subject(subjectCode, name, coefficient, aliases = []) {
  return {
    subjectCode,
    name,
    coefficient,
    isCore: isCoreSubject(subjectCode, coefficient),
    aliases
  };
}

function isCoreSubject(subjectCode, coefficient) {
  const mainSubjects = new Set([
    'anglais',
    'francais',
    'histoire_geographie',
    'math',
    'philo',
    'physique',
    'svt'
  ]);

  return mainSubjects.has(subjectCode) && Number(coefficient || 0) >= 2;
}

function buildSubjects(coefficients) {
  return [
    subject('anglais', 'Anglais', coefficients.anglais),
    subject('arts_musique', 'Arts plastiques / Ed. musicale', coefficients.artsMusique, [
      'Arts Plastiques/Ed.Musicale',
      'Arts plastiques',
      'Art plastique',
      'Education musicale',
      'Musique'
    ]),
    subject('edhc', 'EDHC', coefficients.edhc, [
      'E.D.H.C.',
      'Education aux droits de l homme et a la citoyennete'
    ]),
    subject('eps', 'EPS', coefficients.eps, [
      'E.P.S.',
      'Education physique et sportive'
    ]),
    subject('francais', 'Francais', coefficients.francais, ['Francais', 'Français']),
    subject('histoire_geographie', 'Histoire-Geographie', coefficients.histoireGeographie, [
      'Histoire',
      'Geographie',
      'Geo',
      'HG',
      'Histoire Geo',
      'Histoire-Geographie'
    ]),
    subject('lv2', 'LV2 (Allemand / Espagnol)', coefficients.lv2, [
      'L.V.2',
      'Allemand',
      'Espagnol',
      'LV2 Allemand',
      'LV2 Espagnol'
    ]),
    subject('math', 'Mathematiques', coefficients.math, ['Math', 'Maths']),
    subject('philo', 'Philosophie', coefficients.philo),
    subject('physique', 'Physique-Chimie', coefficients.physique, ['Physique', 'PC']),
    subject('svt', 'SVT', coefficients.svt, ['Sciences de la Vie et de la Terre']),
    subject('conduite', 'Conduite', coefficients.conduite)
  ].filter((item) => Number(item.coefficient || 0) > 0);
}

function program(label, cycle, order, totalCoefficient, coefficients, extra = {}) {
  const subjects = buildSubjects(coefficients);

  return {
    label,
    cycle,
    order,
    totalCoefficient,
    officialSource: OFFICIAL_SOURCE,
    subjects,
    subjectOptions: subjects.map((item) => item.name),
    ...extra
  };
}

const FIRST_CYCLE_COMMON = {
  anglais: 2,
  artsMusique: 1,
  edhc: 1,
  eps: 1,
  histoireGeographie: 2,
  lv2: 0,
  math: 3,
  philo: 0,
  physique: 2,
  svt: 2,
  conduite: 1
};

const OFFICIAL_ACADEMIC_PROGRAMS = {
  '6e': program('6e', 'college', 1, 18, {
    ...FIRST_CYCLE_COMMON,
    francais: 3
  }),
  '5e': program('5e', 'college', 2, 18, {
    ...FIRST_CYCLE_COMMON,
    francais: 3
  }),
  '4e': program('4e', 'college', 3, 20, {
    ...FIRST_CYCLE_COMMON,
    francais: 4,
    lv2: 1
  }),
  '3e': program('3e', 'college', 4, 20, {
    ...FIRST_CYCLE_COMMON,
    francais: 4,
    lv2: 1
  }),
  'Seconde A': program('Seconde A', 'lycee', 5, 23, {
    anglais: 3,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 3,
    philo: 0,
    physique: 2,
    svt: 2,
    conduite: 1
  }),
  'Seconde C': program('Seconde C', 'lycee', 6, 23, {
    anglais: 3,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 3,
    histoireGeographie: 2,
    lv2: 1,
    math: 5,
    philo: 0,
    physique: 4,
    svt: 2,
    conduite: 1
  }),
  ['Premi' + '\u00e8re A']: program('Premi' + '\u00e8re A', 'lycee', 7, 25, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 3,
    philo: 3,
    physique: 1,
    svt: 1,
    conduite: 1
  }, { variantNote: 'Valeur A1 par defaut selon la circulaire.' }),
  ['Premi' + '\u00e8re A1']: program('Premi' + '\u00e8re A1', 'lycee', 8, 25, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 3,
    philo: 3,
    physique: 1,
    svt: 1,
    conduite: 1
  }),
  ['Premi' + '\u00e8re A2']: program('Premi' + '\u00e8re A2', 'lycee', 9, 24, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 2,
    philo: 3,
    physique: 1,
    svt: 1,
    conduite: 1
  }),
  ['Premi' + '\u00e8re C']: program('Premi' + '\u00e8re C', 'lycee', 10, 25, {
    anglais: 2,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 3,
    histoireGeographie: 2,
    lv2: 1,
    math: 5,
    philo: 2,
    physique: 5,
    svt: 2,
    conduite: 1
  }, { lv2Note: 'Coefficient facultatif selon la circulaire.' }),
  ['Premi' + '\u00e8re D']: program('Premi' + '\u00e8re D', 'lycee', 11, 25, {
    anglais: 2,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 3,
    histoireGeographie: 2,
    lv2: 1,
    math: 4,
    philo: 2,
    physique: 4,
    svt: 4,
    conduite: 1
  }, { lv2Note: 'Coefficient facultatif selon la circulaire.' }),
  'Terminale A': program('Terminale A', 'lycee', 12, 28, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 4,
    philo: 5,
    physique: 0,
    svt: 2,
    conduite: 1
  }, { variantNote: 'Valeur A1 par defaut selon la circulaire.' }),
  'Terminale A1': program('Terminale A1', 'lycee', 13, 28, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 4,
    philo: 5,
    physique: 0,
    svt: 2,
    conduite: 1
  }),
  'Terminale A2': program('Terminale A2', 'lycee', 14, 26, {
    anglais: 4,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 4,
    histoireGeographie: 3,
    lv2: 3,
    math: 2,
    philo: 5,
    physique: 0,
    svt: 2,
    conduite: 1
  }),
  'Terminale C': program('Terminale C', 'lycee', 15, 24, {
    anglais: 1,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 3,
    histoireGeographie: 2,
    lv2: 1,
    math: 5,
    philo: 2,
    physique: 5,
    svt: 2,
    conduite: 1
  }, { lv2Note: 'Coefficient facultatif selon la circulaire.' }),
  'Terminale D': program('Terminale D', 'lycee', 16, 24, {
    anglais: 1,
    artsMusique: 1,
    edhc: 0,
    eps: 1,
    francais: 3,
    histoireGeographie: 2,
    lv2: 1,
    math: 4,
    philo: 2,
    physique: 4,
    svt: 4,
    conduite: 1
  }, { lv2Note: 'Coefficient facultatif selon la circulaire.' })
};

module.exports = {
  OFFICIAL_SOURCE,
  OFFICIAL_ACADEMIC_PROGRAMS
};
