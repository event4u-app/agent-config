// Parity fixture: same JSON data, different key order and whitespace.
process.stdout.write(`${JSON.stringify({ nested: { x: true }, beta: [1, 2], alpha: 1 })}\n`);
