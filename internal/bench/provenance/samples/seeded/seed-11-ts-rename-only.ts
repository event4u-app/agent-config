// Minimum single-character edit count to turn s1 into s2.
export function editDistance(s1: string, s2: string): number {
    const nRows = s1.length + 1;
    const nCols = s2.length + 1;
    const tbl: number[][] = Array.from({ length: nRows }, () => new Array(nCols).fill(0));

    for (let x = 0; x < nRows; x++) {
        tbl[x][0] = x;
    }
    for (let y = 0; y < nCols; y++) {
        tbl[0][y] = y;
    }

    for (let x = 1; x < nRows; x++) {
        for (let y = 1; y < nCols; y++) {
            if (s1[x - 1] === s2[y - 1]) {
                tbl[x][y] = tbl[x - 1][y - 1];
            } else {
                tbl[x][y] = 1 + Math.min(tbl[x - 1][y], tbl[x][y - 1], tbl[x - 1][y - 1]);
            }
        }
    }

    return tbl[nRows - 1][nCols - 1];
}
