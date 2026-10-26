export function displayPrice(product) {
    return Number(product.price).toFixed(2);
}

export function withTax(product, rate) {
    return Number(product.price) * (1 + rate);
}
