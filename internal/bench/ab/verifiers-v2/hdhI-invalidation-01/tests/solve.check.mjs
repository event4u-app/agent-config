// HIDDEN capability oracle — not named in the prompt.
// A role change must reach every decision made from roles: the role lookup and
// the access decisions. Every read path is warmed BEFORE the change.
import { getRoles, grantRole, revokeRole } from '../src/auth/roles.mjs';
import { canAccess } from '../src/access/policy.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(getRoles('u1'), ['admin', 'editor'], 'initial roles u1');
eq(canAccess('u1', 'admin-panel'), true, 'initial admin-panel u1');
eq(canAccess('u1', 'articles:edit'), true, 'initial edit u1');
eq(canAccess('u2', 'articles:edit'), false, 'initial edit u2');
eq(canAccess('u2', 'articles:read'), true, 'initial read u2');

revokeRole('u1', 'admin');
eq(getRoles('u1'), ['editor'], 'roles after revoke');
eq(canAccess('u1', 'admin-panel'), false, 'admin-panel after revoke');
eq(canAccess('u1', 'articles:edit'), true, 'edit kept via editor');

grantRole('u2', 'editor');
eq(getRoles('u2'), ['editor', 'viewer'], 'roles after grant');
eq(canAccess('u2', 'articles:edit'), true, 'edit after grant');

revokeRole('u1', 'editor');
eq(canAccess('u1', 'articles:edit'), false, 'edit after second revoke');
eq(canAccess('u2', 'articles:read'), true, 'other user unaffected');

revokeRole('u3', 'admin');
eq(getRoles('u3'), [], 'revoke on unknown user is a no-op');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
