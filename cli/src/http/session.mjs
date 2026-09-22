function extractSessionCookie(setCookieValue) {
  const head = String(setCookieValue || '').split(';')[0].trim();

  if (!head.startsWith('lk_session=')) {
    throw new Error('auth-cli did not return lk_session cookie');
  }

  return head;
}

export async function bootstrapCliSession({
  client,
  baseUrl,
  serviceSecret,
  spContactId,
  userId,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${baseUrl}/api/auth-cli`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LK-Service-Secret': serviceSecret,
    },
    body: JSON.stringify({
      sp_contact_id: spContactId || '',
      user_id: userId || '',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `auth-cli failed with HTTP ${response.status}`);
  }

  const cookie = extractSessionCookie(response.headers.get('set-cookie'));
  client.setSessionCookie(cookie);

  return data;
}
