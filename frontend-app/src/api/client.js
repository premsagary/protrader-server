// Thin fetch wrapper — attaches Bearer token, returns JSON.
// On 401 with a saved token: clear and reload. No reload if no token (prevents loops).
function getToken() {
  return localStorage.getItem('pt_token');
}

export async function apiGet(path) {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && token) {
    localStorage.removeItem('pt_token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const token = getToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  if (res.status === 401 && token) {
    localStorage.removeItem('pt_token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPatch(path, body) {
  const token = getToken();
  const res = await fetch(path, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  if (res.status === 401 && token) {
    localStorage.removeItem('pt_token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
