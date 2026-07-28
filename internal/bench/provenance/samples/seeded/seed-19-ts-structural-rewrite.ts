export function levenshteinDistance(source: string, target: string): number {
    if (source === target) {
        return 0;
    }
    if (source.length === 0) {
        return target.length;
    }
    if (target.length === 0) {
        return source.length;
    }

    let previousRow = Array.from({ length: target.length + 1 }, (_, idx) => idx);

    for (let i = 1; i <= source.length; i++) {
        const currentRow = [i];
        for (let j = 1; j <= target.length; j++) {
            const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
            currentRow.push(
                Math.min(currentRow[j - 1] + 1, previousRow[j] + 1, previousRow[j - 1] + substitutionCost),
            );
        }
        previousRow = currentRow;
    }

    return previousRow[target.length];
}
