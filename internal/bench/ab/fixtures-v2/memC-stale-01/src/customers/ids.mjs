// A customer id is "C-" followed by exactly five digits.
const CUSTOMER_ID = /^C-\d{5}$/;

export function isCustomerId(value) {
  return typeof value === 'string' && CUSTOMER_ID.test(value);
}
