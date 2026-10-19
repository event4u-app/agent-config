import { remainingQuota } from 'quota-engine';

export function renderRow(tenant) {
  return `${tenant.name}: ${remainingQuota(tenant.limit, tenant.used)} calls left`;
}
