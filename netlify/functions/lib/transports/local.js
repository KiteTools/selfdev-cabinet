/** No external reads or delivery. Database state remains owned by the application. */
export function createLocalTransport() {
  return {
    kind: 'local',
    async resolveContactForTelegram({ telegramUserId, requestedContactId }) {
      if (!/^[1-9]\d*$/.test(String(telegramUserId))) return null;
      const id = `local:${telegramUserId}`;
      return requestedContactId && requestedContactId !== id ? null : { id };
    },
    async getContact(id) { return /^local:[1-9]\d*$/.test(String(id)) ? { id } : null; },
    async getContactVariables() { return {}; },
    async setVariable() { return { transport: 'local', delivered: false, reason: 'delivery_disabled' }; },
    async syncVariables() { return { transport: 'local', delivered: false, reason: 'delivery_disabled' }; },
  };
}
