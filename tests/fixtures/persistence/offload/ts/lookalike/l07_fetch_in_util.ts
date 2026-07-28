// S0.5 fixture — LOOKALIKE: outbound HTTP in a plain utility module (no handler scope) — must NOT fire.
export async function fetchExchangeRates(): Promise<Record<string, number>> {
    const res = await fetch('https://rates.example/api/latest');
    return res.json();
}
