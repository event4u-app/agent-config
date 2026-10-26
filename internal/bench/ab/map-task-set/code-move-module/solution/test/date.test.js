import { isoDay } from '../src/shared/date.js';

console.assert(isoDay(new Date('2026-01-02T03:00:00Z')) === '2026-01-02');
