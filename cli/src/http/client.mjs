export function createHttpClient({
  baseUrl,
  output = 'text',
  timeoutMs = 30000,
  fetchImpl = fetch,
}) {
  let sessionCookie = '';

  function setSessionCookie(nextCookie) {
    sessionCookie = String(nextCookie || '').trim();
  }

  async function requestJson({ path, method = 'GET', json = null, extraHeaders = {} }) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (sessionCookie) {
      headers.cookie = sessionCookie;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: json ? JSON.stringify(json) : undefined,
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestMultipart({ path, method = 'POST', formData, extraHeaders = {} }) {
    const headers = { ...extraHeaders };

    if (sessionCookie) {
      headers.cookie = sessionCookie;
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
  }

  return {
    output,
    setSessionCookie,
    requestJson,
    requestMultipart,
  };
}
