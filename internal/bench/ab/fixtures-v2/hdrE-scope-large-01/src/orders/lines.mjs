export function lineTotal(line) {
  return line.unitCents * line.qty;
}

export function sumLines(lines) {
  return lines.reduce((acc, l) => acc + lineTotal(l), 0);
}
