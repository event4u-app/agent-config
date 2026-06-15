// Grouping layer: buckets coerced entries by project, preserving first-seen
// project order. Returns a Map<project, entry[]>.

export function groupByProject(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.project)) {
      groups.set(e.project, []);
    }
    groups.get(e.project).push(e);
  }
  return groups;
}
