import { createLocalTransport } from './transports/local.js';
import { createSendPulseTransport } from './transports/sendpulse.js';

// Domain code calls this contract; vendor credentials never reach the browser.
export function createTransport(options = {}) {
  const kind = (options.env || process.env).CABINET_TRANSPORT || 'local';
  if (kind === 'local') return createLocalTransport();
  if (kind === 'sendpulse') return createSendPulseTransport(options);
  throw new Error(`Unsupported CABINET_TRANSPORT: ${kind}`);
}
export const getTransport = () => createTransport();
export const getContact = (...args) => getTransport().getContact(...args);
export const getContactVariables = (...args) => getTransport().getContactVariables(...args);
export const setVariable = (...args) => getTransport().setVariable(...args);
export const syncVariables = (...args) => getTransport().syncVariables(...args);
