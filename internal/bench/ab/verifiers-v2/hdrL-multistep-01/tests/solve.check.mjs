// HIDDEN end-to-end check for --limit: parse -> validate -> query -> render,
// including the README output contract (matched is pre-limit; 0 = no cap).
import { run } from '../src/main.mjs';

const RECORDS = [
  { time: 5, level: 'info', msg: 'e' },
  { time: 1, level: 'debug', msg: 'a' },
  { time: 3, level: 'error', msg: 'c' },
  { time: 2, level: 'warn', msg: 'b' },
  { time: 4, level: 'warn', msg: 'd' },
  { time: 6, level: 'error', msg: 'f' },
];

let failed = false;
function check(label, cond, detail = '') {
  if (!cond) {
    console.error(`FAIL ${label} ${detail}`);
    failed = true;
  }
}
const lines = (out) => out.split('\n').filter((l) => !l.startsWith('--'));
const footer = (out) => out.split('\n').find((l) => l.startsWith('-- ')) ?? '';
function json(argv) {
  const r = run(argv, RECORDS.map((x) => ({ ...x })));
  try {
    return JSON.parse(r.stdout);
  } catch {
    return { meta: {}, records: [] };
  }
}

// text, both argv spellings; cap applies after filter + sort
for (const argv of [['--limit', '2'], ['--limit=2']]) {
  const r = run([...argv, '--level', 'warn'], RECORDS.map((x) => ({ ...x })));
  check(`${argv} exit`, r.code === 0, r.stderr);
  const ls = lines(r.stdout);
  check(`${argv} count`, ls.length === 2, JSON.stringify(ls));
  check(`${argv} order`, /\bb$/.test(ls[0] ?? '') && /\bc$/.test(ls[1] ?? ''), JSON.stringify(ls));
  check(`${argv} footer`, footer(r.stdout) === '-- 2 of 4 records', footer(r.stdout));
}

// sort before cap
let j = json(['--sort', 'level', '--limit', '1', '--format', 'json']);
check('sort-then-cap', j.records.length === 1 && j.records[0].msg === 'c', JSON.stringify(j.records));

// json meta: matched is the pre-limit count
j = json(['--format', 'json', '--limit', '3']);
check('json shown', j.meta.shown === 3, JSON.stringify(j.meta));
check('json matched', j.meta.matched === 6, JSON.stringify(j.meta));
check('json records', j.records.length === 3 && j.records.map((x) => x.msg).join('') === 'abc', JSON.stringify(j.records));

// limit larger than the result set
j = json(['--format', 'json', '--limit', '50']);
check('over-cap', j.records.length === 6 && j.meta.shown === 6 && j.meta.matched === 6, JSON.stringify(j.meta));

// 0 means no cap (README contract)
j = json(['--format', 'json', '--limit', '0']);
check('zero = no cap', j.records.length === 6 && j.meta.shown === 6 && j.meta.matched === 6, JSON.stringify(j.meta));
let r = run(['--limit', '0'], RECORDS.map((x) => ({ ...x })));
check('zero text footer', footer(r.stdout) === '-- 6 of 6 records', footer(r.stdout));

// no --limit: unchanged behaviour
r = run([], RECORDS.map((x) => ({ ...x })));
check('default', lines(r.stdout).length === 6 && footer(r.stdout) === '-- 6 of 6 records', r.stdout);

// validation: usage error (exit 2) naming the option, like the other options
for (const bad of ['-1', 'abc', '1.5', '']) {
  const rr = run(['--limit', bad], RECORDS);
  check(`invalid ${JSON.stringify(bad)}`, rr.code === 2 && /--limit/.test(rr.stderr), JSON.stringify(rr));
}
r = run(['--limit'], RECORDS);
check('missing value', r.code === 2 && /--limit/.test(r.stderr), JSON.stringify(r));

// help lists the option
r = run(['--help'], RECORDS);
check('help', /--limit\b/.test(r.stdout), r.stdout);

if (failed) process.exit(1);
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
