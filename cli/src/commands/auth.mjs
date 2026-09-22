export function createAuthCommands({ requestJson, env }) {
  return {
    inspect: {
      command: 'auth inspect',
      mutating: false,
      async run() {
        return {
          base_url: env.baseUrl,
          target: env.target,
          auth_mode: 'service-secret -> auth-cli -> jwt-cookie',
          has_service_secret: Boolean(env.serviceSecret),
          has_sp_contact_id: Boolean(env.spContactId),
          has_user_id: Boolean(env.userId),
        };
      },
    },
    me: {
      command: 'me',
      mutating: false,
      async run() {
        return requestJson({ path: '/api/me' });
      },
    },
  };
}
