export function displayPrice(product) {
    return (product.price_cents / 100).toFixed(2);
}

export function withTax(product, rate) {
    return (product.price_cents / 100) * (1 + rate);
}
