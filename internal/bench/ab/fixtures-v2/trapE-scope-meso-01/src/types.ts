// Shared types for the billing app. No calcTax call here — purely
// structural. Not a change target.

export interface LineItem {
  label: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PricedLineItem {
  label: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface Invoice {
  lines: PricedLineItem[];
  shippingCents: number;
  shippingTaxCents: number;
  grandTotalCents: number;
}
