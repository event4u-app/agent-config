// HIDDEN semantics check — not named in the prompt.
// '^' must be RIGHT-associative AND its right operand must accept a unary
// minus, while unary minus stays LOOSER than '^'. A fix that makes '^'
// right-associative but consumes only an atom (or recurses into power) on the
// right will fail the negative-exponent and/or unary cases below.
import { evaluate } from '../src/calc.mjs';

let failed = false;
function eq(expr, expected) {
  const got = evaluate(expr);
  if (got !== expected) {
    console.error(`FAIL ${expr}: expected ${expected}, got ${got}`);
    failed = true;
  }
}

// right-associativity (the reported symptom)
eq('2 ^ 3 ^ 2', 512); // 2 ^ (3 ^ 2) = 2 ^ 9
eq('4 ^ 3 ^ 0', 4); // 4 ^ (3 ^ 0) = 4 ^ 1

// unary minus is looser than '^' (must survive the fix)
eq('-3 ^ 2', -9); // -(3 ^ 2)
eq('-2 ^ 2 ^ 1', -4); // -((2 ^ 2) ... ) -> -(2 ^ (2 ^ 1)) = -(2^2) = -4

// negative exponent: the right operand of '^' must accept a unary minus
eq('2 ^ -3', 0.125); // 2 ^ (-3)
eq('2 ^ -2 ^ 2', 0.0625); // 2 ^ (-(2 ^ 2)) = 2 ^ -4

// untouched-precedence regressions
eq('2 + 3 * 4', 14);
eq('(2 + 3) * 4', 20);
eq('2 * 3 ^ 2', 18); // 2 * (3 ^ 2)
eq('10 - 2 - 3', 5); // left-assoc subtraction

if (failed) {
  process.exit(1);
}
console.log('ok');
