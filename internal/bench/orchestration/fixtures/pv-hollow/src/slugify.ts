// Clean, real, self-contained — the negative control. A real implementation
// with no mock/stub/TODO on the shipped path; a correct reviewer says READY.
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
