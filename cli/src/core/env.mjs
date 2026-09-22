export function loadCliEnv(env = process.env) {
  return {
    baseUrl: String(env.LK_BASE_URL || 'http://localhost:8888').replace(/\/+$/, ''),
    serviceSecret: String(env.LK_SERVICE_SECRET || ''),
    spContactId: String(env.LK_CLI_SP_CONTACT_ID || '').trim(),
    userId: String(env.LK_CLI_USER_ID || '').trim(),
    output: String(env.LK_CLI_OUTPUT || 'text').trim() || 'text',
    timeoutMs: Number(env.LK_CLI_TIMEOUT_MS || 30000),
  };
}
