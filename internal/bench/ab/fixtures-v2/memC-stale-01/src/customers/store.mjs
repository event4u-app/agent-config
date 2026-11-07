const CUSTOMERS = [
  { id: 'C-00042', name: 'Northwind Garden' },
  { id: 'C-00107', name: 'Lindenhof Landscaping' },
  { id: 'C-01234', name: 'Blue Fern Studio' },
];

export function customerById(id) {
  return CUSTOMERS.find((customer) => customer.id === id) ?? null;
}
