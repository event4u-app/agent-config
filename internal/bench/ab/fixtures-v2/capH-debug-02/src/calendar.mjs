// Timezone-free calendar math for the proleptic Gregorian calendar.
// All functions operate on plain integers / "YYYY-MM-DD" strings and never
// touch the host clock or the Date object, so results are deterministic.

function isLeapYear(year) {
  return year % 4 === 0 && year % 100 !== 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year, month /* 1..12 */) {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return MONTH_DAYS[month - 1];
}

/**
 * Serialize a calendar date to a day number (days since 0000-01-01), so that
 * the difference of two serials is the count of days between the dates.
 */
function toOrdinal(year, month, day) {
  let total = 0;
  for (let y = 0; y < year; y++) {
    total += isLeapYear(y) ? 366 : 365;
  }
  for (let m = 1; m < month; m++) {
    total += daysInMonth(year, m);
  }
  total += day - 1;
  return total;
}

function parse(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

/**
 * Whole days from `startStr` to `endStr` (both "YYYY-MM-DD"), end exclusive.
 * Positive when end is after start.
 *
 *   daysBetween("2021-01-01", "2021-01-02") === 1
 *   daysBetween("2021-03-01", "2021-02-01") === -28
 */
export function daysBetween(startStr, endStr) {
  const a = parse(startStr);
  const b = parse(endStr);
  return toOrdinal(b.y, b.m, b.d) - toOrdinal(a.y, a.m, a.d);
}
