const {
  ACADEMIC_PROGRAMS,
  buildProgramSubjectOptions,
  mergeAcademicPrograms,
  normalizeAcademicProgram
} = require('../utils/academic-data');
const { OFFICIAL_ACADEMIC_PROGRAMS, OFFICIAL_SOURCE } = require('../utils/official-coefficients');
const { getImportantSubjects } = require('../utils/planning-engine');
const {
  readStore,
  refreshAcademicProgramsFromFirebase,
  writeAcademicProgramRecord,
  writeAcademicProgramRecords
} = require('../utils/data-store');
const { getCanonicalSubjectLabel, getSubjectColor, getSubjectFamilyKey } = require('../utils/subject.utils');

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getProgramsFromStore() {
  const store = readStore();
  return mergeAcademicPrograms(ACADEMIC_PROGRAMS, store.academic_programs || {});
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '');
}

function normalizeCoefficient(value) {
  const coefficient = Number(value);
  if (!Number.isFinite(coefficient) || coefficient < 0) {
    throw createError('Le coefficient doit etre un nombre positif ou nul.');
  }
  return coefficient;
}

function normalizeAliases(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }

  return [...new Set(String(value || '')
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function normalizeSubjectPayload(payload = {}, fallback = {}) {
  const name = String(payload.name ?? fallback.name ?? '').trim();
  if (!name) throw createError('Le nom de la matiere est obligatoire.');

  return {
    subjectCode: slugify(payload.subjectCode || fallback.subjectCode || name),
    name,
    coefficient: normalizeCoefficient(payload.coefficient ?? fallback.coefficient ?? 1),
    isCore: Boolean(payload.isCore ?? fallback.isCore ?? false),
    aliases: normalizeAliases(payload.aliases ?? fallback.aliases ?? [])
  };
}

function normalizeProgramPayload(classCode, payload = {}, previous = {}) {
  const subjects = Array.isArray(payload.subjects)
    ? payload.subjects.map((subject) => normalizeSubjectPayload(subject))
    : (previous.subjects || []).map((subject) => normalizeSubjectPayload(subject));

  return normalizeAcademicProgram({
    ...previous,
    ...payload,
    label: String(payload.label ?? previous.label ?? classCode).trim(),
    cycle: String(payload.cycle ?? previous.cycle ?? 'college').trim(),
    order: Number(payload.order ?? previous.order ?? 999),
    totalCoefficient: payload.totalCoefficient === undefined
      ? previous.totalCoefficient
      : normalizeCoefficient(payload.totalCoefficient),
    subjects
  });
}

function decorateProgram(classCode, program, programs = null) {
  const allPrograms = programs || { [classCode]: program };

  return {
    classCode,
    label: program.label,
    cycle: program.cycle,
    order: program.order,
    totalCoefficient: program.totalCoefficient ?? null,
    officialSource: program.officialSource || null,
    variantNote: program.variantNote || null,
    lv2Note: program.lv2Note || null,
    subjects: (program.subjects || []).map((subject) => ({
      ...subject,
      canonicalName: getCanonicalSubjectLabel(subject.name),
      family: getSubjectFamilyKey(subject.name || subject.subjectCode),
      color: getSubjectColor(subject.name)
    })),
    subjectOptions: buildProgramSubjectOptions(program),
    importantSubjects: getImportantSubjects(classCode, allPrograms)
  };
}

async function listClasses() {
  await refreshAcademicProgramsFromFirebase().catch(() => null);
  const programs = getProgramsFromStore();
  return Object.entries(programs)
    .map(([classCode, value]) => ({ classCode, label: value.label, cycle: value.cycle, order: value.order }))
    .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
}

async function getProgramByClass(classCode) {
  await refreshAcademicProgramsFromFirebase().catch(() => null);
  const programs = getProgramsFromStore();
  const program = programs[classCode];
  if (!program) return null;

  return decorateProgram(classCode, program, programs);
}

async function listPrograms() {
  await refreshAcademicProgramsFromFirebase().catch(() => null);
  const programs = getProgramsFromStore();
  return Object.entries(programs)
    .map(([classCode, program]) => decorateProgram(classCode, program, programs))
    .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
}

async function saveProgram(classCode, payload) {
  const programs = getProgramsFromStore();
  const previous = programs[classCode] || {};
  const normalized = normalizeProgramPayload(classCode, payload, previous);
  await writeAcademicProgramRecord(classCode, normalized);
  return decorateProgram(classCode, normalized, { ...programs, [classCode]: normalized });
}

async function addSubject(classCode, payload) {
  const programs = getProgramsFromStore();
  const previous = programs[classCode];
  if (!previous) throw createError('Classe introuvable.', 404);

  const subject = normalizeSubjectPayload(payload);
  const exists = (previous.subjects || []).some((item) => item.subjectCode === subject.subjectCode);
  if (exists) throw createError('Une matiere avec ce code existe deja dans cette classe.', 409);

  const normalized = normalizeProgramPayload(classCode, {
    ...previous,
    subjects: [...(previous.subjects || []), subject]
  }, previous);

  await writeAcademicProgramRecord(classCode, normalized);
  return decorateProgram(classCode, normalized, { ...programs, [classCode]: normalized });
}

async function updateSubject(classCode, subjectCode, payload) {
  const programs = getProgramsFromStore();
  const previous = programs[classCode];
  if (!previous) throw createError('Classe introuvable.', 404);

  let found = false;
  const subjects = (previous.subjects || []).map((subject) => {
    if (subject.subjectCode !== subjectCode) return subject;
    found = true;
    return normalizeSubjectPayload(payload, subject);
  });

  if (!found) throw createError('Matiere introuvable dans cette classe.', 404);

  const normalized = normalizeProgramPayload(classCode, {
    ...previous,
    subjects
  }, previous);

  await writeAcademicProgramRecord(classCode, normalized);
  return decorateProgram(classCode, normalized, { ...programs, [classCode]: normalized });
}

async function removeSubject(classCode, subjectCode) {
  const programs = getProgramsFromStore();
  const previous = programs[classCode];
  if (!previous) throw createError('Classe introuvable.', 404);

  const subjects = (previous.subjects || []).filter((subject) => subject.subjectCode !== subjectCode);
  if (subjects.length === (previous.subjects || []).length) {
    throw createError('Matiere introuvable dans cette classe.', 404);
  }

  const normalized = normalizeProgramPayload(classCode, {
    ...previous,
    subjects
  }, previous);

  await writeAcademicProgramRecord(classCode, normalized);
  return decorateProgram(classCode, normalized, { ...programs, [classCode]: normalized });
}

async function syncOfficialCoefficientPrograms() {
  const programs = getProgramsFromStore();
  const updates = Object.fromEntries(
    Object.entries(OFFICIAL_ACADEMIC_PROGRAMS).map(([classCode, officialProgram]) => [
      classCode,
      normalizeProgramPayload(classCode, {
        ...(programs[classCode] || {}),
        ...officialProgram,
        subjects: officialProgram.subjects
      }, programs[classCode] || {})
    ])
  );

  await writeAcademicProgramRecords(updates);

  return {
    source: OFFICIAL_SOURCE,
    updatedCount: Object.keys(updates).length,
    updatedClasses: Object.keys(updates),
    preservedClasses: Object.keys(programs).filter((classCode) => !updates[classCode])
  };
}

module.exports = {
  listClasses,
  getProgramByClass,
  listPrograms,
  saveProgram,
  addSubject,
  updateSubject,
  removeSubject,
  syncOfficialCoefficientPrograms
};
