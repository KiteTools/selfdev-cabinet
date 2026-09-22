import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveTruncationLimit,
  safeErrorMessage,
} from '../netlify/functions/lib/summarizer.js';

test('resolveTruncationLimit clamps oversized transcript limits to a safe ceiling', () => {
  assert.equal(resolveTruncationLimit('50000', 12000, 12000), 12000);
  assert.equal(resolveTruncationLimit('8000', 12000, 12000), 8000);
  assert.equal(resolveTruncationLimit('', 12000, 12000), 12000);
  assert.equal(resolveTruncationLimit('NaN', 8000, 8000), 8000);
  assert.equal(resolveTruncationLimit('-10', 8000, 8000), 8000);
});

test('safeErrorMessage distinguishes invalid OpenAI credentials from generic API failures', () => {
  const invalidKey = safeErrorMessage(new Error('OpenAI error: 401 - {"error":{"code":"invalid_api_key","message":"Incorrect API key provided"}}'));
  const generic = safeErrorMessage(new Error('OpenAI error: 400 - {"error":{"code":"bad_request"}}'));

  assert.equal(invalidKey, 'На сервере задан неверный или истёкший OPENAI_API_KEY.');
  assert.equal(generic, 'Ошибка запроса к OpenAI.');
});
