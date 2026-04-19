import { postJSON } from './utils/api.js';

const form = document.getElementById('parentRegisterForm');
const messageEl = document.getElementById('message');

function setMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());

  try {
    const response = await postJSON('/api/auth/register/parent', body);
    const hasRequests = (response.data?.requestedStudentMatricules || []).length > 0;
    setMessage(
      hasRequests
        ? 'Compte parent cree. Une demande de confirmation a ete envoyee aux comptes eleves.'
        : 'Compte parent cree. Tu pourras lier un eleve plus tard depuis le dashboard parent.',
      'success'
    );
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 1100);
  } catch (error) {
    setMessage(error.message || 'Erreur lors de l inscription parent.', 'error');
  }
});
