// ============================================================
// Pulse Shared API Client
// Owned by Member C (Web foundation)
// Contract §5:
//   export const api = { get(path), post(path, body), put(path, body), patch(path, body), del(path) };
//   adds Bearer token from storage
//   base URL from VITE_API_URL (default http://localhost:5000/api)
//   resolves to parsed JSON; on non-2xx throws Error with .status, .code, .message
// ============================================================

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

function getToken() {
  try {
    return localStorage.getItem('pulse_token');
  } catch (err) {
    console.warn('Could not read pulse_token from localStorage', err);
    return null;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();

  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      data = text ? { message: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.code || null;
    error.message = errorMessage;
    throw error;
  }

  return data;
}

export const api = {
  get(path) {
    return request(path, { method: 'GET' });
  },
  post(path, body) {
    return request(path, { method: 'POST', body });
  },
  put(path, body) {
    return request(path, { method: 'PUT', body });
  },
  patch(path, body) {
    return request(path, { method: 'PATCH', body });
  },
  del(path) {
    return request(path, { method: 'DELETE' });
  },
};

export default api;
