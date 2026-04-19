import { postJSON } from './utils/api.js';
import { normalizeTypedBirthDate, isOlderThan } from './utils/birthdate.js';
import { populateClassSelect } from './utils/class-options.js';

const form = document.getElementById('registerForm');
const messageEl = document.getElementById('message');

populateClassSelect('classe');

function setMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  body.dateNaissance = normalizeTypedBirthDate(body.dateNaissance);

  if (!body.dateNaissance) {
    setMessage('Entre la date au format JJ/MM/AAAA ou AAAA-MM-JJ.', 'error');
    return;
  }

  if (!isOlderThan(body.dateNaissance, 8)) {
    setMessage('L’élève doit avoir au moins 8 ans.', 'error');
    return;
  }

  try {
    await postJSON('/api/auth/register', body);
    setMessage('Inscription réussie. Redirection vers connexion...', 'success');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 800);
  } catch (error) {
    setMessage(error.message || 'Erreur lors de l’inscription.', 'error');
  }
});
