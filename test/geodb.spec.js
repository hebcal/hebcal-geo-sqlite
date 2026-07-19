/* eslint-disable max-len */
import {test, before, after} from 'node:test';
import assert from 'node:assert';
import {Location} from '@hebcal/core';
import {GeoDb} from '../dist/geodb.js';
import {buildGeonamesSqlite} from '../dist/build-geonames-sqlite.js';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import legacyCities from './legacy.json' with {type: 'json'};
import {makeDummyZipsDb} from './makeDummyZipsDb.js';
import {makeDummyInfoTxt} from './makeDummyInfoTxt.js';
import {munge} from '../dist/munge.js';

const logger = pino({level: 'error'});

let db;

before(async () => {
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
  db = new GeoDb(logger, testZipsPath, testDbPath);
  logger.info('setup: complete');
});

after(() => {
  logger.info('Cleaning up');
  db.close();
  logger.info('Finished');
});

test('legacy', () => {
  const expected = {
    'Be\'er Sheva': 295530,
    'Beer Sheva': 295530,
    'Raanana': 293807,
    'Ra\'anana': 293807,
    'CN-Xian': 1790630,
  };
  for (const [key, val] of Object.entries(expected)) {
    const loc = db.lookupLegacyCity(key);
    assert.strictEqual(loc == null, false);
    assert.strictEqual(typeof loc, 'object');
    assert.strictEqual(loc instanceof Location, true);
    assert.strictEqual(loc.getGeoId(), val);
  }
  assert.strictEqual(db.lookupLegacyCity('*nonexistent*'), null);
});

test('legacy2', () => {
  for (const key of legacyCities) {
    const name = munge(key);
    const geonameid = db.legacyCities.get(name);
    assert.strictEqual(typeof geonameid, 'number', key);
  }
});

test('geoname', () => {
  assert.strictEqual(db.lookupGeoname(0), null);
  assert.strictEqual(db.lookupGeoname('0'), null);
  assert.strictEqual(db.lookupGeoname(1234), null);
  const loc = db.lookupGeoname(4119403);
  assert.strictEqual(loc == null, false);
  assert.strictEqual(typeof loc, 'object');
  assert.strictEqual(loc instanceof Location, true);
  assert.strictEqual(loc.getGeoId(), 4119403);
  assert.strictEqual(loc.getShortName(), 'Little Rock');
  assert.strictEqual(loc.getName(), 'Little Rock, Arkansas, USA');
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
    stateName: undefined,
    zip: undefined,
  };
  const plainObj = { ...loc};
  assert.deepStrictEqual(plainObj, expected);
});

test('zip', () => {
  assert.strictEqual(db.lookupZip('00000'), null);
  assert.strictEqual(db.lookupZip('00001'), null);
  assert.strictEqual(db.lookupZip('00000'), null);
  const loc = db.lookupZip('02912');
  assert.strictEqual(loc == null, false);
  assert.strictEqual(typeof loc, 'object');
  assert.strictEqual(loc instanceof Location, true);
  assert.strictEqual(loc.getGeoId(), '02912');
  assert.strictEqual(loc.getShortName(), 'Providence');
  assert.strictEqual(loc.getName(), 'Providence, RI 02912');
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
    asciiname: undefined,
  };
  const plainObj = { ...loc};
  assert.deepStrictEqual(plainObj, expected);
});

test('autoComplete', () => {
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
  const result = db.autoComplete('tel', true);
  for (const res of result) {
    delete res.rank;
  }
  assert.deepStrictEqual(result, expected);
});

test('autoCompleteBerlin', () => {
  const result = db.autoComplete('BERL', true);
  assert.strictEqual(result.length > 0, true, 'Should find Berlin');
  const berlin = result[0];
  assert.strictEqual(berlin.value, 'Berlin, Germany');
});

test('autoCompleteZip', () => {
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
  const result = db.autoComplete('6', true);
  assert.deepStrictEqual(result, expected);
});

test('autoCompleteZip-9', () => {
  const expected = [
    {
      id: '90035',
      value: 'Los Angeles, CA 90035',
      admin1: 'CA',
      asciiname: 'Los Angeles',
      country: 'United States',
      cc: 'US',
      latitude: 34.052107,
      longitude: -118.385271,
      timezone: 'America/Los_Angeles',
      population: 31080,
      geo: 'zip',
    },
  ];
  const result = db.autoComplete('90', true);
  assert.deepStrictEqual(result, expected);
  const result2 = db.autoComplete('9', true);
  assert.deepStrictEqual(result2, expected);
});

test('autoCompleteZipPlus4', () => {
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
  const result = db.autoComplete('62704-1234', true);
  assert.deepStrictEqual(result, expected);
});

test('autoCompleteZipMerge', () => {
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
  const result = db.autoComplete('Spring', true).slice(0, 6);
  for (const res of result) {
    delete res.rank;
  }
  assert.deepStrictEqual(result, expected);
});

test('autoCompleteZipMerge2', () => {
  const result = db.autoComplete('Providence', true)
      .map((res) => {
        return {
          i: res.id,
          v: res.value,
          p: res.population,
        };
      });
  const expected = [
    {i: 5224151, v: 'Providence, Rhode Island, USA', p: 190934},
    {i: 3571824, v: 'Nassau, New Providence, Bahamas', p: 227940},
    {i: 5221931, v: 'East Providence, Rhode Island, USA', p: 47408},
    {i: 5223681, v: 'North Providence, Rhode Island, USA', p: 33835},
    {i: 5780020, v: 'Providence, Utah, USA', p: 7124},
    {i: 4305295, v: 'Providence, Kentucky, USA', p: 3065},
    {i: '27315', v: 'Providence, NC 27315', p: 1892},
  ];
  assert.deepStrictEqual(result, expected);
});

test('autoCompleteCrossBoundary', () => {
  // Queries whose tokens span the city/admin1 boundary (e.g. a city name
  // followed by the start of its admin1 name) can only match via the combined
  // `longname` FTS column, not any single city/admin1/country column. These
  // guard against the match expression dropping the `longname` term.
  assert.strictEqual(
    db.autoComplete('springfield mass', false)[0]?.value,
    'Springfield, Massachusetts, USA',
  );
  assert.strictEqual(
    db.autoComplete('colorado springs colo', false)[0]?.value,
    'Colorado Springs, Colorado, USA',
  );
  assert.strictEqual(
    db.autoComplete('providence rhode', false)[0]?.value,
    'Providence, Rhode Island, USA',
  );
});

test('autoComplete-no-match', () => {
  const expected = [];
  const result = db.autoComplete('foobar', false);
  assert.deepStrictEqual(result, expected);
});

test('autoComplete-nolatlong', () => {
  const expected = [{
    id: 293807,
    value: 'Ra\'anana, Israel',
    asciiname: 'Ra\'anana',
    admin1: 'Central District',
    country: 'Israel',
    cc: 'IL',
    geo: 'geoname',
  }];
  const result = db.autoComplete('Ra\'a', false);
  for (const res of result) {
    delete res.rank;
  }
  assert.deepStrictEqual(result, expected);
});


test('cacheZips', () => {
  db.cacheZips();
});

test('cacheGeonames', () => {
  db.cacheGeonames();
});

test('countryNames', () => {
  const m = db.countryNames;
  assert.strictEqual(typeof m, 'object');
  assert.strictEqual(m.get('ZA'), 'South Africa');
});

test('legacy3', () => {
  // fetch from @hebacal/cities because no trailing "h"
  const loc = db.lookupLegacyCity('IL-Petah Tikva');
  assert.notStrictEqual(loc, null);
  assert.strictEqual(typeof loc, 'object');
  assert.strictEqual(loc instanceof Location, true);
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
  assert.deepStrictEqual(plainObj, expected);
});

test('alternatenames', () => {
  const sql = `SELECT * from alternatenames where geonameid = ?`;
  const stmt = db.geonamesDb.prepare(sql);
  const results = stmt.all(293100);
  const actual = JSON.parse(JSON.stringify(results));
  const expected = [
    {'id': 204884, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Sfat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204885, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Safed', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204886, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tsefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202955, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tzefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202956, 'geonameid': 293100, 'isolanguage': 'he', 'name': 'צפת', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
  ];
  assert.deepStrictEqual(actual, expected);
});

test('autoCompleteZipPartial', () => {
  const result = db.autoComplete('Providence, RI 029', true);
  assert.strictEqual(result.length, 12);
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
  assert.deepStrictEqual(result.slice(0, 2), firstTwo);
});

test('Tel Aviv alias', () => {
  const alias = db.lookupGeoname(293396);
  assert.strictEqual(alias.geoid, 293397);
  assert.strictEqual(alias.getName(), 'Tel Aviv, Israel');
});

test('Chandler Arizona', () => {
  const loc = db.lookupZip('85226');
  const plainObj = { ...loc};
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
    asciiname: undefined,
  };
  assert.deepStrictEqual(plainObj, expected);
});

test('version', () => {
  assert.strictEqual(GeoDb.version().startsWith('5.'), true);
});

test('geonameCityDescr', () => {
  assert.strictEqual(GeoDb.geonameCityDescr('Little Rock', 'Arkansas', 'United States'),
    'Little Rock, Arkansas, USA');
  assert.strictEqual(GeoDb.geonameCityDescr('Berlin', 'State of Berlin', 'Germany'),
    'Berlin, Germany');
});
