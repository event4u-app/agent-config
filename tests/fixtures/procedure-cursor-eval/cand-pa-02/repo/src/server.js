const express = require('express');
const reportsRouter = require('./routes/reports');
const schedulesRouter = require('./routes/schedules');

const app = express();
app.use(express.json());
app.use('/reports', reportsRouter);
app.use('/schedules', schedulesRouter);

app.listen(process.env.PORT || 3000);
