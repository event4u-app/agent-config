export function validateConfig(input) {
  if (input.maxItems !== undefined) {
    if (!Number.isInteger(input.maxItems) || input.maxItems < 1) {
      throw new Error('maxItems must be at least 1');
    }
  }
  if (input.newestFirst !== undefined && typeof input.newestFirst !== 'boolean') {
    throw new Error('newestFirst must be a boolean');
  }
}
