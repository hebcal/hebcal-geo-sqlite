import Database from 'better-sqlite3';
import {Location} from '@hebcal/core';
import city2geonameid from './city2geonameid.json';

const GEONAME_SQL = `SELECT
  g.name as name,
  g.asciiname as asciiname,
  g.country as cc,
  c.country as country,
  a.asciiname as admin1,
  g.latitude as latitude,
  g.longitude as longitude,
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
  g.timezone as timezone
FROM geoname g
LEFT JOIN country c on g.country = c.iso
LEFT JOIN admin1 a on g.country||'.'||g.admin1 = a.key
`;

const ZIPCODE_SQL = `SELECT CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving
FROM ZIPCodes_Primary WHERE ZipCode = ?`;

const ZIPCODE_ALL_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving
FROM ZIPCodes_Primary`;

const ZIP_COMPLETE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary
WHERE ZipCode LIKE ?
ORDER BY Population DESC
LIMIT 10`;

const GEONAME_COMPLETE_SQL = `SELECT geonameid, asciiname, admin1, country,
population, latitude, longitude, timezone
FROM geoname_fulltext
WHERE longname MATCH ?
GROUP BY geonameid
ORDER BY population DESC
LIMIT 10`;

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
    this.zipCache = new Map();
    this.geonamesStmt = this.geonamesDb.prepare(GEONAME_SQL);
    this.geonamesCache = new Map();
    this.legacyCities = new Map();
    for (const [name, id] of Object.entries(city2geonameid)) {
      this.legacyCities.set(GeoDb.munge(name), id);
    }
  }

  /** Closes database handles */
  close() {
    this.zipsDb.close();
    this.geonamesDb.close();
  }

  /**
   * @private
   * @param {string} s
   * @return {string}
   */
  static munge(s) {
    return s.toLowerCase()
        .replace(/'/g, '')
        .replace(/ /g, '')
        .replace(/\+/g, '');
  }

  /**
   * @param {string} zip
   * @return {Location}
   */
  lookupZip(zip) {
    const found = this.zipCache.get(zip);
    if (typeof found !== 'undefined') return found;
    const result = this.zipStmt.get(zip);
    if (!result) {
      if (this.logger) this.logger.warn(`GeoDb: unknown zipcode=${zip}`);
      this.zipCache.set(zip, null);
      return null;
    }
    result.ZipCode = String(zip);
    const location = this.makeZipLocation(result);
    this.zipCache.set(zip, location);
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
    location.geo = 'zip';
    location.zip = zip;
    return location;
  }

  /**
   * @param {number} geonameid
   * @return {Location}
   */
  lookupGeoname(geonameid) {
    geonameid = +geonameid;
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
   * @private
   * @param {number} geonameid
   * @param {any} result
   * @return {Location}
   */
  makeGeonameLocation(geonameid, result) {
    const country = result.country || '';
    const admin1 = result.admin1 || '';
    const cityDescr = Location.geonameCityDescr(result.name, admin1, country);
    const location = new Location(
        result.latitude,
        result.longitude,
        result.cc == 'IL',
        result.timezone,
        cityDescr,
        result.cc,
        geonameid,
    );
    if (result.asciiname !== result.name) {
      location.asciiname = result.asciiname;
    }
    location.geo = 'geoname';
    location.geonameid = geonameid;
    if (admin1) {
      location.admin1 = admin1;
    }
    if (result.cc == 'IL' && admin1.startsWith('Jerusalem') && result.name.startsWith('Jerualem')) {
      location.jersualem = true;
    }
    return location;
  }

  /**
   * @param {string} cityName
   * @return {Location}
   */
  lookupLegacyCity(cityName) {
    const name = GeoDb.munge(cityName);
    const geonameid = this.legacyCities.get(name);
    if (geonameid) {
      return this.lookupGeoname(geonameid);
    } else {
      if (this.logger) this.logger.warn(`GeoDb: unknown city=${cityName}`);
      return null;
    }
  }

  /**
   * Generates autocomplete results based on a query string
   * @param {string} qraw
   * @return {Object[]}
   */
  autoComplete(qraw) {
    if (qraw.length === 0) {
      return [];
    }
    if (qraw.charCodeAt(0) >= 48 && qraw.charCodeAt(0) <= 57) {
      if (!this.zipCompStmt) {
        this.zipCompStmt = this.zipsDb.prepare(ZIP_COMPLETE_SQL);
      }
      return this.zipCompStmt.all(qraw + '%').map((res) => {
        const obj = {
          id: String(res.ZipCode),
          value: `${res.CityMixedCase}, ${res.State} ${res.ZipCode}`,
          admin1: res.State,
          asciiname: res.CityMixedCase,
          country: 'United States',
          latitude: res.Latitude,
          longitude: res.Longitude,
          timezone: Location.getUsaTzid(res.State, res.TimeZone, res.DayLightSaving),
          population: res.Population,
          geo: 'zip',
        };
        return obj;
      });
    } else {
      if (!this.geonamesCompStmt) {
        this.geonamesCompStmt = this.geonamesDb.prepare(GEONAME_COMPLETE_SQL);
      }
      qraw = qraw.replace(/\"/g, '""');
      return this.geonamesCompStmt.all(`"${qraw}*"`).map((res) => {
        const country = res.country || '';
        const admin1 = res.admin1 || '';
        const obj = {
          id: res.geonameid,
          value: Location.geonameCityDescr(res.asciiname, admin1, country),
          asciiname: res.asciiname,
          latitude: res.latitude,
          longitude: res.longitude,
          timezone: res.timezone,
          population: res.population,
          geo: 'geoname',
        };
        if (country) {
          obj.country = country;
        }
        if (admin1) {
          obj.admin1 = admin1;
        }
        obj.tokens = Array.from(new Set(res.asciiname.split(' ').concat(admin1.split(' '), country.split(' '))));
        return obj;
      });
    }
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
