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
  g.timezone as timezone,
  g.elevation as elevation
FROM geoname g
LEFT JOIN country c on g.country = c.iso
LEFT JOIN admin1 a on g.country||'.'||g.admin1 = a.key
WHERE g.geonameid = ?
`;

const ZIPCODE_SQL = `SELECT CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Elevation
FROM ZIPCodes_Primary WHERE ZipCode = ?`;

const ZIP_COMPLETE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving
FROM ZIPCodes_Primary
WHERE ZipCode LIKE ?
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
    if (this.logger) logger.info(`GeoDb: opening ${zipsFilename}...`);
    this.zipsDb = new Database(zipsFilename, {fileMustExist: true});
    if (this.logger) logger.info(`GeoDb: opening ${geonamesFilename}...`);
    this.geonamesDb = new Database(geonamesFilename, {fileMustExist: true});
    this.zipStmt = this.zipsDb.prepare(ZIPCODE_SQL);
    this.zipCache = new Map();
    this.geonamesStmt = this.geonamesDb.prepare(GEONAME_SQL);
    this.geonamesCache = new Map();
    this.legacyCities = new Map();
    for (const [name, id] of Object.entries(city2geonameid)) {
      this.legacyCities.set(name.replace(/'/g, '').toLowerCase(), id);
    }
  }

  /** Closes database handles */
  close() {
    this.zipsDb.close();
    this.geonamesDb.close();
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
    const tzid = Location.getUsaTzid(result.State, result.TimeZone, result.DayLightSaving);
    const cityDescr = `${result.CityMixedCase}, ${result.State} ${zip}`;
    const location = new Location(result.Latitude, result.Longitude, false, tzid, cityDescr, 'US', zip);
    location.admin1 = location.state = result.State;
    location.geo = 'zip';
    location.zip = zip;
    if (result.Elevation) {
      location.elevation = +result.Elevation;
    }
    this.zipCache.set(zip, location);
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
    if (result.elevation) {
      location.elevation = +result.elevation;
    }
    this.geonamesCache.set(geonameid, location);
    return location;
  }

  /**
   * @param {string} cityName
   * @return {Location}
   */
  lookupLegacyCity(cityName) {
    const name = cityName.replace(/\+/g, ' ').replace(/'/g, '').toLowerCase();
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
          geo: 'zip',
        };
        return obj;
      });
    } else {
      if (!this.geonamesCompStmt) {
        this.geonamesCompStmt = this.geonamesDb.prepare(GEONAME_COMPLETE_SQL);
      }
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
}
