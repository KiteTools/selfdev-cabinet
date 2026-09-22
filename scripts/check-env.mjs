import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function checkEnvironment(env = process.env) {
  const errors = [], warnings = [];
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'JWT_SECRET'];
  if (!(env.DATABASE_URL || env.NETLIFY_DATABASE_URL)) errors.push('DATABASE_URL or NETLIFY_DATABASE_URL is required');
  else {
    try { if (!/^postgres(?:ql)?:$/.test(new URL(env.DATABASE_URL || env.NETLIFY_DATABASE_URL).protocol)) throw new Error(); }
    catch { errors.push('Database URL must be a valid PostgreSQL URL for a Neon-compatible database'); }
  }
  const mode = env.CABINET_TRANSPORT || 'local';
  if (!['local', 'sendpulse'].includes(mode)) errors.push('CABINET_TRANSPORT must be local or sendpulse');
  if (mode === 'sendpulse') required.push('SENDPULSE_CLIENT_ID', 'SENDPULSE_CLIENT_SECRET', 'SENDPULSE_BOT_ID');
  for (const name of required) if (!env[name]) errors.push(`${name} is required`);
  if (env.JWT_SECRET && env.JWT_SECRET.length < 32) errors.push('JWT_SECRET must contain at least 32 characters');
  const maxAge = Number(env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 900);
  if (!Number.isInteger(maxAge) || maxAge <= 0) errors.push('TELEGRAM_AUTH_MAX_AGE_SECONDS must be a positive integer');
  try { new Intl.DateTimeFormat('en', { timeZone: env.BOT_TIMEZONE || 'UTC' }); } catch { errors.push('BOT_TIMEZONE must be an IANA timezone'); }
  if (!env.OPENAI_API_KEY) warnings.push('AI summaries and posters are unavailable without OPENAI_API_KEY');
  if (mode === 'local') warnings.push('Local mode saves in the database only; bot delivery is disabled');
  if (!env.LK_SERVICE_SECRET) warnings.push('Service ingestion endpoints are unavailable without LK_SERVICE_SECRET');
  const smtp = ['HOST', 'USER', 'PASS'].map(key => env[`SMTP_${key}`] || env[`SENDPULSE_SMTP_${key}`]);
  if (smtp.some(Boolean) && (!smtp.every(Boolean) || !env.MAIL_FROM)) errors.push('SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM must be configured together');
  if (!smtp.some(Boolean)) warnings.push('Email is unavailable without SMTP configuration');
  if (env.MAIL_BCC) warnings.push('MAIL_BCC is enabled: every application email is copied to the configured recipient');
  return { errors, warnings };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkEnvironment();
  for (const line of result.errors) console.error(`ERROR: ${line}`);
  for (const line of result.warnings) console.log(`NOTE: ${line}`);
  console.log('Static configuration check only; accounts, ownership, database connectivity and delivery were not tested.');
  process.exitCode = result.errors.length ? 1 : 0;
}
