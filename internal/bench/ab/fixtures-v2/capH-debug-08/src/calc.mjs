// Tiny arithmetic expression evaluator over integers and the operators
// + - * / and ^ (exponentiation), with parentheses and unary minus.
//
// Semantics (standard math):
//   precedence, lowest to highest:  + -   <   * /   <   unary -   <   ^
//   '^' is RIGHT-associative:  2 ^ 3 ^ 2  ==  2 ^ (3 ^ 2)
//   unary minus binds LOOSER than '^':  -3 ^ 2  ==  -(3 ^ 2)
//
// `evaluate("2 + 3 * 4")` -> 14.

export function evaluate(src) {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  // expr := term (('+' | '-') term)*        (left-associative)
  function parseExpr() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  // term := unary (('*' | '/') unary)*      (left-associative)
  function parseTerm() {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const rhs = parseUnary();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  // unary := '-' unary | power
  function parseUnary() {
    if (peek() === '-') {
      next();
      return -parseUnary();
    }
    return parsePower();
  }

  // power := atom ('^' atom)*
  function parsePower() {
    let value = parseAtom();
    while (peek() === '^') {
      next();
      const rhs = parseAtom();
      value = value ** rhs;
    }
    return value;
  }

  // atom := number | '(' expr ')'
  function parseAtom() {
    if (peek() === '(') {
      next();
      const value = parseExpr();
      next(); // consume ')'
      return value;
    }
    return Number(next());
  }

  const result = parseExpr();
  return result;
}

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      out.push(ch);
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < src.length && src[i] >= '0' && src[i] <= '9') {
        num += src[i++];
      }
      out.push(num);
      continue;
    }
    throw new Error(`unexpected character: ${ch}`);
  }
  return out;
}
