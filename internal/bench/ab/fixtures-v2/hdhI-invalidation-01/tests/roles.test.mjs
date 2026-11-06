import { getRoles, revokeRole } from '../src/auth/roles.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(getRoles('u1'), ['admin', 'editor'], 'initial roles');
revokeRole('u1', 'admin');
eq(getRoles('u1'), ['editor'], 'roles after revoke');

if (failed) process.exit(1);
console.log('role tests passed');
