/* eslint-disable max-len */
import test from 'ava';
import {GeoDb} from './geodb.js';
import {munge} from './munge.js';

test('geonameCityDescr', (t) => {
  t.is(GeoDb.geonameCityDescr('Providence', 'Rhode Island', 'United States'), 'Providence, Rhode Island, USA');
  t.is(GeoDb.geonameCityDescr('London', 'England', 'United Kingdom'), 'London, England, UK');
  t.is(GeoDb.geonameCityDescr('Tel Aviv', 'Central District', 'Israel'), 'Tel Aviv, Israel');
  t.is(GeoDb.geonameCityDescr('Montréal', 'Quebec', 'Canada'), 'Montréal, Quebec, Canada');
  t.is(GeoDb.geonameCityDescr('Panamá', 'Panama', 'Panama'), 'Panamá, Panama');
  t.is(GeoDb.geonameCityDescr('São Paulo', 'Sao Paulo', 'Brazil'), 'São Paulo, Brazil');
});

test('munge', (t) => {
  const expected = {
    'Tel Aviv': 'telaviv',
    'Tel+Aviv': 'telaviv',
    'TelAviv': 'telaviv',
    'Tel-Aviv': 'tel-aviv',
    'US-Las Vegas-NV': 'us-lasvegas-nv',
    'CR-San José': 'cr-sanjosé',
    'Ra\'anana': 'raanana',
    'Petaẖ Tiqwa': 'petaẖtiqwa',
  };
  for (const [key, val] of Object.entries(expected)) {
    t.is(munge(key), val, `munge(${key}) should be ${val}`);
  }
});
