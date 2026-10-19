const { entries, pubsub } = require('../store');

module.exports = {
  postEntry: (_parent, { account, amountCents }) => {
    const entry = { id: String(entries.length + 1), account, amountCents };
    entries.push(entry);
    pubsub.publish(`entry:${account}`, entry);
    return entry;
  },
};
