export const resolvers = {
    Order: {
        total: (order) => order.amount,
    },
};
