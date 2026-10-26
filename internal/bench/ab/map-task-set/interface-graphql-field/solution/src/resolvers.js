export const resolvers = {
    Order: {
        totalAmount: (order) => order.amount,
    },
};
