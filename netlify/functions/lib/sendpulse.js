// Legacy server import compatibility. Application code uses transport.js.
import { createSendPulseTransport } from './transports/sendpulse.js';
export const getAccessToken = (...args) => createSendPulseTransport().getAccessToken(...args);
export const getContact = (...args) => createSendPulseTransport().getContact(...args);
export const getContactVariables = (...args) => createSendPulseTransport().getContactVariables(...args);
export const setVariable = (...args) => createSendPulseTransport().setVariable(...args);
export const syncVariables = (...args) => createSendPulseTransport().syncVariables(...args);
