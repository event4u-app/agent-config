const host = process.env.DB_HOST;
const token = process.env['APP_TOKEN'];
const mode = process.env.NODE_ENV;
const missing = process.env.PAYMENT_GATEWAY_KEY;
export { host, token, mode, missing };
