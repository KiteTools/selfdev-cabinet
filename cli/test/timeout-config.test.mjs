import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const summarizerSource = readFileSync(
  new URL('../../netlify/functions/lib/summarizer.js', import.meta.url),
  'utf8'
);
const appSource = readFileSync(
  new URL('../../assets/app.js', import.meta.url),
  'utf8'
);

function readNumericConst(source, name) {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));
  assert.ok(match, `Could not find ${name}`);
  return Number(match[1]);
}

test('OpenAI timeout defaults are configured for 10 minutes', () => {
  const maxRequestMs = readNumericConst(summarizerSource, 'MAX_OPENAI_REQUEST_MS');
  assert.equal(maxRequestMs, 600000);

  const configuredDefault = summarizerSource.match(
    /const configuredTimeoutMs = timeoutMsRaw \? Number\(timeoutMsRaw\) : (\d+);/
  );
  assert.ok(configuredDefault, 'Could not find configuredTimeoutMs default');
  assert.equal(Number(configuredDefault[1]), 600000);

  const fallbackDefault = summarizerSource.match(
    /const timeoutMs =[\s\S]*?\? Math\.min\(configuredTimeoutMs, MAX_OPENAI_REQUEST_MS\)\s*:\s*(\d+);/
  );
  assert.ok(fallbackDefault, 'Could not find timeoutMs fallback default');
  assert.equal(Number(fallbackDefault[1]), 600000);
});

test('client polling windows allow at least 10 minutes for long-running jobs', () => {
  const consultationWindowMs =
    readNumericConst(appSource, 'CONSULTATION_POLL_MS') *
    readNumericConst(appSource, 'CONSULTATION_MAX_ATTEMPTS');
  const diaryWindowMs =
    readNumericConst(appSource, 'DIARY_SUMMARY_POLL_MS') *
    readNumericConst(appSource, 'DIARY_SUMMARY_MAX_ATTEMPTS');
  const retroWindowMs =
    readNumericConst(appSource, 'RETRO_POLL_MS') *
    readNumericConst(appSource, 'RETRO_MAX_ATTEMPTS');

  assert.ok(consultationWindowMs >= 600000, `consultation window is ${consultationWindowMs}ms`);
  assert.ok(diaryWindowMs >= 600000, `diary window is ${diaryWindowMs}ms`);
  assert.ok(retroWindowMs >= 600000, `retro window is ${retroWindowMs}ms`);
});
