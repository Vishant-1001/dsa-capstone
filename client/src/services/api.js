const BASE = '/api';
const TOKEN_KEY = 'rapidresq.token';

let token = null;
let onUnauthorized = null;

try {
  token = window.sessionStorage.getItem(TOKEN_KEY);
} catch (err) {
  token = null;
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function setToken(value) {
  token = value;
  try {
    if (value) window.sessionStorage.setItem(TOKEN_KEY, value);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    // storage unavailable, keep the token in memory only
  }
}

export const getToken = () => token;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    throw new ApiError('Cannot reach the server. Check that it is running.', 0, 'NETWORK');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok) {
    const e = data && data.error ? data.error : {};
    if (res.status === 401 && token && path !== '/auth/login' && onUnauthorized) onUnauthorized();
    throw new ApiError(e.message || `Request failed (${res.status})`, res.status, e.code, e.details);
  }
  return data;
}

async function download(path, filename) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch (err) {
    throw new ApiError('Cannot reach the server. Check that it is running.', 0, 'NETWORK');
  }
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = (await res.json()).error.message || message;
    } catch (err) {
      // keep the generic message
    }
    throw new ApiError(message, res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  download,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body === undefined ? {} : body),
  put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  del: (path) => request('DELETE', path),
};
