// HIDDEN capability oracle — not named in the prompt.
// Exercises daysBetween across the three leap-year regimes that distinguish a
// correct Gregorian rule from the common shortcuts:
//   - ordinary leap years (%4)            : 2024
//   - century non-leap years (%100, !%400): 1900
//   - century leap years (%400)           : 2000
// A fix of "year % 4 === 0" alone makes 1900 wrong; a fix that keeps
// "year % 4 === 0 && year % 100 !== 0" keeps 2000 wrong. Only the full rule
// passes every case here.
import { daysBetween } from '../src/calendar.mjs';

let failed = false;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failed = true;
  }
}

// Spans crossing Feb 29 of a %400 century leap year (2000 IS a leap year).
assertEqual(daysBetween('2000-02-28', '2000-03-01'), 2, 'span over 2000-02-29 (leap)');
assertEqual(daysBetween('2000-01-01', '2001-01-01'), 366, 'full year 2000 (leap)');
assertEqual(daysBetween('1999-12-31', '2000-12-31'), 366, '1999-12-31 to 2000-12-31');

// Spans touching Feb of a %100 non-%400 century year (1900 is NOT a leap year).
assertEqual(daysBetween('1900-02-28', '1900-03-01'), 1, 'span over 1900-02-28/03-01 (non-leap)');
assertEqual(daysBetween('1900-01-01', '1901-01-01'), 365, 'full year 1900 (non-leap)');

// Ordinary leap year (2024) and ordinary common year (2023).
assertEqual(daysBetween('2024-02-28', '2024-03-01'), 2, 'span over 2024-02-29 (leap)');
assertEqual(daysBetween('2024-01-01', '2025-01-01'), 366, 'full year 2024 (leap)');
assertEqual(daysBetween('2023-01-01', '2024-01-01'), 365, 'full year 2023 (common)');

// Cross-century span that contains BOTH 1900 (non-leap) and 2000 (leap):
// 1900-01-01 .. 2000-01-01 = 100 years, leap years in [1900,1999] are
// every %4 except 1900 => 24 leap years => 100*365 + 24 = 36524 days.
assertEqual(daysBetween('1900-01-01', '2000-01-01'), 36524, 'century span 1900->2000');

// Sign + within-month sanity.
assertEqual(daysBetween('2021-01-01', '2021-01-02'), 1, 'adjacent days');
assertEqual(daysBetween('2021-03-01', '2021-02-01'), -28, 'negative span (Feb 2021 common)');
assertEqual(daysBetween('2021-05-10', '2021-05-10'), 0, 'identical dates');

if (failed) {
  process.exit(1);
}
console.log('ok');
