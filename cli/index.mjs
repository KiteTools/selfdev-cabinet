import { readFile } from 'node:fs/promises';
import { parseCliArgs } from './src/core/args.mjs';
import { loadCliEnv } from './src/core/env.mjs';
import { createConsultationCommands } from './src/commands/consultation.mjs';
import { describeTarget, assertWriteAllowed } from './src/core/guards.mjs';
import { printError, printResult } from './src/core/output.mjs';
import { createAuthCommands } from './src/commands/auth.mjs';
import { createDiariesCommands } from './src/commands/diaries.mjs';
import { createLinksCommands } from './src/commands/links.mjs';
import { createRetroCommands } from './src/commands/retro.mjs';
import { createStateCommands } from './src/commands/state.mjs';
import { createVersionsCommands } from './src/commands/versions.mjs';
import { createHttpClient } from './src/http/client.mjs';
import { bootstrapCliSession } from './src/http/session.mjs';
import { runFullSmoke } from './src/smoke/full.mjs';

const HELP = [
  'Usage:',
  '  npm run cli -- auth inspect',
  '  npm run cli -- me',
  '  npm run cli -- state get',
  '',
].join('\n');

try {
  const env = loadCliEnv();
  env.target = describeTarget(env.baseUrl);
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.commandPath.length === 0) {
    printResult(HELP, env.output);
    process.exit(0);
  }

  const client = createHttpClient(env);

  const authCommands = createAuthCommands({ requestJson: client.requestJson, env });
  const stateCommands = createStateCommands({ requestJson: client.requestJson });
  const versionCommands = createVersionsCommands({ requestJson: client.requestJson });
  const diariesCommands = createDiariesCommands({ requestJson: client.requestJson });
  const linksCommands = createLinksCommands({ requestJson: client.requestJson });
  const retroCommands = createRetroCommands({ requestJson: client.requestJson });
  const consultationCommands = createConsultationCommands({
    requestJson: client.requestJson,
    requestMultipart: client.requestMultipart,
    readBinaryFile: readFile,
  });

  const registry = new Map([
    ['auth inspect', authCommands.inspect],
    ['me', authCommands.me],
    ['state get', stateCommands.get],
    ['state patch', stateCommands.patch],
    ['versions list', versionCommands.list],
    ['versions restore', versionCommands.restore],
    ['consultation summarize start', consultationCommands.summarizeStart],
    ['consultation summarize status', consultationCommands.summarizeStatus],
    ['consultation apply', consultationCommands.apply],
    ['diaries list', diariesCommands.list],
    ['diaries-summary start', diariesCommands.summaryStart],
    ['diaries-summary status', diariesCommands.summaryStatus],
    ['links list', linksCommands.list],
    ['retro start', retroCommands.start],
    ['retro status', retroCommands.status],
  ]);

  const commandKey = parsed.commandPath.join(' ');
  async function runNamedCommand(name, extraFlags = {}) {
    const next = registry.get(name);
    if (!next) {
      throw new Error(`Unknown command: ${name}`);
    }

    assertWriteAllowed(next, extraFlags);
    return next.run({
      flags: extraFlags,
      assertWrite(commandName) {
        if (!extraFlags.write) {
          throw new Error(`${commandName} requires --write`);
        }
      },
    });
  }

  if (commandKey === 'smoke full') {
    if (!parsed.flags.from || !parsed.flags.to) {
      throw new Error('smoke full requires --from YYYY-MM-DD --to YYYY-MM-DD');
    }

    await bootstrapCliSession({
      client,
      baseUrl: env.baseUrl,
      serviceSecret: env.serviceSecret,
      spContactId: env.spContactId,
      userId: env.userId,
    });

    const report = await runFullSmoke({
      flags: parsed.flags,
      runNamedCommand,
    });

    printResult(report, env.output);
    process.exit(report.failed === 0 ? 0 : 1);
  }

  const command = registry.get(commandKey);
  if (!command) {
    throw new Error(`Unknown command: ${commandKey}`);
  }

  assertWriteAllowed(command, parsed.flags);

  if (commandKey !== 'auth inspect') {
    await bootstrapCliSession({
      client,
      baseUrl: env.baseUrl,
      serviceSecret: env.serviceSecret,
      spContactId: env.spContactId,
      userId: env.userId,
    });
  }

  const result = await command.run({
    flags: parsed.flags,
    assertWrite(commandName) {
      if (!parsed.flags.write) {
        throw new Error(`${commandName} requires --write`);
      }
    },
  });

  printResult(result, env.output);
} catch (error) {
  printError(error);
  process.exit(1);
}
