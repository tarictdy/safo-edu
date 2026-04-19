const TOKEN_KEY = 'safio_token';

export function saveToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
