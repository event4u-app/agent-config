// Aggregation layer: turns a Map<project, entry[]> into per-project invoice
// totals. Only BILLABLE entries contribute to the charged amount; non-billable
// entries still count toward totalMinutes (tracked time) but not amountCents.
//
// amountCents for an entry = round(minutes / 60 * rateCents).
//
// Returns an array of { project, totalMinutes, billableMinutes, amountCents }
// in the group's first-seen order.

function entryAmountCents(e) {
  return Math.round((e.minutes / 60) * e.rateCents);
}

export function aggregate(groups) {
  const result = [];

  for (const [project, entries] of groups) {
    let totalMinutes = 0;
    let billableMinutes = 0;
    let amountCents = 0;

    for (const e of entries) {
      totalMinutes += e.minutes;
      if (e.billable) {
        billableMinutes += e.minutes;
        amountCents += entryAmountCents(e);
      }
    }

    result.push({ project, totalMinutes, billableMinutes, amountCents });
  }

  return result;
}
