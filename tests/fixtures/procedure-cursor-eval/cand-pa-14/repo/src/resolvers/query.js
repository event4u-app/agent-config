const { entries } = require('../store');

module.exports = {
  entries: (_parent, { account }) => entries.filter((e) => e.account === account),
};
