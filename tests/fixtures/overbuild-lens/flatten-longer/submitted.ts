export function orderLabel(state: string, paid: boolean, shipped: boolean): string {
    return state === 'cancelled'
        ? 'Cancelled'
        : shipped
          ? paid
              ? 'Delivered'
              : 'Shipped — payment pending'
          : paid
            ? 'Paid — preparing'
            : 'Awaiting payment';
}
