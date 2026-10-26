import { gql, GraphQLClient } from 'graphql-request';

const client = new GraphQLClient(process.env.INVENTORY_GRAPHQL_URL as string);

export const STOCK = gql`
  query Stock($sku: String!) {
    stock(sku: $sku) {
      qty
    }
  }
`;

export const RESERVE = gql`
  mutation Reserve($sku: String!) {
    reserve(sku: $sku, qty: 1) {
      id
    }
    release(sku: $sku) {
      id
    }
  }
`;

export async function stock(sku: string): Promise<unknown> {
    return client.request(STOCK, { sku });
}
