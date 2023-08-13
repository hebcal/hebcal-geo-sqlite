import Database from 'better-sqlite3';
import {Location} from '@hebcal/core';
import '@hebcal/cities';
import city2geonameid from './city2geonameid.json';
import {transliterate} from 'transliteration';
import {munge} from './munge';

const GEONAME_SQL = `SELECT
  g.name as name,
  g.asciiname as asciiname,
  g.country as cc,
  c.country as country,
  a.asciiname as admin1,
  g.latitude as latitude,
  g.longitude as longitude,
  g.population as population,
  g.timezone as timezone
FROM geoname g
LEFT JOIN country c on g.country = c.iso
LEFT JOIN admin1 a on g.country||'.'||g.admin1 = a.key
WHERE g.geonameid = ?
`;

const GEONAME_ALL_SQL = `SELECT
  g.geonameid as geonameid,
  g.name as name,
  g.asciiname as asciiname,
  g.country as cc,
  c.country as country,
  a.asciiname as admin1,
  g.latitude as latitude,
  g.longitude as longitude,
  g.population as population,
  g.timezone as timezone
FROM geoname g
LEFT JOIN country c on g.country = c.iso
LEFT JOIN admin1 a on g.country||'.'||g.admin1 = a.key
`;

const ZIPCODE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary WHERE ZipCode = ?`;

const ZIPCODE_ALL_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary`;

const ZIP_COMPLETE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary
WHERE ZipCode LIKE ?
ORDER BY Population DESC
LIMIT 10`;

const ZIP_FULLTEXT_COMPLETE_SQL =
`SELECT ZipCode
FROM ZIPCodes_CityFullText5
WHERE ZIPCodes_CityFullText5 MATCH ?
ORDER BY Population DESC
LIMIT 20`;

const GEONAME_COMPLETE_SQL =
`SELECT geonameid, longname, city, admin1, country
FROM geoname_fulltext
WHERE geoname_fulltext MATCH ?
ORDER BY population DESC
LIMIT 20`;

const stateNames = {
  'AK': 'Alaska',
  'AL': 'Alabama',
  'AR': 'Arkansas',
  'AZ': 'Arizona',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DC': 'Washington, D.C.',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'IA': 'Iowa',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'MA': 'Massachusetts',
  'MD': 'Maryland',
  'ME': 'Maine',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MO': 'Missouri',
  'MS': 'Mississippi',
  'MT': 'Montana',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'NE': 'Nebraska',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NV': 'Nevada',
  'NY': 'New York',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VA': 'Virginia',
  'VT': 'Vermont',
  'WA': 'Washington',
  'WI': 'Wisconsin',
  'WV': 'West Virginia',
  'WY': 'Wyoming',
};

/** Wrapper around sqlite databases */
export class GeoDb {
  /**
   * @param {any} logger
   * @param {string} zipsFilename
   * @param {string} geonamesFilename
   */
  constructor(logger, zipsFilename, geonamesFilename) {
    this.logger = logger;
    if (logger) logger.info(`GeoDb: opening ${zipsFilename}...`);
    this.zipsDb = new Database(zipsFilename, {fileMustExist: true});
    if (logger) logger.info(`GeoDb: opening ${geonamesFilename}...`);
    this.geonamesDb = new Database(geonamesFilename, {fileMustExist: true});
    this.zipStmt = this.zipsDb.prepare(ZIPCODE_SQL);
    /** @type {Map<string, Location>} */
    this.zipCache = new Map();
    this.geonamesStmt = this.geonamesDb.prepare(GEONAME_SQL);
    /** @type {Map<number, Location>} */
    this.geonamesCache = new Map();
    /** @type {Map<string, number>} */
    this.legacyCities = new Map();
    for (const [name, id] of Object.entries(city2geonameid)) {
      this.legacyCities.set(munge(name), id);
    }
    const stmt = this.geonamesDb.prepare(`SELECT ISO, Country FROM country WHERE Country <> ''`);
    const rows = stmt.all();
    const map = new Map();
    for (const row of rows) {
      map.set(row.ISO, row.Country);
    }
    /** @type {Map<string, string>} */
    this.countryNames = map;
  }

  /** Closes database handles */
  close() {
    this.zipStmt = undefined;
    this.geonamesStmt = undefined;
    this.zipsDb.close();
    this.zipsDb = undefined;
    this.geonamesDb.close();
    this.geonamesDb = undefined;
  }

  /**
   * @private
   * @param {string} s
   * @return {string}
   */
  static munge(s) {
    return munge(s);
  }

  /**
   * @param {string} zip
   * @return {Location}
   */
  lookupZip(zip) {
    const zip5 = zip.trim().substring(0, 5);
    const found = this.zipCache.get(zip5);
    if (typeof found !== 'undefined') return found;
    const result = this.zipStmt.get(zip5);
    if (!result) {
      if (this.logger) this.logger.warn(`GeoDb: unknown zipcode=${zip5}`);
      this.zipCache.set(zip5, null);
      return null;
    }
    result.ZipCode = String(zip5);
    const location = this.makeZipLocation(result);
    this.zipCache.set(zip5, location);
    return location;
  }

  /**
   * @private
   * @param {any} result
   * @return {Location}
   */
  makeZipLocation(result) {
    const zip = result.ZipCode;
    const tzid = Location.getUsaTzid(result.State, result.TimeZone, result.DayLightSaving);
    const cityDescr = `${result.CityMixedCase}, ${result.State} ${zip}`;
    const location = new Location(result.Latitude, result.Longitude, false, tzid, cityDescr, 'US', zip);
    location.admin1 = location.state = result.State;
    location.stateName = stateNames[location.state];
    location.geo = 'zip';
    location.zip = zip;
    location.population = result.Population;
    return location;
  }

  /**
   * @param {number} geonameid
   * @return {Location}
   */
  lookupGeoname(geonameid) {
    geonameid = +geonameid;
    if (geonameid === 293396) {
      geonameid = 293397;
    }
    const found = this.geonamesCache.get(geonameid);
    if (typeof found !== 'undefined') return found;
    const result = this.geonamesStmt.get(geonameid);
    if (!result) {
      if (this.logger) this.logger.warn(`GeoDb: unknown geonameid=${geonameid}`);
      this.geonamesCache.set(geonameid, null);
      return null;
    }
    const location = this.makeGeonameLocation(geonameid, result);
    this.geonamesCache.set(geonameid, location);
    return location;
  }

  /**
   * Convenience wrapper of the `transliterate` function from `transliteration` npm package.
   * Transliterate the string `source` and return the result.
   * @param {string} source
   * @param {any} [options]
   * @return {string}
   */
  static transliterate(source, options) {
    return transliterate(source, options);
  }

  /**
   * Builds a city description from geonameid string components
   * @param {string} cityName e.g. 'Tel Aviv' or 'Chicago'
   * @param {string} admin1 e.g. 'England' or 'Massachusetts'
   * @param {string} countryName full country name, e.g. 'Israel' or 'United States'
   * @return {string}
   */
  static geonameCityDescr(cityName, admin1, countryName) {
    if (countryName === 'United States') countryName = 'USA';
    if (countryName === 'United Kingdom') countryName = 'UK';
    let cityDescr = cityName;
    if (countryName !== 'Israel' && admin1 && admin1.indexOf(cityName) !== 0) {
      const tlitCityName = transliterate(cityName);
      const tlitAdmin1 = transliterate(admin1);
      if (tlitAdmin1.indexOf(tlitCityName) != 0) {
        cityDescr += ', ' + admin1;
      }
    }
    if (countryName) {
      cityDescr += ', ' + countryName;
    }
    return cityDescr;
  }

  /**
   * @private
   * @param {number} geonameid
   * @param {any} result
   * @return {Location}
   */
  makeGeonameLocation(geonameid, result) {
    const country = result.country || '';
    const admin1 = result.admin1 || '';
    const cityDescr = GeoDb.geonameCityDescr(result.name, admin1, country);
    const location = new Location(
        result.latitude,
        result.longitude,
        result.cc == 'IL',
        result.timezone,
        cityDescr,
        result.cc,
        geonameid,
    );
    location.geo = 'geoname';
    location.geonameid = geonameid;
    location.asciiname = result.asciiname;
    if (admin1) {
      location.admin1 = admin1;
    }
    if (result.cc == 'IL' && admin1.startsWith('Jerusalem') && result.name.startsWith('Jerualem')) {
      location.jersualem = true;
    }
    if (result.population) {
      location.population = result.population;
    }
    return location;
  }

  /**
   * @param {string} cityName
   * @return {Location}
   */
  lookupLegacyCity(cityName) {
    const name = munge(cityName);
    const geonameid = this.legacyCities.get(name);
    if (geonameid) {
      return this.lookupGeoname(geonameid);
    } else {
      const location = Location.lookup(cityName);
      if (location) {
        return location;
      }
      if (this.logger) this.logger.warn(`GeoDb: unknown city=${cityName}`);
      return null;
    }
  }

  /**
   * @private
   * @param {any[]} res
   * @return {Object[]}
   */
  static zipResultToObj(res) {
    const obj = {
      id: String(res.ZipCode),
      value: `${res.CityMixedCase}, ${res.State} ${res.ZipCode}`,
      admin1: res.State,
      asciiname: res.CityMixedCase,
      country: 'United States',
      cc: 'US',
      latitude: res.Latitude,
      longitude: res.Longitude,
      timezone: Location.getUsaTzid(res.State, res.TimeZone, res.DayLightSaving),
      population: res.Population,
      geo: 'zip',
    };
    return obj;
  }

  /**
   * Generates autocomplete results based on a query string
   * @param {string} qraw
   * @param {boolean} latlong
   * @return {Object[]}
   */
  autoComplete(qraw, latlong=false) {
    qraw = qraw.trim();
    if (qraw.length === 0) {
      return [];
    }
    const firstCharCode = qraw.charCodeAt(0);
    if (firstCharCode >= 48 && firstCharCode <= 57) {
      if (!this.zipCompStmt) {
        this.zipCompStmt = this.zipsDb.prepare(ZIP_COMPLETE_SQL);
      }
      const zip5 = qraw.substring(0, 5);
      return this.zipCompStmt.all(zip5 + '%').map(GeoDb.zipResultToObj);
    } else {
      if (!this.geonamesCompStmt) {
        this.geonamesCompStmt = this.geonamesDb.prepare(GEONAME_COMPLETE_SQL);
      }
      qraw = qraw.replace(/\"/g, '""');
      const geoRows0 = this.geonamesCompStmt.all(`{longname} : "${qraw}" *`);
      const ids = new Set();
      const geoRows = [];
      for (const row of geoRows0) {
        const id = row.geonameid;
        if (!ids.has(id)) {
          ids.add(id);
          geoRows.push(row);
        }
      }
      const geoMatches = geoRows.map((res) => {
        const loc = this.lookupGeoname(res.geonameid);
        return this.geonameLocToAutocomplete(loc, res);
      });
      if (!this.zipFulltextCompStmt) {
        this.zipFulltextCompStmt = this.zipsDb.prepare(ZIP_FULLTEXT_COMPLETE_SQL);
      }
      const zipRows = this.zipFulltextCompStmt.all(`{longname} : "${qraw}" *`);
      const zipMatches = zipRows.map((res) => {
        const loc = this.lookupZip(res.ZipCode);
        return GeoDb.zipLocToAutocomplete(loc);
      });
      const values = this.mergeZipGeo(zipMatches, geoMatches);
      values.sort((a, b) => b.population - a.population);
      const topN = values.slice(0, 12);
      if (!latlong) {
        for (const val of topN) {
          delete val.latitude;
          delete val.longitude;
          delete val.timezone;
          delete val.population;
        }
      }
      return topN;
    }
  }

  /**
   * @private
   * @param {Location} loc
   * @param {any} res
   * @return {any}
   */
  geonameLocToAutocomplete(loc, res) {
    const cc = loc.getCountryCode();
    const country = res.country || this.countryNames.get(cc) || '';
    const admin1 = res.admin || loc.admin1 || '';
    const obj = {
      id: res.geonameid,
      value: res.longname,
      admin1,
      country,
      cc,
      latitude: loc.latitude,
      longitude: loc.longitude,
      timezone: loc.getTzid(),
      geo: 'geoname',
    };
    if (loc.population) {
      obj.population = loc.population;
    }
    if (res.city !== loc.asciiname) {
      obj.name = res.city;
    }
    if (loc.asciiname) {
      obj.asciiname = loc.asciiname;
    }
    if (country) {
      obj.country = country;
    }
    if (admin1) {
      obj.admin1 = admin1;
    }
    return obj;
  }

  /**
   * @private
   * @param {Location} loc
   * @return {any}
   */
  static zipLocToAutocomplete(loc) {
    return {
      id: loc.zip,
      value: loc.getName(),
      admin1: loc.admin1,
      asciiname: loc.getShortName(),
      country: 'United States',
      cc: 'US',
      latitude: loc.latitude,
      longitude: loc.longitude,
      timezone: loc.getTzid(),
      population: loc.population,
      geo: 'zip',
    };
  }

  /**
   * GeoNames matches takes priority over USA ZIP code matches
   * @private
   * @param {any[]} zipMatches
   * @param {any[]} geoMatches
   * @return {any[]}
   */
  mergeZipGeo(zipMatches, geoMatches) {
    const zlen = zipMatches.length;
    const glen = geoMatches.length;
    if (zlen && !glen) {
      return zipMatches;
    } else if (glen && !zlen) {
      return geoMatches;
    }
    const map = new Map();
    for (const obj of zipMatches) {
      const key = [obj.asciiname, stateNames[obj.admin1], obj.cc].join('|');
      if (!map.has(key)) {
        map.set(key, obj);
      }
    }
    for (const obj of geoMatches) {
      const key = [obj.asciiname, obj.admin1, obj.cc].join('|');
      map.set(key, obj);
    }
    return Array.from(map.values());
  }

  /** Reads entire ZIP database and caches in-memory */
  cacheZips() {
    const start = Date.now();
    const stmt = this.zipsDb.prepare(ZIPCODE_ALL_SQL);
    const rows = stmt.all();
    for (const row of rows) {
      const location = this.makeZipLocation(row);
      this.zipCache.set(row.ZipCode, location);
    }
    const end = Date.now();
    if (this.logger) this.logger.info(`GeoDb: cached ${rows.length} ZIP codes in ${end - start}ms`);
  }

  /** Reads entire geonames database and caches in-memory */
  cacheGeonames() {
    const start = Date.now();
    const stmt = this.geonamesDb.prepare(GEONAME_ALL_SQL);
    const rows = stmt.all();
    for (const row of rows) {
      const location = this.makeGeonameLocation(row.geonameid, row);
      this.geonamesCache.set(row.geonameid, location);
    }
    const end = Date.now();
    if (this.logger) this.logger.info(`GeoDb: cached ${rows.length} geonames in ${end - start}ms`);
  }
}
