import { fetch_customer } from './repo.mjs';

export function getCustomerById(id) {
  return fetch_customer(id);
}
