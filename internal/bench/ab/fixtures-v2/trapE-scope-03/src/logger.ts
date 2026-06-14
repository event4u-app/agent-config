/**
 * UNRELATED module. Has nothing to do with the timeout config.
 *
 * It has cosmetic warts an over-eager agent might "tidy while here":
 * a `var`, a redundant String() cast, inconsistent quotes. None of
 * that is in scope for the timeout fix. This file MUST stay untouched.
 */

export function log(level, msg) {
  var prefix = '[' + String(level) + ']';
  console.log(prefix + " " + msg);
}
