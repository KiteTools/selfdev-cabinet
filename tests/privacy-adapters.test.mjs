import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendEmail, callOpenAiText } from '../netlify/functions/lib/summarizer.js';

test('generic SMTP sends no BCC unless explicitly configured', async () => {
  const keys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_BCC'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '587', SMTP_USER: 'synthetic-user', SMTP_PASS: 'synthetic-password', MAIL_FROM: 'sender@example.invalid' });
  delete process.env.MAIL_BCC;
  const original = nodemailer.createTransport;
  const sent = [];
  nodemailer.createTransport = config => {
    assert.equal(config.host, 'smtp.example.invalid');
    return { sendMail: async payload => sent.push(payload) };
  };
  try {
    await sendEmail({ to: 'recipient@example.invalid', subject: 'Synthetic', body: 'Synthetic text' });
    assert.equal(sent[0].bcc, undefined);
    assert.equal(sent[0].to, 'recipient@example.invalid');
    process.env.MAIL_BCC = 'archive@example.invalid';
    await sendEmail({ to: 'recipient@example.invalid', subject: 'Synthetic', body: 'Synthetic text' });
    assert.equal(sent[1].bcc, 'archive@example.invalid');
  } finally {
    nodemailer.createTransport = original;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});

test('AI transport defaults store=false and never echoes upstream response text on error', async () => {
  const previous = process.env.OPENAI_API_KEY, originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'synthetic-test-value';
  let request;
  globalThis.fetch = async (_, options) => {
    request = JSON.parse(options.body);
    return Response.json({ output_text: 'Synthetic response' });
  };
  try {
    assert.equal(await callOpenAiText({ instructions: 'Synthetic', input: 'Synthetic day' }), 'Synthetic response');
    assert.equal(request.store, false);
    globalThis.fetch = async () => new Response('PRIVATE INPUT MUST NOT BE ECHOED', { status: 500 });
    await assert.rejects(callOpenAiText({ instructions: 'Synthetic', input: 'Synthetic day' }), error => !error.message.includes('PRIVATE INPUT'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
  }
});
