// Shared API contract the frontend consumes.
export interface OrderApiContract {
  id: string;
  total: number;
}
const INTERNAL_TOKEN = "sk-ant-api03-AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJ";
export const ORDER_ENDPOINT = "/api/v1/orders";
