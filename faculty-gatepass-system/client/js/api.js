const API_HOST = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const API_BASE = `http://${API_HOST}:5000/api`;

function getToken() { return localStorage.getItem('gatepass_token'); }
function setSession(token, user) {
  localStorage.setItem('gatepass_token', token);
  localStorage.setItem('gatepass_user', JSON.stringify(user));
}
function getUser() {
  const raw = localStorage.getItem('gatepass_user');
  return raw ? JSON.parse(raw) : null;
}
function clearSession() {
  localStorage.removeItem('gatepass_token');
  localStorage.removeItem('gatepass_user');
}

/**
 * Core fetch wrapper. Adds the Authorization header automatically and
 * throws a plain Error with the server's message on any non-2xx response,
 * so callers can just `try { await api(...) } catch (e) { toast(e.message) }`.
 */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() itself threw -- the API process is unreachable (not running,
    // wrong port, or CORS rejected it before a response ever came back).
    // The browser's own message here ("Failed to fetch") tells you nothing
    // actionable, so replace it with something you can actually act on.
    throw new Error(
      `Can't reach the API at ${API_BASE}. Is the server running (npm start in /server)? ` +
      `If it's running on a different host/port, update API_BASE at the top of client/js/api.js. ` +
      `If the server IS running, check its terminal for a CORS error and add this page's origin ` +
      `(${window.location.origin}) to CLIENT_ORIGIN in server/.env, then restart the server.`
    );
  }

  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

function fileUrl(relativePath) {
  if (!relativePath) return null;
  // API base is http://localhost:5000/api -> static files are served from the root.
  return API_BASE.replace(/\/api$/, '') + '/' + relativePath;
}
