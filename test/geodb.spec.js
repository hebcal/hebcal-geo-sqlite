/* eslint-disable max-len */
import test from 'ava';
import {Location} from '@hebcal/core';
import {GeoDb} from '../src/geodb.js';
import {buildGeonamesSqlite} from '../src/build-geonames-sqlite.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import legacyCities from './legacy.json.js';
import {makeDummyZipsDb} from './makeDummyZipsDb.js';
import {makeDummyInfoTxt} from './makeDummyInfoTxt.js';
import {munge} from '../src/munge.js';

const logger = pino({level: 'error'});

test.before(async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hebcal-test-'));
  const {ciPath, c5path, a1path, altNamePath} = makeDummyInfoTxt(logger, tmpDir);
  const testZipsPath = makeDummyZipsDb(logger, tmpDir);
  const testDbPath = path.join(tmpDir, 'test-geonames.sqlite3');
  logger.info(testDbPath);
  const filenames = {
    dbFilename: testDbPath,
    countryInfotxt: ciPath,
    cities5000txt: c5path,
    citiesPatch: 'cities-patch.txt',
    admin1CodesASCIItxt: a1path,
    ILtxt: '/dev/null',
    ILalternate: altNamePath,
    logger: logger,
  };
  await buildGeonamesSqlite(filenames);
  t.context.db = new GeoDb(logger, testZipsPath, testDbPath);
  logger.info('setup: complete');
});

test.after((t) => {
  logger.info('Cleaning up');
  t.context.db.close();
  logger.info('Finished');
});

test('legacy', (t) => {
  const expected = {
    'Be\'er Sheva': 295530,
    'Beer Sheva': 295530,
    'Raanana': 293807,
    'Ra\'anana': 293807,
    'CN-Xian': 1790630,
  };
  for (const [key, val] of Object.entries(expected)) {
    const loc = t.context.db.lookupLegacyCity(key);
    t.is(loc == null, false);
    t.is(typeof loc, 'object');
    t.is(loc instanceof Location, true);
    t.is(loc.getGeoId(), val);
  }
  t.is(t.context.db.lookupLegacyCity('*nonexistent*'), null);
});

test('legacy2', (t) => {
  for (const key of legacyCities) {
    const name = munge(key);
    const geonameid = t.context.db.legacyCities.get(name);
    t.is(typeof geonameid, 'number', key);
  }
});

test('geoname', (t) => {
  t.is(t.context.db.lookupGeoname(0), null);
  t.is(t.context.db.lookupGeoname('0'), null);
  t.is(t.context.db.lookupGeoname(1234), null);
  const loc = t.context.db.lookupGeoname(4119403);
  t.is(loc == null, false);
  t.is(typeof loc, 'object');
  t.is(loc instanceof Location, true);
  t.is(loc.getGeoId(), 4119403);
  t.is(loc.getShortName(), 'Little Rock');
  t.is(loc.getName(), 'Little Rock, Arkansas, USA');
  const expected = {
    locationName: 'Little Rock, Arkansas, USA',
    latitude: 34.74648,
    longitude: -92.28959,
    elevation: 105,
    timeZoneId: 'America/Chicago',
    il: false,
    cc: 'US',
    geoid: 4119403,
    geo: 'geoname',
    geonameid: 4119403,
    asciiname: 'Little Rock',
    admin1: 'Arkansas',
    population: 197992,
  };
  const plainObj = Object.assign({}, loc);
  t.deepEqual(plainObj, expected);
});

test('zip', (t) => {
  t.is(t.context.db.lookupZip('00000'), null);
  t.is(t.context.db.lookupZip('00001'), null);
  t.is(t.context.db.lookupZip('00000'), null);
  const loc = t.context.db.lookupZip('02912');
  t.is(loc == null, false);
  t.is(typeof loc, 'object');
  t.is(loc instanceof Location, true);
  t.is(loc.getGeoId(), '02912');
  t.is(loc.getShortName(), 'Providence');
  t.is(loc.getName(), 'Providence, RI 02912');
  const expected = {
    locationName: 'Providence, RI 02912',
    latitude: 41.826254,
    longitude: -71.402502,
    elevation: 118,
    timeZoneId: 'America/New_York',
    il: false,
    cc: 'US',
    geoid: '02912',
    state: 'RI',
    admin1: 'RI',
    stateName: 'Rhode Island',
    geo: 'zip',
    zip: '02912',
    population: 4739,
  };
  const plainObj = Object.assign({}, loc);
  t.deepEqual(plainObj, expected);
});

test('autoComplete', (t) => {
  const expected = [
    {
      id: 293397,
      value: 'Tel Aviv, Israel',
      asciiname: 'Tel Aviv',
      admin1: 'Tel Aviv',
      country: 'Israel',
      cc: 'IL',
      latitude: 32.08088,
      longitude: 34.78057,
      timezone: 'Asia/Jerusalem',
      population: 432892,
      geo: 'geoname',
    },
  ];
  const result = t.context.db.autoComplete('tel', true);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});

test('autoCompleteBerlin', (t) => {
  const result = t.context.db.autoComplete('BERL', true);
  t.is(result.length > 0, true, 'Should find Berlin');
  const berlin = result[0];
  t.is(berlin.value, 'Berlin, Germany');
});

test('autoCompleteZip', (t) => {
  const expected = [
    {
      id: '65807',
      value: 'Springfield, MO 65807',
      admin1: 'MO',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 37.171008,
      longitude: -93.331857,
      timezone: 'America/Chicago',
      population: 55168,
      geo: 'zip',
    },
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39157,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('6', true);
  t.deepEqual(result, expected);
});

test('autoCompleteZipPlus4', (t) => {
  const expected = [
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39157,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('62704-1234', true);
  t.deepEqual(result, expected);
});

test('autoCompleteZipMerge', (t) => {
  const expected = [
    {
      id: 5417598,
      value: 'Colorado Springs, Colorado, USA',
      admin1: 'Colorado',
      country: 'United States',
      cc: 'US',
      latitude: 38.83388,
      longitude: -104.82136,
      timezone: 'America/Denver',
      geo: 'geoname',
      population: 456568,
      asciiname: 'Colorado Springs',
    },
    {
      id: 952865,
      value: 'Springs, Gauteng, South Africa',
      admin1: 'Gauteng',
      country: 'South Africa',
      cc: 'ZA',
      latitude: -26.25,
      longitude: 28.4,
      timezone: 'Africa/Johannesburg',
      geo: 'geoname',
      population: 186394,
      asciiname: 'Springs',
    },
    {
      id: 4409896,
      value: 'Springfield, Missouri, USA',
      admin1: 'Missouri',
      country: 'United States',
      cc: 'US',
      latitude: 37.21533,
      longitude: -93.29824,
      timezone: 'America/Chicago',
      geo: 'geoname',
      population: 166810,
      asciiname: 'Springfield',
    },
    {
      id: 4951788,
      value: 'Springfield, Massachusetts, USA',
      admin1: 'Massachusetts',
      country: 'United States',
      cc: 'US',
      latitude: 42.10148,
      longitude: -72.58981,
      timezone: 'America/New_York',
      geo: 'geoname',
      population: 154341,
      asciiname: 'Springfield',
    },
    {
      id: '11413',
      value: 'Springfield Gardens, NY 11413',
      admin1: 'NY',
      asciiname: 'Springfield Gardens',
      country: 'United States',
      cc: 'US',
      latitude: 40.665415,
      longitude: -73.749702,
      timezone: 'America/New_York',
      population: 42978,
      geo: 'zip',
    },
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39157,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('Spring', true).slice(0, 6);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});

test('autoCompleteZipMerge2', (t) => {
  const result = t.context.db.autoComplete('Providence', true)
      .map((res) => {
        return {
          i: res.id,
          v: res.value,
          p: res.population,
        };
      });
  const expected = [
    {i: 3571824, v: 'Nassau, New Providence, Bahamas', p: 227940},
    {i: 5224151, v: 'Providence, Rhode Island, USA', p: 190934},
    {i: 5221931, v: 'East Providence, Rhode Island, USA', p: 47408},
    {i: 5223681, v: 'North Providence, Rhode Island, USA', p: 33835},
    {i: 5780020, v: 'Providence, Utah, USA', p: 7124},
    {i: 4305295, v: 'Providence, Kentucky, USA', p: 3065},
    {i: '27315', v: 'Providence, NC 27315', p: 1892},
  ];
  t.deepEqual(result, expected);
});

test('autoComplete-no-match', (t) => {
  const expected = [];
  const result = t.context.db.autoComplete('foobar', false);
  t.deepEqual(result, expected);
});

test('autoComplete-nolatlong', (t) => {
  const expected = [{
    id: 293807,
    value: 'Ra\'anana, Israel',
    asciiname: 'Ra\'anana',
    admin1: 'Central District',
    country: 'Israel',
    cc: 'IL',
    geo: 'geoname',
  }];
  const result = t.context.db.autoComplete('Ra\'a', false);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});


test('cacheZips', (t) => {
  t.context.db.cacheZips();
  t.pass('OK');
});

test('cacheGeonames', (t) => {
  t.context.db.cacheGeonames();
  t.pass('OK');
});

test('countryNames', (t) => {
  const m = t.context.db.countryNames;
  t.is(typeof m, 'object');
  t.is(m.get('ZA'), 'South Africa');
});

test('legacy3', (t) => {
  // fetch from @hebacal/cities because no trailing "h"
  const loc = t.context.db.lookupLegacyCity('IL-Petah Tikva');
  t.not(loc, null);
  t.is(typeof loc, 'object');
  t.is(loc instanceof Location, true);
  const expected = {
    locationName: 'Petah Tiqwa',
    latitude: 32.08707,
    longitude: 34.88747,
    elevation: 0,
    timeZoneId: 'Asia/Jerusalem',
    il: true,
    cc: 'IL',
  };
  const plainObj = JSON.parse(JSON.stringify(loc));
  t.deepEqual(plainObj, expected);
});

test('alternatenames', (t) => {
  const sql = `SELECT * from alternatenames where geonameid = ?`;
  const stmt = t.context.db.geonamesDb.prepare(sql);
  const results = stmt.all([293100]);
  const actual = JSON.parse(JSON.stringify(results));
  const expected = [
    {'id': 204884, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Sfat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204885, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Safed', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204886, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tsefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202955, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tzefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202956, 'geonameid': 293100, 'isolanguage': 'he', 'name': 'צפת', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
  ];
  t.deepEqual(actual, expected);
});

test('autoCompleteZipPartial', (t) => {
  const result = t.context.db.autoComplete('Providence, RI 029', true);
  t.is(result.length, 12);
  const firstTwo = [{
    id: '02909',
    value: 'Providence, RI 02909',
    admin1: 'RI',
    asciiname: 'Providence',
    country: 'United States',
    cc: 'US',
    latitude: 41.822232,
    longitude: -71.448292,
    timezone: 'America/New_York',
    population: 46119,
    geo: 'zip',
  }, {
    id: '02908',
    value: 'Providence, RI 02908',
    admin1: 'RI',
    asciiname: 'Providence',
    country: 'United States',
    cc: 'US',
    latitude: 41.839296,
    longitude: -71.438804,
    timezone: 'America/New_York',
    population: 38507,
    geo: 'zip',
  }];
  t.deepEqual(result.slice(0, 2), firstTwo);
});

test('Tel Aviv alias', (t) => {
  const alias = t.context.db.lookupGeoname(293396);
  t.is(alias.geoid, 293397);
  t.is(alias.getName(), 'Tel Aviv, Israel');
});

test('Chandler Arizona', (t) => {
  const loc = t.context.db.lookupZip('85226');
  const plainObj = Object.assign({}, loc);
  const expected = {
    locationName: 'Chandler, AZ 85226',
    latitude: 33.266332,
    longitude: -111.943009,
    elevation: 1157,
    timeZoneId: 'America/Phoenix',
    il: false,
    cc: 'US',
    geoid: '85226',
    state: 'AZ',
    admin1: 'AZ',
    stateName: 'Arizona',
    geo: 'zip',
    zip: '85226',
    population: 40689,
  };
  t.deepEqual(plainObj, expected);
});

test('version', (t) => {
  t.is(GeoDb.version().startsWith('5.'), true);
});

test('geonameCityDescr', (t) => {
  t.is(GeoDb.geonameCityDescr('Little Rock', 'Arkansas', 'United States'),
    'Little Rock, Arkansas, USA');
  t.is(GeoDb.geonameCityDescr('Berlin', 'State of Berlin', 'Germany'),
    'Berlin, Germany');
});
