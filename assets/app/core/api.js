export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`/api/${path}`, {
    credentials: 'same-origin',
    headers,
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  let data = null;
  let rawText = '';

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {}
  } else {
    try {
      rawText = await res.text();
      if (rawText) {
        data = JSON.parse(rawText);
      }
    } catch {}
  }

  if (!res.ok) {
    const err = new Error(data?.error || rawText || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data || {};
}
