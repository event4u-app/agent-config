const { pubsub } = require('../store');

module.exports = {
  entryPosted: {
    subscribe: (_parent, { account }) => pubsub.subscribe(`entry:${account}`),
    resolve: (payload) => payload,
  },
};
