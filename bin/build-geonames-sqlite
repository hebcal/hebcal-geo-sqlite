#!/usr/bin/env node

const {buildGeonamesSqlite} = require('@hebcal/geo-sqlite');
const {pino} = require('pino');

const logger = pino({
  // level: argv.quiet ? 'warn' : 'info',
  transport: {
    target: 'pino-pretty',
    options: {translateTime: 'SYS:standard', ignore: 'pid,hostname'},
  },
});

const argv = process.argv.slice(2);
if (argv.length !== 7) {
  const infiles = 'countryInfo.txt cities5000.txt cities-patch.txt admin1CodesASCII.txt IL.txt IL-alternatenames.txt';
  console.error(`Usage: build-geonames-sqlite geonames.sqlite3 ${infiles}`);
  process.exit(1);
}

const filenames = {
  dbFilename: argv[0],
  countryInfotxt: argv[1],
  cities5000txt: argv[2],
  citiesPatch: argv[3],
  admin1CodesASCIItxt: argv[4],
  ILtxt: argv[5],
  ILalternate: argv[6],
  logger: logger,
};
buildGeonamesSqlite(filenames).then(() => {
  console.log('Done!');
});
