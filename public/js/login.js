import { postJSON } from './utils/api.js';
import { normalizeTypedBirthDate } from './utils/birthdate.js';
import { saveToken } from './utils/session.js';

const studentForm = document.getElementById('studentLoginForm');
const parentForm = document.getElementById('parentLoginForm');
const messageEl = document.getElementById('message');
const tabButtons = Array.from(document.querySelectorAll('[data-auth-mode]'));

let currentMode = 'student';

function setMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function renderMode(mode) {
  currentMode = mode;
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.authMode === mode);
  });

  studentForm.style.display = mode === 'student' ? 'grid' : 'none';
  parentForm.style.display = mode === 'parent' ? 'grid' : 'none';
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    renderMode(button.dataset.authMode || 'student');
  });
});

studentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(studentForm);
  const body = Object.fromEntries(formData.entries());
  body.dateNaissance = normalizeTypedBirthDate(body.dateNaissance);

  if (!body.dateNaissance) {
    setMessage('Entre la date au format JJ/MM/AAAA ou AAAA-MM-JJ.', 'error');
    return;
  }

  try {
    const response = await postJSON('/api/auth/login', body);
    saveToken(response.data.token);
    setMessage('Connexion eleve reussie. Redirection...', 'success');
    setTimeout(() => {
      window.location.href = '/pages/dashboard.html';
    }, 500);
  } catch (error) {
    setMessage(error.message || 'Identifiants eleve invalides.', 'error');
  }
});

parentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(parentForm);
  const body = Object.fromEntries(formData.entries());

  try {
    const response = await postJSON('/api/auth/login', body);
    saveToken(response.data.token);
    setMessage('Connexion parent reussie. Redirection...', 'success');
    setTimeout(() => {
      window.location.href = '/pages/dashboard.html';
    }, 500);
  } catch (error) {
    setMessage(error.message || 'Identifiants parent invalides.', 'error');
  }
});

renderMode(currentMode);
