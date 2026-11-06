import { getRoles } from '../auth/roles.mjs';

const RULES = {
  'admin-panel': ['admin'],
  'articles:edit': ['admin', 'editor'],
  'articles:read': ['admin', 'editor', 'viewer'],
};

// Access decisions are evaluated on every render of every widget; a user's
// decision for a resource is stable for the lifetime of their session.
const decisions = new Map();

export function canAccess(userId, resource) {
  const key = `${userId}|${resource}`;
  if (decisions.has(key)) return decisions.get(key);
  const allowed = (RULES[resource] ?? []).some((r) => getRoles(userId).includes(r));
  decisions.set(key, allowed);
  return allowed;
}
