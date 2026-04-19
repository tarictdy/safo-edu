import { deleteJSON, getJSON, postJSON, putJSON } from './utils/api.js';
import { clearToken } from './utils/session.js';
import { setupPageTransition } from './utils/page-transition.js';

const state = {
  programs: [],
  selectedClassCode: '',
  editingSubjectCode: ''
};

const classSelect = document.getElementById('classSelect');
const programLabel = document.getElementById('programLabel');
const programCycle = document.getElementById('programCycle');
const programOrder = document.getElementById('programOrder');
const totalCoefficient = document.getElementById('totalCoefficient');
const saveProgramBtn = document.getElementById('saveProgramBtn');
const syncOfficialBtn = document.getElementById('syncOfficialBtn');
const resetSubjectFormBtn = document.getElementById('resetSubjectFormBtn');
const subjectsBody = document.getElementById('subjectsBody');
const programSummary = document.getElementById('programSummary');
const statusBox = document.getElementById('statusBox');
const officialInfo = document.getElementById('officialInfo');

const subjectForm = document.getElementById('subjectForm');
const subjectCode = document.getElementById('subjectCode');
const subjectName = document.getElementById('subjectName');
const subjectCoefficient = document.getElementById('subjectCoefficient');
const subjectIsCore = document.getElementById('subjectIsCore');
const subjectAliases = document.getElementById('subjectAliases');
const subjectSubmitBtn = document.getElementById('subjectSubmitBtn');

function setStatus(message, type = 'info') {
  statusBox.style.display = 'block';
  statusBox.className = `status-box status-${type}`;
  statusBox.textContent = message;
}

function redirectToLogin() {
  clearToken();
  setStatus('Session invalide. Redirection vers connexion...', 'error');
  setTimeout(() => {
    window.location.href = '/pages/login.html';
  }, 700);
}

function handleApiError(error, fallback) {
  if (error?.status === 401 || error?.status === 403) {
    redirectToLogin();
    return;
  }
  setStatus(error?.message || fallback, 'error');
}

function currentProgram() {
  return state.programs.find((program) => program.classCode === state.selectedClassCode) || null;
}

function renderClassSelect() {
  classSelect.innerHTML = state.programs
    .map((program) => `<option value="${program.classCode}" ${program.classCode === state.selectedClassCode ? 'selected' : ''}>${program.label}</option>`)
    .join('');
}

function renderProgramMeta(program) {
  if (!program) return;

  programLabel.value = program.label || program.classCode;
  programCycle.value = program.cycle || 'college';
  programOrder.value = Number(program.order || 999);
  totalCoefficient.value = program.totalCoefficient ?? '';

  const computedTotal = (program.subjects || []).reduce((sum, subject) => sum + Number(subject.coefficient || 0), 0);
  programSummary.textContent = `${program.label} - total calcule: ${computedTotal} / total officiel: ${program.totalCoefficient ?? 'non defini'}`;
}

function renderSubjects(program) {
  if (!program || !program.subjects?.length) {
    subjectsBody.innerHTML = '<tr><td colspan="6">Aucune matiere dans cette classe.</td></tr>';
    return;
  }

  subjectsBody.innerHTML = program.subjects.map((subject) => `
    <tr>
      <td>${subject.subjectCode}</td>
      <td>${subject.name}</td>
      <td><span class="coefficient-pill">${subject.coefficient}</span></td>
      <td><span class="core-pill ${subject.isCore ? '' : 'off'}">${subject.isCore ? 'Oui' : 'Non'}</span></td>
      <td>${subject.family || '-'}</td>
      <td>
        <div class="subject-action-row">
          <button class="subject-mini-btn" type="button" data-edit-subject="${subject.subjectCode}">Modifier</button>
          <button class="subject-mini-btn red" type="button" data-delete-subject="${subject.subjectCode}">Supprimer</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderOfficialInfo(program) {
  if (!program?.officialSource) {
    officialInfo.innerHTML = '<div class="notice-item"><span class="notice-dot dot-blue"></span><div class="notice-text">Cette classe n a pas encore de source officielle renseignee.</div><div class="notice-time">Info</div></div>';
    return;
  }

  officialInfo.innerHTML = `
    <div class="notice-item">
      <span class="notice-dot dot-ok"></span>
      <div class="notice-text">${program.officialSource.document}</div>
      <div class="notice-time">${program.officialSource.schoolYear}</div>
    </div>
    <div class="notice-item">
      <span class="notice-dot dot-blue"></span>
      <div class="notice-text">${program.officialSource.title}</div>
      <div class="notice-time">Source</div>
    </div>
  `;
}

function renderCurrentProgram() {
  const program = currentProgram();
  renderProgramMeta(program);
  renderSubjects(program);
  renderOfficialInfo(program);
}

function resetSubjectForm() {
  state.editingSubjectCode = '';
  subjectCode.disabled = false;
  subjectCode.value = '';
  subjectName.value = '';
  subjectCoefficient.value = '1';
  subjectIsCore.value = 'false';
  subjectAliases.value = '';
  subjectSubmitBtn.textContent = 'Ajouter la matiere';
}

function fillSubjectForm(subject) {
  state.editingSubjectCode = subject.subjectCode;
  subjectCode.disabled = true;
  subjectCode.value = subject.subjectCode;
  subjectName.value = subject.name;
  subjectCoefficient.value = subject.coefficient;
  subjectIsCore.value = subject.isCore ? 'true' : 'false';
  subjectAliases.value = (subject.aliases || []).join(', ');
  subjectSubmitBtn.textContent = 'Modifier la matiere';
}

function collectSubjectPayload() {
  return {
    subjectCode: subjectCode.value,
    name: subjectName.value,
    coefficient: Number(subjectCoefficient.value || 0),
    isCore: subjectIsCore.value === 'true',
    aliases: subjectAliases.value
  };
}

async function loadPrograms(selectedClassCode = state.selectedClassCode) {
  const { data } = await getJSON('/api/academics/programs');
  state.programs = Array.isArray(data) ? data : [];
  state.selectedClassCode = selectedClassCode || state.programs[0]?.classCode || '';
  renderClassSelect();
  renderCurrentProgram();
}

async function saveCurrentProgram() {
  const program = currentProgram();
  if (!program) return;

  await putJSON(`/api/academics/classes/${encodeURIComponent(program.classCode)}/program`, {
    label: programLabel.value,
    cycle: programCycle.value,
    order: Number(programOrder.value || 999),
    totalCoefficient: totalCoefficient.value === '' ? undefined : Number(totalCoefficient.value),
    subjects: program.subjects
  });

  await loadPrograms(program.classCode);
  setStatus('Classe enregistree dans academic_programs.', 'success');
}

async function saveSubject(event) {
  event.preventDefault();
  const classCode = state.selectedClassCode;
  if (!classCode) return;

  const payload = collectSubjectPayload();
  if (state.editingSubjectCode) {
    await putJSON(
      `/api/academics/classes/${encodeURIComponent(classCode)}/subjects/${encodeURIComponent(state.editingSubjectCode)}`,
      payload
    );
    setStatus('Matiere modifiee.', 'success');
  } else {
    await postJSON(`/api/academics/classes/${encodeURIComponent(classCode)}/subjects`, payload);
    setStatus('Matiere ajoutee.', 'success');
  }

  resetSubjectForm();
  await loadPrograms(classCode);
}

async function deleteSubject(subjectCodeValue) {
  const classCode = state.selectedClassCode;
  if (!classCode) return;

  const confirmed = window.confirm('Supprimer cette matiere de la classe selectionnee ? La classe sera conservee.');
  if (!confirmed) return;

  await deleteJSON(`/api/academics/classes/${encodeURIComponent(classCode)}/subjects/${encodeURIComponent(subjectCodeValue)}`);
  resetSubjectForm();
  await loadPrograms(classCode);
  setStatus('Matiere supprimee. La classe est conservee.', 'success');
}

async function syncOfficial() {
  const confirmed = window.confirm('Appliquer les coefficients officiels de la circulaire n 270 ? Les classes non presentes dans le PDF seront conservees.');
  if (!confirmed) return;

  const { data } = await postJSON('/api/academics/programs/sync-official-coefficients', {});
  await loadPrograms(state.selectedClassCode);
  setStatus(`${data.updatedCount} classes corrigees. Classes conservees: ${data.preservedClasses.length}.`, 'success');
}

classSelect.addEventListener('change', () => {
  state.selectedClassCode = classSelect.value;
  resetSubjectForm();
  renderCurrentProgram();
});

saveProgramBtn.addEventListener('click', () => {
  saveCurrentProgram().catch((error) => handleApiError(error, 'Impossible d enregistrer la classe.'));
});

syncOfficialBtn.addEventListener('click', () => {
  syncOfficial().catch((error) => handleApiError(error, 'Impossible d appliquer les coefficients officiels.'));
});

resetSubjectFormBtn.addEventListener('click', resetSubjectForm);

subjectForm.addEventListener('submit', (event) => {
  saveSubject(event).catch((error) => handleApiError(error, 'Impossible d enregistrer la matiere.'));
});

subjectsBody.addEventListener('click', (event) => {
  const button = event.target?.closest('button');
  if (!button) return;

  const program = currentProgram();
  const editSubjectCode = button.dataset.editSubject;
  const deleteSubjectCode = button.dataset.deleteSubject;

  if (editSubjectCode) {
    const subject = (program?.subjects || []).find((item) => item.subjectCode === editSubjectCode);
    if (subject) fillSubjectForm(subject);
  }

  if (deleteSubjectCode) {
    deleteSubject(deleteSubjectCode).catch((error) => handleApiError(error, 'Impossible de supprimer la matiere.'));
  }
});

setupPageTransition();
loadPrograms()
  .then(() => setStatus('Programmes charges.', 'success'))
  .catch((error) => handleApiError(error, 'Impossible de charger les programmes academiques.'));
