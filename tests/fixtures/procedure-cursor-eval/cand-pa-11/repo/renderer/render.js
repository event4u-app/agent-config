const fs = require('node:fs');

const dir = process.env.OUTPUT_DIR || '/tmp';
fs.writeFileSync(`${dir}/statement-${Date.now()}.txt`, 'Monthly statement\n');
