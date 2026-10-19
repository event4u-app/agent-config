#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { printTable } from '../src/table.js';

yargs(hideBin(process.argv))
  .command('show <harbour>', 'print the tide table', (y) => y.positional('harbour', { type: 'string' }), (argv) => printTable(argv.harbour))
  .demandCommand(1)
  .parse();
