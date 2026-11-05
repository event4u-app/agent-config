import { parseAmount } from '../core/money.mjs';

export function remainingCents(entry) {
  return parseAmount(entry.budget) - parseAmount(entry.spent);
}

export function overBudget(entry) {
  return parseAmount(entry.spent) > parseAmount(entry.budget);
}
