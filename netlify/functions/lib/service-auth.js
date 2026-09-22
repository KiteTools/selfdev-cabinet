import { createHash } from 'crypto';
import { authenticateServiceRequest, extractHeader } from './auth.js';
import { query } from './db.js';

const DEFAULT_RATE_LIMIT = 120;
const DEFAULT_RATE_WINDOW_MINUTES = 10;

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value, maxLength = 128) {
  return String(value || '').trim().slice(0, maxLength);
}

function isMissingAuditTable(error) {
  return error?.code === '42P01' || /service_request_audit/i.test(String(error?.message || ''));
}

function getClientIpHash(event) {
  const rawIp = [
    extractHeader(event, 'X-NF-Client-Connection-IP'),
    extractHeader(event, 'X-Forwarded-For'),
    extractHeader(event, 'X-Real-IP'),
    extractHeader(event, 'Client-IP'),
  ]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .find(Boolean);

  if (!rawIp) return '';
  return createHash('sha256').update(rawIp).digest('hex').slice(0, 24);
}

async function writeAuditRow({ scope, spContactId, remoteIpHash, outcome }) {
  try {
    await query(
      `INSERT INTO service_request_audit (
         scope, sp_contact_id, remote_ip_hash, outcome
       ) VALUES ($1, $2, $3, $4)`,
      [scope, spContactId || null, remoteIpHash || null, outcome]
    );
    return true;
  } catch (error) {
    if (isMissingAuditTable(error)) {
      return false;
    }
    console.error('service auth audit insert error:', error);
    return false;
  }
}

async function checkRateLimit({ scope, spContactId, remoteIpHash, maxRequests, windowMinutes }) {
  if (!spContactId && !remoteIpHash) {
    return { allowed: true, total: 0 };
  }

  try {
    const rows = await query(
      `SELECT COUNT(*)::int AS total
       FROM service_request_audit
       WHERE scope = $1
         AND outcome IN ('allowed', 'rate_limited')
         AND created_at >= now() - ($4::int * interval '1 minute')
         AND (
           ($2 <> '' AND sp_contact_id = $2)
           OR ($3 <> '' AND remote_ip_hash = $3)
         )`,
      [scope, spContactId, remoteIpHash, windowMinutes]
    );

    const total = Number(rows[0]?.total || 0);
    return {
      allowed: total < maxRequests,
      total,
    };
  } catch (error) {
    if (isMissingAuditTable(error)) {
      return { allowed: true, total: 0 };
    }
    console.error('service auth rate limit error:', error);
    return { allowed: true, total: 0 };
  }
}

export async function authorizeServiceRequest(
  event,
  {
    scope = 'service',
    spContactId = '',
    envKey = 'LK_SERVICE_SECRET',
    headerName = 'X-LK-Service-Secret',
    maxRequests = null,
    windowMinutes = null,
  } = {}
) {
  const normalizedScope = normalizeText(scope, 64) || 'service';
  const normalizedContactId = normalizeText(spContactId, 128);
  const remoteIpHash = getClientIpHash(event);

  let isAuthorized = false;
  try {
    isAuthorized = authenticateServiceRequest(event, { envKey, headerName });
  } catch (error) {
    console.error(`${normalizedScope} auth configuration error:`, error);
    return {
      ok: false,
      statusCode: 500,
      error: 'Service secret is not configured',
    };
  }

  if (!isAuthorized) {
    await writeAuditRow({
      scope: normalizedScope,
      spContactId: normalizedContactId,
      remoteIpHash,
      outcome: 'unauthorized',
    });
    return {
      ok: false,
      statusCode: 401,
      error: 'Unauthorized',
    };
  }

  const limit = normalizePositiveInt(process.env.LK_SERVICE_RATE_LIMIT, DEFAULT_RATE_LIMIT);
  const window = normalizePositiveInt(
    process.env.LK_SERVICE_RATE_WINDOW_MINUTES,
    DEFAULT_RATE_WINDOW_MINUTES
  );
  const effectiveLimit = normalizePositiveInt(maxRequests, limit);
  const effectiveWindow = normalizePositiveInt(windowMinutes, window);

  const rate = await checkRateLimit({
    scope: normalizedScope,
    spContactId: normalizedContactId,
    remoteIpHash,
    maxRequests: effectiveLimit,
    windowMinutes: effectiveWindow,
  });

  if (!rate.allowed) {
    await writeAuditRow({
      scope: normalizedScope,
      spContactId: normalizedContactId,
      remoteIpHash,
      outcome: 'rate_limited',
    });
    return {
      ok: false,
      statusCode: 429,
      error: `Rate limit exceeded (${effectiveLimit}/${effectiveWindow}m)`,
    };
  }

  await writeAuditRow({
    scope: normalizedScope,
    spContactId: normalizedContactId,
    remoteIpHash,
    outcome: 'allowed',
  });

  return {
    ok: true,
    rate,
  };
}
