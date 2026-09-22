import { SignJWT, jwtVerify } from 'jose';
import { createHmac, createHash, timingSafeEqual } from 'crypto';

const JWT_TTL = '7d';
const COOKIE_NAME = 'lk_session';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(secret);
}

/**
 * Create a JWT token.
 * @param {{ user_id, telegram_user_id, sendpulse_contact_id }} payload
 * @returns {Promise<string>}
 */
export async function createToken(payload) {
  return new SignJWT({ transport: process.env.CABINET_TRANSPORT || 'local', ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(getJwtSecret());
}

/**
 * Verify and decode a JWT token.
 * @returns {Promise<Object>} payload
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload;
}

/**
 * Extract JWT from cookie and verify.
 * @returns {{ user_id, telegram_user_id, sendpulse_contact_id } | null}
 */
export async function authenticateRequest(event) {
  const cookieHeader = event.headers?.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  try {
    const payload = await verifyToken(match[1]);
    if (payload.transport !== (process.env.CABINET_TRANSPORT || 'local')) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractHeader(event, key) {
  const headers = event?.headers || {};
  return headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()] ?? '';
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function authenticateServiceRequest(
  event,
  { envKey = 'LK_SERVICE_SECRET', headerName = 'X-LK-Service-Secret' } = {}
) {
  const expectedSecret = String(process.env[envKey] || '').trim();
  if (!expectedSecret) {
    throw new Error(`${envKey} is not configured`);
  }

  const headerValue = String(extractHeader(event, headerName) || '').trim();
  const authHeader = String(extractHeader(event, 'Authorization') || '').trim();
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const providedSecret = headerValue || (bearerMatch ? bearerMatch[1].trim() : '');

  return Boolean(providedSecret) && safeEquals(providedSecret, expectedSecret);
}

/**
 * Build Set-Cookie header for JWT.
 */
export function buildSessionCookie(token) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Build clear cookie header (for logout).
 */
export function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function isFreshAuthDate(value) {
  const age = Math.floor(Date.now() / 1000) - Number(value);
  const maxAge = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 900);
  return Number.isInteger(Number(value)) && Number(value) > 0 && maxAge > 0 && age >= -30 && age <= maxAge;
}

/**
 * Validate Telegram WebApp initData.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @param {string} initData - raw initData string from Telegram WebApp
 * @param {string} botToken
 * @returns {{ valid: boolean, user: Object|null }}
 */
export function validateTelegramWebApp(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !isFreshAuthDate(params.get('auth_date')) || !botToken) return { valid: false, user: null };

    params.delete('hash');

    // Sort params and build data_check_string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // secret_key = HMAC-SHA-256("WebAppData", bot_token)
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();

    // computed_hash = HMAC-SHA-256(secret_key, data_check_string)
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (!safeEquals(computedHash, hash)) return { valid: false, user: null };

    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { valid: true, user };
  } catch {
    return { valid: false, user: null };
  }
}

/**
 * Validate Telegram Login Widget data.
 * @see https://core.telegram.org/widgets/login#checking-authorization
 * @param {Object} data - { id, first_name, last_name, username, photo_url, auth_date, hash }
 * @param {string} botToken
 * @returns {boolean}
 */
export function validateTelegramWidget(data, botToken) {
  try {
    const { hash, ...rest } = data;
    if (!hash || !botToken || !isFreshAuthDate(data.auth_date)) return false;

    const dataCheckString = Object.keys(rest)
      .sort()
      .map(k => `${k}=${rest[k]}`)
      .join('\n');

    const secretKey = createHash('sha256').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return safeEquals(computedHash, hash);
  } catch {
    return false;
  }
}

/**
 * Helper: return a JSON response.
 */
export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

/**
 * Helper: return a JSON response with Set-Cookie.
 */
export function jsonResponseWithCookie(statusCode, body, cookie) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
    body: JSON.stringify(body),
  };
}
