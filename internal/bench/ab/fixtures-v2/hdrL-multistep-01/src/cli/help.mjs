import { OPTIONS } from './options.mjs';

export function helpText() {
  const lines = ['usage: logq [options]', '', 'options:'];
  for (const [name, spec] of Object.entries(OPTIONS)) {
    const flag = spec.takesValue ? `--${name} ${spec.metavar}` : `--${name}`;
    lines.push(`  ${flag.padEnd(22)}${spec.help}`);
  }
  return lines.join('\n');
}
