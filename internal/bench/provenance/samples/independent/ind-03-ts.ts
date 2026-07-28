export function levenshtein(a: string, b: string): number {
    const memo = new Map<string, number>();

    function recurse(i: number, j: number): number {
        if (i === 0) {
            return j;
        }
        if (j === 0) {
            return i;
        }
        const key = `${i}:${j}`;
        const cached = memo.get(key);
        if (cached !== undefined) {
            return cached;
        }

        let result: number;
        if (a[i - 1] === b[j - 1]) {
            result = recurse(i - 1, j - 1);
        } else {
            result = 1 + Math.min(recurse(i - 1, j), recurse(i, j - 1), recurse(i - 1, j - 1));
        }
        memo.set(key, result);
        return result;
    }

    return recurse(a.length, b.length);
}
