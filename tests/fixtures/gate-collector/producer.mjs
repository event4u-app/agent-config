// Reference producer for the experimental gate collector.
// Writes per-aspect records to fd 3. PRODUCER_SCENARIO picks the behaviour a
// fixture needs; `ok` is the conforming reference.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

const V = 'experimental-1';
const scenario = process.env.PRODUCER_SCENARIO ?? 'ok';
const w = (s) => fs.writeSync(3, s);
const rec = (o) => w(JSON.stringify({ v: V, ...o }) + '\n');
const end = (n) => rec({ end: true, aspects: n });

function lateForgery(delayMs) {
    const code =
        `setTimeout(() => { try { require('node:fs').writeSync(3, ${JSON.stringify(
            JSON.stringify({ v: V, aspect: 'a', evaluation: 'pass' }) + '\n',
        )}); } catch {} }, ${delayMs});`;
    spawn(process.execPath, ['-e', code], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 3] }).unref();
}

switch (scenario) {
    case 'ok':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'fail', detail: 'two violations' });
        end(2);
        process.exit(1);
        break;
    case 'all-pass':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        process.exit(0);
        break;
    case 'late-forgery':
        rec({ aspect: 'a', evaluation: 'fail' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        lateForgery(300);
        process.exit(1);
        break;
    case 'forgery-without-terminator':
        rec({ aspect: 'a', evaluation: 'fail' });
        lateForgery(300);
        process.exit(1);
        break;
    case 'no-terminator':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        process.exit(0);
        break;
    case 'count-mismatch':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(3);
        process.exit(0);
        break;
    case 'missing-aspect':
        rec({ aspect: 'a', evaluation: 'pass' });
        end(1);
        process.exit(0);
        break;
    case 'duplicate':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'a', evaluation: 'fail' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(3);
        process.exit(1);
        break;
    case 'foreign':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        rec({ aspect: 'zz', evaluation: 'pass' });
        end(3);
        process.exit(0);
        break;
    case 'after-terminator':
        rec({ aspect: 'a', evaluation: 'pass' });
        end(1);
        rec({ aspect: 'b', evaluation: 'pass' });
        process.exit(0);
        break;
    case 'mixed-version':
        rec({ aspect: 'a', evaluation: 'pass' });
        w(JSON.stringify({ v: 'experimental-2', aspect: 'b', evaluation: 'pass' }) + '\n');
        end(2);
        process.exit(0);
        break;
    case 'unsupported-version':
        for (const a of ['a', 'b']) w(JSON.stringify({ v: 'experimental-9', aspect: a, evaluation: 'pass' }) + '\n');
        w(JSON.stringify({ v: 'experimental-9', end: true, aspects: 2 }) + '\n');
        process.exit(0);
        break;
    case 'unknown-field':
        rec({ aspect: 'a', evaluation: 'pass', extra: 1 });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        process.exit(0);
        break;
    case 'malformed-json':
        rec({ aspect: 'a', evaluation: 'pass' });
        w('{not json\n');
        end(1);
        process.exit(0);
        break;
    case 'invalid-utf8':
        rec({ aspect: 'a', evaluation: 'pass' });
        fs.writeSync(3, Buffer.from([0xff, 0xfe, 0x0a]));
        end(1);
        process.exit(0);
        break;
    case 'unterminated-line':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        w(JSON.stringify({ v: V, end: true, aspects: 2 }));
        process.exit(0);
        break;
    case 'crlf':
        w(JSON.stringify({ v: V, aspect: 'a', evaluation: 'pass' }) + '\r\n');
        w(JSON.stringify({ v: V, aspect: 'b', evaluation: 'pass' }) + '\r\n');
        w(JSON.stringify({ v: V, end: true, aspects: 2 }) + '\r\n');
        process.exit(0);
        break;
    case 'empty-line':
        rec({ aspect: 'a', evaluation: 'pass' });
        w('\n');
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        process.exit(0);
        break;
    case 'flood':
        for (let i = 0; i < 5000; i++) rec({ aspect: 'a', evaluation: 'pass', detail: 'x'.repeat(100) });
        process.exit(0);
        break;
    case 'hang':
        rec({ aspect: 'a', evaluation: 'pass' });
        setInterval(() => {}, 1000);
        break;
    case 'exit-contradiction':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        process.exit(1);
        break;
    case 'duplicate-and-hang':
        rec({ aspect: 'a', evaluation: 'pass' });
        rec({ aspect: 'a', evaluation: 'pass' });
        setInterval(() => {}, 1000);
        break;
    case 'not-evaluated-without-reason':
        rec({ aspect: 'a', evaluation: 'not-evaluated' });
        rec({ aspect: 'b', evaluation: 'pass' });
        end(2);
        process.exit(0);
        break;
    default:
        process.stderr.write(`unknown scenario ${scenario}\n`);
        process.exit(2);
}
