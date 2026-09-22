export function describeTarget(baseUrl) {
  return /localhost|127\.0\.0\.1/.test(baseUrl) ? 'local' : 'production';
}

export function assertWriteAllowed(commandMeta, flags) {
  if (commandMeta.mutating && !flags.write) {
    throw new Error(`${commandMeta.command} requires --write`);
  }
}
