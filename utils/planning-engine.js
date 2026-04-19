const { ACADEMIC_PROGRAMS } = require('./academic-data');

const {
  getCanonicalSubjectLabel,
  getSubjectColor,
  getSubjectFamilyKey,
  areSubjectsEquivalent
} = require('./subject.utils');

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const SLOT_DURATION_HOURS = 1;

function buildScheduleSlots() {
  const slots = [];
  for (let hour = 7; hour <= 23; hour += 1) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
  }
  slots.push('23:30');
  return slots;
}

const horaires = buildScheduleSlots();

const LIMITES = {
  maxHeuresSemaineParDefaut: 18,
  maxSessionsJour: 8,
  bonusWeekendSessions: 2,
  maxSessionsWeekend: 10,
  creneauxSommeilProteges: ['23:30'],
  creneauxRevisionVeille: ['20:00', '21:00', '22:00'],
  optionalSubjects: ['EPS', 'EDHC', 'Art plastique', 'Arts plastiques', 'Musique', 'Espagnol', 'Allemand', 'Informatique'],
  microRevisionBeforeCourseMinutes: 10,
  microRevisionDuringCourseMinutes: 5
};

const BLOCS_NON_ETUDE = new Set([
  'Cours',
  'Repos',
  'Pause',
  'Sommeil',
  'Activite personnelle',
  'Activite',
  'Indisponible',
  'Libre'
]);

function getSlotDurationHours(hourLabel) {
  return String(hourLabel) === '23:30' ? 0.5 : SLOT_DURATION_HOURS;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const OPTIONAL_SUBJECT_KEYS = new Set([
  'eps',
  'education physique et sportive',
  'edhc',
  'education droits homme citoyennete',
  'education aux droits de l homme et a la citoyennete',
  'art plastique',
  'arts plastiques',
  'musique',
  'education musicale',
  'espagnol',
  'allemand',
  'informatique',
  'tice'
]);

function isOptionalSubjectName(name) {
  return OPTIONAL_SUBJECT_KEYS.has(normalizeName(name));
}

function isWeekend(day) {
  return day === 'Samedi' || day === 'Dimanche';
}

function previousDay(day) {
  const index = jours.indexOf(day);
  if (index === -1) return null;
  return jours[(index - 1 + jours.length) % jours.length];
}

function isSleepProtectedSlot(day, hour) {
  return !isWeekend(day) && LIMITES.creneauxSommeilProteges.includes(hour);
}

function isBlockedValue(value) {
  if (!value) return false;
  if (String(value).startsWith('Cours ')) return true;
  if (String(value).startsWith('Micro-revision ')) return true;
  return BLOCS_NON_ETUDE.has(value);
}

function isStudyBlock(value) {
  return Boolean(value) && !isBlockedValue(value);
}

function getProgram(classCode, programs = ACADEMIC_PROGRAMS) {
  return programs[classCode] || null;
}

function getImportantSubjects(classCode, programs = ACADEMIC_PROGRAMS) {
  const program = getProgram(classCode, programs);
  if (!program) return [];

  const ranked = [...program.subjects]
    .filter((subject) => !isOptionalSubjectName(subject.name))
    .sort((a, b) => {
      if (Boolean(b.isCore) !== Boolean(a.isCore)) return Number(b.isCore) - Number(a.isCore);
      return Number(b.coefficient || 0) - Number(a.coefficient || 0);
    });

  const strict = ranked.filter((subject) => Number(subject.coefficient || 0) >= 4).map((subject) => subject.name);
  if (strict.length > 0) return strict;

  return ranked.slice(0, 3).map((subject) => subject.name);
}

function getDayLimits(maxSessionsPerDay) {
  const weekdayHours = Math.max(1, Math.min(Number(maxSessionsPerDay || 3), LIMITES.maxSessionsJour));
  const limits = {};

  jours.forEach((day) => {
    limits[day] = isWeekend(day)
      ? Math.min(weekdayHours + LIMITES.bonusWeekendSessions, LIMITES.maxSessionsWeekend)
      : weekdayHours;
  });

  return limits;
}

function initializeCalendar() {
  const calendar = {};
  jours.forEach((day) => {
    calendar[day] = {};
    horaires.forEach((hour) => {
      calendar[day][hour] = isSleepProtectedSlot(day, hour) ? 'Sommeil' : null;
    });
  });
  return calendar;
}

function normalizeHourLabel(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (horaires.includes(raw)) return raw;

  const h30Match = raw.match(/^(\d{1,2})h30$/i);
  if (h30Match) {
    const hour = String(Number(h30Match[1])).padStart(2, '0');
    const label = `${hour}:30`;
    return horaires.includes(label) ? label : null;
  }

  const hMatch = raw.match(/^(\d{1,2})h$/i);
  if (hMatch) {
    const hour = String(Number(hMatch[1])).padStart(2, '0');
    const label = `${hour}:00`;
    return horaires.includes(label) ? label : null;
  }

  const isoMatch = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (isoMatch) {
    const hour = String(Number(isoMatch[1])).padStart(2, '0');
    const minute = String(Number(isoMatch[2])).padStart(2, '0');
    const label = `${hour}:${minute}`;
    if (horaires.includes(label)) return label;

    // Legacy support: old datasets had half-hour slots. Collapse to the hour slot,
    // except 23:30 which remains explicit.
    if (minute === '30' && hour !== '23') {
      const collapsed = `${hour}:00`;
      return horaires.includes(collapsed) ? collapsed : null;
    }
  }

  return null;
}

function normalizeFixedCourseEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const day = entry.day || entry.jour;
  const startHour = normalizeHourLabel(entry.startHour || entry.hour || entry.heure);
  if (!jours.includes(day) || !startHour) return null;

  return {
    day,
    startHour,
    label: entry.label || entry.matiere || entry.subjectName || '',
    subjectName: entry.subjectName || entry.matiere || entry.label || '',
    type: entry.type || (entry.isSchoolCourse ? 'school-course' : 'busy'),
    isSchoolCourse: Boolean(entry.isSchoolCourse || entry.type === 'school-course')
  };
}

function computeSubjectScores(classCode, difficultyMap = {}, examMode = false, exams = [], programs = ACADEMIC_PROGRAMS) {
  const program = getProgram(classCode, programs);
  if (!program) return [];

  return program.subjects.map((subject) => {
    const diff = Number(difficultyMap[subject.name] || difficultyMap[subject.subjectCode] || 3);
    const hasExam = exams.some((exam) => (
      exam.subjectCode === subject.subjectCode || areSubjectsEquivalent(exam.subjectName, subject.name)
    ));
    const isOptional = isOptionalSubjectName(subject.name);

    const coreBoost = subject.isCore ? 1.3 : 1;
    const optionalPenalty = isOptional ? 0.28 : 1;
    const examBoost = examMode && Number(subject.coefficient || 0) >= 4 ? 1.2 : 1;
    const examNearBoost = hasExam ? 1.35 : 1;

    return {
      matiere: subject.name,
      subjectCode: subject.subjectCode,
      coef: Number(subject.coefficient || 1),
      diff,
      isCore: Boolean(subject.isCore),
      isOptional,
      hasExam,
      score: diff * Number(subject.coefficient || 1) * coreBoost * optionalPenalty * examBoost * examNearBoost
    };
  });
}

function listFreeSlots(calendar, preferences = []) {
  const freeSlots = [];

  jours.forEach((day) => {
    horaires.forEach((hour) => {
      if (calendar[day][hour]) return;

      const numericHour = Number(hour.split(':')[0]);
      const isMorning = numericHour >= 7 && numericHour < 12;
      const isAfternoon = numericHour >= 12 && numericHour < 18;
      const isEvening = numericHour >= 18;

      if (preferences.length > 0) {
        const accepted =
          (preferences.includes('matin') && isMorning) ||
          (preferences.includes('apresmidi') && isAfternoon) ||
          (preferences.includes('soir') && isEvening);
        if (!accepted) return;
      }

      freeSlots.push({
        jour: day,
        heure: hour,
        duration: getSlotDurationHours(hour)
      });
    });
  });

  return freeSlots.sort((a, b) => {
    if (isWeekend(a.jour) && !isWeekend(b.jour)) return -1;
    if (!isWeekend(a.jour) && isWeekend(b.jour)) return 1;
    return horaires.indexOf(a.heure) - horaires.indexOf(b.heure);
  });
}

function buildWeightedPool(scores, maxHoursByWeek) {
  const prioritized = scores.filter((subject) => !subject.isOptional || subject.hasExam || subject.diff >= 5);
  const source = prioritized.length > 0 ? prioritized : scores;

  const total = source.reduce((sum, item) => sum + item.score, 0) || 1;
  const pool = [];

  source.forEach((subject) => {
    const estimatedHours = Math.max(1, Math.round((subject.score / total) * maxHoursByWeek));
    for (let i = 0; i < estimatedHours; i += 1) {
      pool.push(subject.matiere);
    }
  });

  return pool;
}

function applySpacedRevisionPlan(pool, scores) {
  const top = [...scores]
    .filter((subject) => !subject.isOptional)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((subject) => subject.matiere);

  top.forEach((name) => pool.push(name, name));
}

function findScoreEntry(scores = [], subjectName) {
  return scores.find((entry) => areSubjectsEquivalent(entry.matiere, subjectName)) || null;
}

function resolveBeforeCourseMinutes(subjectName, scores = []) {
  const scoreEntry = findScoreEntry(scores, subjectName);
  if (!scoreEntry) return LIMITES.microRevisionBeforeCourseMinutes;
  if (scoreEntry.isCore && (scoreEntry.coef >= 4 || scoreEntry.diff >= 4)) return 20;
  if (scoreEntry.isCore || scoreEntry.diff >= 3) return 15;
  return 10;
}

function applyGapRevisions(calendar, schoolCourseSlots = [], scores = [], sessionsDay, dayLimits, maxHoursByWeek) {
  let placedHours = 0;

  [...schoolCourseSlots]
    .sort((a, b) => {
      const dayDiff = jours.indexOf(a.day) - jours.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return horaires.indexOf(a.startHour) - horaires.indexOf(b.startHour);
    })
    .forEach((slot) => {
      const scoreEntry = findScoreEntry(scores, slot.subjectName);
      if (!scoreEntry || !scoreEntry.isCore || scoreEntry.isOptional) return;

      const slotIndex = horaires.indexOf(slot.startHour);
      if (slotIndex <= 0) return;

      const previousHour = horaires[slotIndex - 1];
      const duration = getSlotDurationHours(previousHour);
      if ((placedHours + duration) > maxHoursByWeek) return;
      if ((sessionsDay[slot.day] || 0) + duration > dayLimits[slot.day]) return;
      if (calendar[slot.day][previousHour]) return;

      calendar[slot.day][previousHour] = `Revision ${getCanonicalSubjectLabel(slot.subjectName)} (heure creuse)`;
      sessionsDay[slot.day] = Number(((sessionsDay[slot.day] || 0) + duration).toFixed(2));
      placedHours = Number((placedHours + duration).toFixed(2));
    });

  return placedHours;
}

function applyFixedCourses(calendar, fixedCourses = []) {
  const schoolCourseSlots = [];

  fixedCourses.forEach((entry) => {
    const course = normalizeFixedCourseEntry(entry);
    if (!course || !calendar[course.day]) return;
    if (isSleepProtectedSlot(course.day, course.startHour)) return;

    const blocked = new Set(['repos', 'pause', 'sommeil', 'activite personnelle', 'indisponible']);
    const normalizedLabel = normalizeName(course.label || course.subjectName);

    if (course.type === 'blocked' || blocked.has(normalizedLabel)) {
      calendar[course.day][course.startHour] = course.label || 'Indisponible';
      return;
    }

    const subjectName = getCanonicalSubjectLabel(course.subjectName || course.label);
    calendar[course.day][course.startHour] = `Cours ${subjectName}`;
    schoolCourseSlots.push({
      day: course.day,
      startHour: course.startHour,
      subjectName,
      color: getSubjectColor(subjectName)
    });
  });

  return schoolCourseSlots;
}

function buildMicroRevisionPlan(schoolCourseSlots = [], scores = []) {
  return [...schoolCourseSlots]
    .sort((a, b) => {
      const dayDiff = jours.indexOf(a.day) - jours.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return horaires.indexOf(a.startHour) - horaires.indexOf(b.startHour);
    })
    .map((slot) => ({
      day: slot.day,
      startHour: slot.startHour,
      subjectName: slot.subjectName,
      beforeStartMinutes: resolveBeforeCourseMinutes(slot.subjectName, scores),
      duringCourseMinutes: LIMITES.microRevisionDuringCourseMinutes,
      revisionColor: getSubjectColor(slot.subjectName),
      note: 'Revision avant cours + micro relance en cours'
    }));
}

function attachMicroRevisionNotes(calendar, microRevisionPlan) {
  return microRevisionPlan;
}

function applyDayBeforeRevisions(calendar, importantDays = {}, sessionsDay, dayLimits, maxHoursByWeek, alreadyPlacedHours) {
  let placedHours = 0;

  Object.entries(importantDays).forEach(([subject, days]) => {
    days.forEach((courseDay) => {
      const previous = previousDay(courseDay);
      if (!previous) return;

      LIMITES.creneauxRevisionVeille.forEach((hour) => {
        const duration = getSlotDurationHours(hour);
        if ((alreadyPlacedHours + placedHours + duration) > maxHoursByWeek) return;
        if (!calendar[previous] || calendar[previous][hour]) return;
        if ((sessionsDay[previous] || 0) + duration > dayLimits[previous]) return;

        calendar[previous][hour] = `Revision ${subject}`;
        sessionsDay[previous] = Number(((sessionsDay[previous] || 0) + duration).toFixed(2));
        placedHours = Number((placedHours + duration).toFixed(2));
      });
    });
  });

  return placedHours;
}

function applyExamCompositions(calendar, exams = [], sessionsDay, dayLimits, maxHoursByWeek) {
  let placedHours = 0;

  exams.forEach((exam) => {
    const examHour = normalizeHourLabel(exam.hour || exam.heure);
    if (!examHour) return;

    const duration = getSlotDurationHours(examHour);
    if ((placedHours + duration) > maxHoursByWeek) return;
    if (!calendar[exam.day] || calendar[exam.day][examHour]) return;

    calendar[exam.day][examHour] = `Compo ${exam.subjectName}`;
    sessionsDay[exam.day] = Number(((sessionsDay[exam.day] || 0) + duration).toFixed(2));
    placedHours = Number((placedHours + duration).toFixed(2));

    const previous = previousDay(exam.day);
    if (!previous) return;

    LIMITES.creneauxRevisionVeille.forEach((hour) => {
      const revDuration = getSlotDurationHours(hour);
      if ((placedHours + revDuration) > maxHoursByWeek) return;
      if (calendar[previous][hour]) return;
      if ((sessionsDay[previous] || 0) + revDuration > dayLimits[previous]) return;

      calendar[previous][hour] = `Revision ${exam.subjectName}`;
      sessionsDay[previous] = Number(((sessionsDay[previous] || 0) + revDuration).toFixed(2));
      placedHours = Number((placedHours + revDuration).toFixed(2));
    });
  });

  return placedHours;
}

function isHardSubject(name, scores, threshold = 4) {
  const found = scores.find((entry) => normalizeName(entry.matiere) === normalizeName(name));
  return Boolean(found && found.diff >= threshold && !found.isOptional);
}

function pickNextSubject(pool, previousSubject, scores) {
  let index = pool.findIndex((name) => !(isHardSubject(name, scores) && isHardSubject(previousSubject, scores)));
  if (index === -1) index = 0;
  return pool.splice(index, 1)[0];
}

function shouldForceBreak(previousSubject, previousPreviousSubject) {
  return isStudyBlock(previousSubject) && isStudyBlock(previousPreviousSubject);
}

function applyManualCalendar(calendar, manualCalendar = {}, sessionsDay, dayLimits, maxHoursByWeek, alreadyPlacedHours, scores) {
  let placedHours = 0;
  let applied = 0;

  jours.forEach((day) => {
    const dayInput = manualCalendar[day] || {};

    horaires.forEach((hour) => {
      const duration = getSlotDurationHours(hour);
      if ((alreadyPlacedHours + placedHours + duration) > maxHoursByWeek) return;
      if (!dayInput[hour]) return;
      if (!calendar[day] || calendar[day][hour]) return;

      const proposed = String(dayInput[hour]).trim();
      if (!proposed || proposed.toLowerCase() === 'libre') return;
      if (proposed === 'Repos' || proposed === 'Pause') return;

      if (['Activite personnelle', 'Indisponible', 'Sommeil'].includes(proposed) || proposed.startsWith('Cours ')) {
        calendar[day][hour] = proposed;
        applied += 1;
        return;
      }

      if ((sessionsDay[day] || 0) + duration > dayLimits[day]) return;

      const known = scores.find((entry) => normalizeName(entry.matiere) === normalizeName(proposed));
      calendar[day][hour] = known ? known.matiere : proposed;
      sessionsDay[day] = Number(((sessionsDay[day] || 0) + duration).toFixed(2));
      placedHours = Number((placedHours + duration).toFixed(2));
      applied += 1;
    });
  });

  return { placedHours, applied };
}

function detectOverload(calendar, maxSessionsPerDay, maxHoursPerWeek, dayLimits = null) {
  let totalStudyHours = 0;
  const dailySummary = [];
  const warnings = [];

  jours.forEach((day) => {
    let dayHours = 0;

    horaires.forEach((hour) => {
      const value = calendar[day][hour];
      if (!isStudyBlock(value)) return;
      dayHours += getSlotDurationHours(hour);
      totalStudyHours += getSlotDurationHours(hour);
    });

    dayHours = Number(dayHours.toFixed(2));
    const limit = dayLimits ? dayLimits[day] : Number(maxSessionsPerDay || 3);

    dailySummary.push({
      day,
      studyHours: dayHours,
      maxAllowedHours: limit,
      balanced: dayHours <= limit
    });

    if (dayHours > limit) {
      warnings.push(`${day}: ${dayHours}h (max ${limit}h)`);
    }
  });

  totalStudyHours = Number(totalStudyHours.toFixed(2));
  const overload = totalStudyHours > maxHoursPerWeek || warnings.length > 0;

  if (totalStudyHours > maxHoursPerWeek) {
    warnings.unshift(`Surcharge hebdomadaire: ${totalStudyHours}h > ${maxHoursPerWeek}h`);
  }

  return { overload, totalStudyHours, warnings, dailySummary };
}

function computeStats(calendar, scores, overloadReport) {
  const hoursBySubject = {};

  Object.values(calendar).forEach((dayMap) => {
    Object.entries(dayMap).forEach(([hour, slot]) => {
      if (!isStudyBlock(slot)) return;
      const duration = getSlotDurationHours(hour);
      const subject = String(slot)
        .replace(/^Revision\s+/, '')
        .replace(/^Compo\s+/, '')
        .replace(/\s*\(.*\)\s*$/, '');
      hoursBySubject[subject] = Number(((hoursBySubject[subject] || 0) + duration).toFixed(2));
    });
  });

  return {
    totalStudyHours: overloadReport.totalStudyHours,
    hoursBySubject,
    overloadWarnings: overloadReport.warnings,
    balancedDays: overloadReport.dailySummary.filter((day) => day.balanced).length,
    topSubjects: [...scores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((subject) => ({
        matiere: subject.matiere,
        score: Number(subject.score.toFixed(2)),
        coefficient: subject.coef,
        difficulty: subject.diff,
        isCore: subject.isCore,
        isOptional: subject.isOptional
      }))
  };
}

function buildMotivationBadge(overloadReport) {
  if (overloadReport.overload) return 'Equilibre a renforcer';
  if (overloadReport.totalStudyHours >= 14) return 'Semaine tres solide';
  if (overloadReport.totalStudyHours >= 8) return 'Bonne dynamique';
  return 'Progression lancee';
}

function buildSubjectThemes(scores = [], calendar = {}) {
  const labels = new Set(scores.map((entry) => entry.matiere));

  Object.values(calendar).forEach((dayMap) => {
    Object.values(dayMap || {}).forEach((value) => {
      const raw = String(value || '')
        .replace(/^Cours\s+/i, '')
        .replace(/^Revision\s+/i, '')
        .replace(/^Compo\s+/i, '')
        .replace(/\s*\(.*\)\s*$/, '')
        .trim();

      if (!raw || ['Repos', 'Pause', 'Sommeil', 'Indisponible', 'Activite personnelle'].includes(raw)) return;
      labels.add(getCanonicalSubjectLabel(raw));
    });
  });

  return [...labels].reduce((acc, label) => {
    acc[label] = {
      color: getSubjectColor(label),
      family: getSubjectFamilyKey(label)
    };
    return acc;
  }, {});
}

function generateSchedule(input) {
  const programs = input.programs || ACADEMIC_PROGRAMS;
  const classCode = input.classCode;
  const maxSessionsPerDay = Math.min(Number(input.maxSessionsPerDay || 3), LIMITES.maxSessionsJour);
  const maxHoursPerWeek = Number(input.maxHoursPerWeek || LIMITES.maxHeuresSemaineParDefaut);
  const examMode = Boolean(input.examMode);
  const preferredStudyMoments = Array.isArray(input.preferredStudyMoments) ? input.preferredStudyMoments.slice(0, 2) : [];
  const difficultyLevels = input.difficultyLevels || {};
  const fixedCourses = input.fixedCourses || [];
  const exams = (input.exams || []).map((exam) => ({
    subjectCode: exam.subjectCode,
    subjectName: exam.subjectName || exam.matiere,
    day: exam.day || exam.jour,
    hour: exam.hour || exam.heure,
    date: exam.date || ''
  }));
  const importantDays = input.importantDays || {};
  const manualCalendar = input.manualCalendar || input.proposedCalendar || {};

  const calendar = initializeCalendar();
  const dayLimits = getDayLimits(maxSessionsPerDay);

  const scores = computeSubjectScores(classCode, difficultyLevels, examMode, exams, programs);
  const schoolCourseSlots = applyFixedCourses(calendar, fixedCourses);
  const microRevisionPlan = buildMicroRevisionPlan(schoolCourseSlots, scores);
  attachMicroRevisionNotes(calendar, microRevisionPlan);
  const freeSlots = listFreeSlots(calendar, preferredStudyMoments);
  const totalFreeHours = freeSlots.reduce((sum, slot) => sum + slot.duration, 0);
  const maxHoursByWeekLimit = Math.min(maxHoursPerWeek, totalFreeHours);

  let pool = buildWeightedPool(scores, maxHoursByWeekLimit);
  applySpacedRevisionPlan(pool, scores);
  pool = pool.sort((a, b) => a.localeCompare(b));

  const sessionsDay = jours.reduce((acc, day) => ({ ...acc, [day]: 0 }), {});

  let totalPlacedHours = 0;
  totalPlacedHours += applyExamCompositions(calendar, exams, sessionsDay, dayLimits, maxHoursByWeekLimit - totalPlacedHours);
  totalPlacedHours += applyDayBeforeRevisions(
    calendar,
    importantDays,
    sessionsDay,
    dayLimits,
    maxHoursByWeekLimit,
    totalPlacedHours
  );
  totalPlacedHours += applyGapRevisions(
    calendar,
    schoolCourseSlots,
    scores,
    sessionsDay,
    dayLimits,
    maxHoursByWeekLimit - totalPlacedHours
  );

  const manualResult = applyManualCalendar(
    calendar,
    manualCalendar,
    sessionsDay,
    dayLimits,
    maxHoursByWeekLimit,
    totalPlacedHours,
    scores
  );
  totalPlacedHours = Number((totalPlacedHours + manualResult.placedHours).toFixed(2));

  freeSlots.forEach((slot, index) => {
    if (pool.length === 0) return;
    if (calendar[slot.jour][slot.heure]) return;

    const duration = slot.duration;
    if ((totalPlacedHours + duration) > maxHoursByWeekLimit) {
      if (index === freeSlots.length - 1 && !calendar[slot.jour][slot.heure]) {
        calendar[slot.jour][slot.heure] = 'Repos';
      }
      return;
    }

    if ((sessionsDay[slot.jour] || 0) + duration > dayLimits[slot.jour]) {
      calendar[slot.jour][slot.heure] = 'Repos';
      return;
    }

    const currentIndex = horaires.indexOf(slot.heure);
    const previousHour = horaires[Math.max(0, currentIndex - 1)];
    const previousPreviousHour = horaires[Math.max(0, currentIndex - 2)];
    const previousSubject = calendar[slot.jour][previousHour];
    const previousPreviousSubject = calendar[slot.jour][previousPreviousHour];

    if (shouldForceBreak(previousSubject, previousPreviousSubject)) {
      calendar[slot.jour][slot.heure] = 'Pause';
      return;
    }

    const subject = pickNextSubject(pool, previousSubject, scores);
    calendar[slot.jour][slot.heure] = subject;
    sessionsDay[slot.jour] = Number(((sessionsDay[slot.jour] || 0) + duration).toFixed(2));
    totalPlacedHours = Number((totalPlacedHours + duration).toFixed(2));
  });

  jours.forEach((day) => {
    horaires.forEach((hour) => {
      if (!calendar[day][hour]) calendar[day][hour] = 'Repos';
    });
  });

  const overloadReport = detectOverload(calendar, maxSessionsPerDay, maxHoursPerWeek, dayLimits);
  const stats = computeStats(calendar, scores, overloadReport);

  return {
    calendar,
    scores,
    stats,
    overload: overloadReport.overload,
    badge: buildMotivationBadge(overloadReport),
    microRevisionPlan,
    subjectThemes: buildSubjectThemes(scores, calendar),
    revisionLegend: {
      10: '#6cb6ff',
      15: '#ff8a65',
      20: '#ff4563'
    },
    manualAdjustmentsApplied: manualResult.applied,
    metadata: {
      classCode,
      examMode,
      maxSessionsPerDay,
      maxHoursPerWeek,
      preferredStudyMoments,
      importantDays,
      generatedAt: new Date().toISOString(),
      slotDurationMinutes: 60,
      hasHalfHourException: true,
      microRevisionPolicy: {
        beforeCourseMinutes: LIMITES.microRevisionBeforeCourseMinutes,
        duringCourseMinutes: LIMITES.microRevisionDuringCourseMinutes
      }
    }
  };
}

module.exports = {
  jours,
  horaires,
  LIMITES,
  SLOT_DURATION_HOURS,
  getProgram,
  getImportantSubjects,
  generateSchedule,
  isStudyBlock,
  isOptionalSubjectName,
  getSlotDurationHours
};
