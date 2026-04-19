import { getToken } from './session.js';

const defaultOptions = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
};

async function request(url, options = {}) {
  const token = getToken();
  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || 'Erreur serveur');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function postJSON(url, body) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function putJSON(url, body) {
  return request(url, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function deleteJSON(url) {
  return request(url, { method: 'DELETE' });
}

export function getJSON(url) {
  return request(url, { method: 'GET' });
}
