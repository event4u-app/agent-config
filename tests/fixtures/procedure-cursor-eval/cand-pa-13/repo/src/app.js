const Koa = require('koa');
const Router = require('@koa/router');
const { rateCards } = require('./rateCards');

const app = new Koa();
const router = new Router();

router.get('/rate-cards/:region', (ctx) => {
  ctx.body = rateCards[ctx.params.region] ?? [];
});

app.use(router.routes());
app.listen(4000);
