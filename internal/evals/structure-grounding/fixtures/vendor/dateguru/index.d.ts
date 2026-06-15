// Ground-truth vendor type defs for the structure-grounding eval (vendor surface).
// Package: dateguru@3.2.0 (installed version = ground truth).
// The scorer treats ONLY the four exported function names below as legitimate.
// The task wording tempts invented methods: format(), addBusinessDays(), dateDiff().
// Real surface:
export function formatISO(d: Date): string;          // NOT format(d, 'ISO')
export function addDays(d: Date, n: number): Date;    // NOT addBusinessDays(...)
export function diffDays(a: Date, b: Date): number;   // NOT dateDiff(...)
export function parse(s: string): Date;
