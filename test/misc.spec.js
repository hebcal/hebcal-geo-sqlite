import {test} from 'node:test';
import assert from 'node:assert';
import {GeoDb} from '../src/geodb.js';
import {munge} from '../src/munge.js';

test('geonameCityDescr', () => {
  assert.strictEqual(GeoDb.geonameCityDescr('Providence', 'Rhode Island', 'United States'), 'Providence, Rhode Island, USA');
  assert.strictEqual(GeoDb.geonameCityDescr('London', 'England', 'United Kingdom'), 'London, England, UK');
  assert.strictEqual(GeoDb.geonameCityDescr('Tel Aviv', 'Central District', 'Israel'), 'Tel Aviv, Israel');
  assert.strictEqual(GeoDb.geonameCityDescr('Montréal', 'Quebec', 'Canada'), 'Montréal, Quebec, Canada');
  assert.strictEqual(GeoDb.geonameCityDescr('Panamá', 'Panama', 'Panama'), 'Panamá, Panama');
  assert.strictEqual(GeoDb.geonameCityDescr('São Paulo', 'Sao Paulo', 'Brazil'), 'São Paulo, Brazil');
});

test('munge', () => {
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
    assert.strictEqual(munge(key), val, `munge(${key}) should be ${val}`);
  }
});
