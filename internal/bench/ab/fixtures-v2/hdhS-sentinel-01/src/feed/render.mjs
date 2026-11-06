export function renderFeed(events, config) {
  const ordered = [...events].sort((a, b) => (config.newestFirst ? b.at - a.at : a.at - b.at));
  return ordered.slice(0, config.maxItems).map((e) => `${e.at}: ${e.text}`);
}
