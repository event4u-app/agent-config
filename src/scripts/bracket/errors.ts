/** Kept apart from `engine.ts` so `deck.ts` can throw it without an import cycle. */
export class BracketError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}
