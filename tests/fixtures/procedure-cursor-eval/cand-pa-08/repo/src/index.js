const cron = require('node-cron');
const { importSupplierFeed } = require('./importers/supplierFeed');

cron.schedule('0 2 * * *', () => importSupplierFeed('north-depot'));
