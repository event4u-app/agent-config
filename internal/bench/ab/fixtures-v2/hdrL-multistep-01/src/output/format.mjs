function textLine(r) {
  return `${String(r.time).padStart(6)} ${r.level.toUpperCase().padEnd(5)} ${r.msg}`;
}

export function render(result, format) {
  const shown = result.records.length;
  if (format === 'json') {
    return JSON.stringify({ meta: { shown, matched: result.matched }, records: result.records });
  }
  const body = result.records.map(textLine);
  body.push(`-- ${shown} of ${result.matched} records`);
  return body.join('\n');
}
