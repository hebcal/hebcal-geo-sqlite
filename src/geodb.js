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

const ZIPCODE_SQL = `SELECT CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving
FROM ZIPCodes_Primary WHERE ZipCode = ?`;

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
    this.geonamesStmt = this.geonamesDb.prepare(GEONAME_SQL);
    this.cache = new Map();
    this.legacyCities = new Map();
    for (const [name, id] of Object.entries(city2geonameid)) {
      this.legacyCities.set(name.toLowerCase(), id);
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
    const found = this.cache.get(zip);
    if (found) return found;
    const result = this.zipStmt.get(zip);
    if (!result) {
      if (this.logger) this.logger.warn(`GeoDb: unknown zipcode=${zip}`);
      return null;
    }
    const tzid = Location.getUsaTzid(result.State, result.TimeZone, result.DayLightSaving);
    const cityDescr = `${result.CityMixedCase}, ${result.State} ${zip}`;
    const location = new Location(result.Latitude, result.Longitude, false, tzid, cityDescr, 'US', zip);
    this.cache.set(zip, location);
    return location;
  }

  /**
   * @param {number} geonameid
   * @return {Location}
   */
  lookupGeoname(geonameid) {
    const found = this.cache.get(geonameid);
    if (found) return found;
    const result = this.geonamesStmt.get(geonameid);
    if (!result) {
      if (this.logger) this.logger.warn(`GeoDb: unknown geonameid=${geonameid}`);
      return null;
    }
    const country = result.country || '';
    const admin1 = result.admin1 || '';
    const cityDescr = Location.geonameCityDescr(result.asciiname, admin1, country);
    const location = new Location(
        result.latitude,
        result.longitude,
        result.cc == 'IL',
        result.timezone,
        cityDescr,
        result.cc,
        geonameid,
    );
    if (result.cc == 'IL' && admin1.startsWith('Jerusalem') && result.name.startsWith('Jerualem')) {
      location.jersualem = true;
    }
    this.cache.set(geonameid, location);
    return location;
  }

  /**
   * @param {string} cityName
   * @return {Location}
   */
  lookupLegacyCity(cityName) {
    const name = cityName.replace(/\+/g, ' ').toLowerCase();
    const geonameid = this.legacyCities.get(name);
    if (geonameid) {
      return this.lookupGeoname(geonameid);
    } else {
      if (this.logger) this.logger.warn(`GeoDb: unknown city=${cityName}`);
      return null;
    }
  }
}
