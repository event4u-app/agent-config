export const COLUMNS = ['id', 'total'];

export function cells(order) {
    return COLUMNS.map((c) => order[c]);
}
