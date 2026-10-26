export const COLUMNS = ['id', 'total', 'legacy_ref'];

export function cells(order) {
    return COLUMNS.map((c) => order[c]);
}
