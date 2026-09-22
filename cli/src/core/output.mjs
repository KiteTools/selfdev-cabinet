export function printResult(value, output = 'text') {
  if (output === 'json') {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if (typeof value === 'string') {
    process.stdout.write(`${value}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
}
