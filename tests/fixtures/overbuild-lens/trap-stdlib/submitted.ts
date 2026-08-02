const HEX = '0123456789abcdef';

/** RFC 4122 v4 identifier. */
export function generateRequestId(): string {
    let out = '';
    for (let i = 0; i < 36; i += 1) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            out += '-';
        } else if (i === 14) {
            out += '4';
        } else if (i === 19) {
            out += HEX[(Math.floor(Math.random() * 16) & 0x3) | 0x8];
        } else {
            out += HEX[Math.floor(Math.random() * 16)];
        }
    }
    return out;
}

export function withRequestId<T extends Record<string, unknown>>(headers: T) {
    return { ...headers, 'x-request-id': generateRequestId() };
}
