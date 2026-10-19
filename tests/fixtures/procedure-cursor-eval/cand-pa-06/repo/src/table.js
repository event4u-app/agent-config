import fs from 'node:fs';
import pc from 'picocolors';

export function printTable(harbour) {
  const rows = fs.readFileSync(new URL(`../data/${harbour}.csv`, import.meta.url), 'utf-8').trim().split('\n');
  for (const row of rows) {
    const [time, height] = row.split(',');
    console.log(`${pc.cyan(time)}  ${height} m`);
  }
}
