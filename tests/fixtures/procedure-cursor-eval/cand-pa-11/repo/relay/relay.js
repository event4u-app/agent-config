const upstream = process.env.UPSTREAM_URL;

setInterval(async () => {
  await fetch(upstream, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]' });
}, 60000);
