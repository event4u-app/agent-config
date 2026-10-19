const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('node:http');
const { createSchema, createYoga } = require('graphql-yoga');
const resolvers = require('./resolvers');

const typeDefs = fs.readFileSync(path.join(__dirname, '../schema/schema.graphql'), 'utf-8');
const yoga = createYoga({ schema: createSchema({ typeDefs, resolvers }) });

createServer(yoga).listen(4005);
