import {DatabaseSync, StatementSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import QuickLRU from 'quick-lru';
import {Location} from '@hebcal/core';
import {stateNames} from '@hebcal/cities';
import {transliterate} from 'transliteration';
import type {Logger} from 'pino';
import city2geonameid from './city2geonameid.json.js';
import {munge} from './munge.js';
import {version} from './pkgVersion.js';

export type AutoComplete = {
  id: number | string;
  value: string;
  geo: 'geoname' | 'zip';
  name?: string;
  asciiname?: string;
  admin1?: string;
  country?: string;
  cc?: string;
  population?: number;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  elevation?: number;
};

/**
 * Options for configuring the GeoDb constructor.
 */
export type GeoDbOptions = {
  /** Maximum number of entries in the ZIP code LRU cache. Default is 150. */
  zipsCacheSize?: number;
  /** Maximum number of entries in the geonames LRU cache. Default is 750. */
  geonamesCacheSize?: number;
};

/** Location with extra geo properties set by this package. */
type GeoLocation = Location & {
  state?: string;
  geonameid?: number;
};

/** A row from the geonames `geoname` join query. */
type GeonameRow = {
  geonameid?: number;
  name: string;
  asciiname: string;
  cc: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  population: number | null;
  elevation: number | null;
  timezone: string;
};

/** A row from the USA ZIP code `ZIPCodes_Primary` table. */
type ZipRow = {
  ZipCode: string;
  CityMixedCase: string;
  State: string;
  Latitude: number;
  Longitude: number;
  Elevation: number;
  TimeZone: string;
  DayLightSaving: string;
  Population: number;
};

/** A row from the `geoname_fulltext` full-text search query. */
type GeonameCompleteRow = {
  geonameid: number;
  longname: string;
  city: string;
  admin1: string;
  country: string;
};

type GeoCache<K> = Map<K, Location | null> | QuickLRU<K, Location | null>;

const GEONAME_SQL = `SELECT
  g.name as name,
  g.asciiname as asciiname,
  g.country as cc,
  c.country as country,
  a.asciiname as admin1,
  g.latitude as latitude,
  g.longitude as longitude,
  g.population as population,
  g.gtopo30 as elevation,
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
  g.gtopo30 as elevation,
  g.timezone as timezone
FROM geoname g
LEFT JOIN country c on g.country = c.iso
LEFT JOIN admin1 a on g.country||'.'||g.admin1 = a.key
`;

const ZIPCODE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,Elevation,
TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary WHERE ZipCode = ?`;

const ZIPCODE_ALL_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,Elevation,
TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary`;

const ZIP_COMPLETE_SQL = `SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary
WHERE ZipCode >= ? AND ZipCode < ?
ORDER BY Population DESC
LIMIT 10`;

const ZIP_FULLTEXT_COMPLETE_SQL = `SELECT ZipCode
FROM ZIPCodes_CityFullText5
WHERE ZIPCodes_CityFullText5 MATCH ?
ORDER BY Population DESC
LIMIT 20`;

const GEONAME_COMPLETE_SQL = `SELECT geonameid, longname, city, admin1, country
FROM geoname_fulltext
WHERE geoname_fulltext MATCH ?
ORDER BY population DESC
LIMIT 20`;

/** Wrapper around sqlite databases */
export class GeoDb {
  logger: Logger | null;
  zipsDb: DatabaseSync;
  geonamesDb: DatabaseSync;
  /** @internal */
  zipCache: GeoCache<string>;
  /** @internal */
  geonamesCache: GeoCache<number>;
  legacyCities: Map<string, number>;
  countryNames: Map<string, string>;
  private readonly zipStmt: StatementSync;
  private readonly geonamesStmt: StatementSync;
  private zipCompStmt?: StatementSync;
  private geonamesCompStmt?: StatementSync;
  private zipFulltextCompStmt?: StatementSync;

  constructor(
    logger: Logger | null,
    zipsFilename: string,
    geonamesFilename: string,
    options?: GeoDbOptions,
  ) {
    this.logger = logger;
    if (logger) logger.info(`GeoDb: opening ${zipsFilename}...`);
    if (!existsSync(zipsFilename)) {
      throw new Error(`GeoDb: ${zipsFilename} does not exist`);
    }
    this.zipsDb = new DatabaseSync(zipsFilename, {readOnly: true});
    if (logger) logger.info(`GeoDb: opening ${geonamesFilename}...`);
    if (!existsSync(geonamesFilename)) {
      throw new Error(`GeoDb: ${geonamesFilename} does not exist`);
    }
    this.geonamesDb = new DatabaseSync(geonamesFilename, {readOnly: true});
    this.zipStmt = this.zipsDb.prepare(ZIPCODE_SQL);
    const zipsCacheSize = options?.zipsCacheSize || 150;
    this.zipCache = new QuickLRU<string, Location | null>({
      maxSize: zipsCacheSize,
    });
    this.geonamesStmt = this.geonamesDb.prepare(GEONAME_SQL);
    const geonamesCacheSize = options?.geonamesCacheSize || 750;
    this.geonamesCache = new QuickLRU<number, Location | null>({
      maxSize: geonamesCacheSize,
    });
    this.legacyCities = new Map();
    for (const [name, id] of Object.entries(city2geonameid)) {
      this.legacyCities.set(munge(name), id);
    }
    const stmt = this.geonamesDb.prepare(
      "SELECT ISO, Country FROM country WHERE Country <> ''",
    );
    const rows = stmt.all() as {ISO: string; Country: string}[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.ISO, row.Country);
    }
    this.countryNames = map;
    if (logger)
      logger.info(
        `GeoDb: ${map.size} countries, ${this.legacyCities.size} legacy cities`,
      );
  }

  /** Closes database handles */
  close(): void {
    this.zipsDb.close();
    this.geonamesDb.close();
  }

  /** @private */
  static munge(s: string): string {
    return munge(s);
  }

  lookupZip(zip: string): Location | null {
    const zip5 = zip.trim().substring(0, 5);
    const found = this.zipCache.get(zip5);
    if (found !== undefined) return found;
    const result = this.zipStmt.get(zip5) as ZipRow | undefined;
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

  /** @private */
  private makeZipLocation(result: ZipRow): Location {
    const zip = result.ZipCode;
    const tz = result.TimeZone;
    const tzid = Location.getUsaTzid(result.State, +tz, result.DayLightSaving);
    const cityDescr = `${result.CityMixedCase}, ${result.State} ${zip}`;
    const elevation = result?.Elevation > 0 ? result.Elevation : 0;
    const location = new Location(
      result.Latitude,
      result.Longitude,
      false,
      tzid,
      cityDescr,
      'US',
      zip,
      elevation,
    ) as GeoLocation;
    location.admin1 = location.state = result.State;
    location.stateName = stateNames[location.state];
    location.geo = 'zip';
    location.zip = zip;
    location.population = result.Population;
    return location;
  }

  lookupGeoname(geonameid: number): Location | null {
    geonameid = +geonameid;
    if (!geonameid) return null;
    if (geonameid === 293396) {
      geonameid = 293397;
    }
    const found = this.geonamesCache.get(geonameid);
    if (found !== undefined) return found;
    const result = this.geonamesStmt.get(geonameid) as GeonameRow | undefined;
    if (!result) {
      if (this.logger)
        this.logger.warn(`GeoDb: unknown geonameid=${geonameid}`);
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
   */
  static transliterate(
    source: string,
    options?: Parameters<typeof transliterate>[1],
  ): string {
    return transliterate(source, options);
  }

  /**
   * Builds a city description from geonameid string components
   * @param cityName e.g. 'Tel Aviv' or 'Chicago'
   * @param admin1 e.g. 'England' or 'Massachusetts'
   * @param countryName full country name, e.g. 'Israel' or 'United States'
   */
  static geonameCityDescr(
    cityName: string,
    admin1: string,
    countryName: string,
  ): string {
    if (countryName === 'United States') countryName = 'USA';
    if (countryName === 'United Kingdom') countryName = 'UK';
    let cityDescr = cityName;
    if (countryName !== 'Israel' && admin1 && !admin1.includes(cityName)) {
      const tlitCityName = transliterate(cityName);
      const tlitAdmin1 = transliterate(admin1);
      if (!tlitAdmin1.includes(tlitCityName)) {
        cityDescr += ', ' + admin1;
      }
    }
    if (countryName) {
      cityDescr += ', ' + countryName;
    }
    return cityDescr;
  }

  /** @private */
  private makeGeonameLocation(geonameid: number, result: GeonameRow): Location {
    const country = result.country || '';
    const admin1 = result.admin1 || '';
    const cityDescr = GeoDb.geonameCityDescr(result.name, admin1, country);
    const elevation =
      result?.elevation && result.elevation > 0 ? result.elevation : 0;
    const location = new Location(
      result.latitude,
      result.longitude,
      result.cc === 'IL',
      result.timezone,
      cityDescr,
      result.cc,
      geonameid,
      elevation,
    ) as GeoLocation;
    location.geo = 'geoname';
    location.geonameid = geonameid;
    location.asciiname = result.asciiname;
    if (admin1) {
      location.admin1 = admin1;
    }
    if (result.population) {
      location.population = result.population;
    }
    return location;
  }

  lookupLegacyCity(cityName: string): Location | null {
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

  /** @private */
  private static zipResultToObj(res: ZipRow): AutoComplete {
    const obj: AutoComplete = {
      id: String(res.ZipCode),
      value: `${res.CityMixedCase}, ${res.State} ${res.ZipCode}`,
      admin1: res.State,
      asciiname: res.CityMixedCase,
      country: 'United States',
      cc: 'US',
      latitude: res.Latitude,
      longitude: res.Longitude,
      timezone: Location.getUsaTzid(
        res.State,
        +res.TimeZone,
        res.DayLightSaving,
      ),
      population: res.Population,
      geo: 'zip',
    };
    if (res.Elevation && res.Elevation > 0) {
      obj.elevation = res.Elevation;
    }
    return obj;
  }

  /**
   * Generates autocomplete results based on a query string
   */
  autoComplete(qraw: string, latlong = false): AutoComplete[] {
    qraw = qraw.trim();
    if (qraw.length === 0) {
      return [];
    }
    const firstCharCode = qraw.charCodeAt(0);
    if (firstCharCode >= 48 && firstCharCode <= 57) {
      // special-case PK query instead of full-table scan
      if (GeoDb.is5DigitZip(qraw)) {
        const loc = this.lookupZip(qraw);
        return loc ? [GeoDb.zipLocToAutocomplete(loc)] : [];
      }
      if (!this.zipCompStmt) {
        this.zipCompStmt = this.zipsDb.prepare(ZIP_COMPLETE_SQL);
      }
      // this is a ZIP code prefix, a string with 1-4 digits
      const zipA = qraw.substring(0, 5);
      const zipB =
        zipA === '9' ? 'A' : String(+zipA + 1).padStart(zipA.length, '0');
      return (this.zipCompStmt.all(zipA, zipB) as ZipRow[]).map(
        GeoDb.zipResultToObj,
      );
    } else {
      if (!this.geonamesCompStmt) {
        this.geonamesCompStmt = this.geonamesDb.prepare(GEONAME_COMPLETE_SQL);
      }
      qraw = qraw.replaceAll('"', '""');
      const geoRows0 = this.geonamesCompStmt.all(
        `{longname} : "${qraw}" *`,
      ) as GeonameCompleteRow[];
      const ids = new Set<number>();
      const geoRows: GeonameCompleteRow[] = [];
      for (const row of geoRows0) {
        const id = row.geonameid;
        if (!ids.has(id)) {
          ids.add(id);
          geoRows.push(row);
        }
      }
      const geoMatches = geoRows.map(res => {
        const loc = this.lookupGeoname(res.geonameid)!;
        return this.geonameLocToAutocomplete(loc, res);
      });
      if (!this.zipFulltextCompStmt) {
        this.zipFulltextCompStmt = this.zipsDb.prepare(
          ZIP_FULLTEXT_COMPLETE_SQL,
        );
      }
      const zipRows = this.zipFulltextCompStmt.all(
        `{longname} : "${qraw}" *`,
      ) as {ZipCode: string}[];
      const zipMatches = zipRows.map(res => {
        const loc = this.lookupZip(res.ZipCode)!;
        return GeoDb.zipLocToAutocomplete(loc);
      });
      const values = this.mergeZipGeo(zipMatches, geoMatches);
      values.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
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

  /** @private */
  private geonameLocToAutocomplete(
    loc: Location,
    res: GeonameCompleteRow,
  ): AutoComplete {
    const cc = loc.getCountryCode();
    const country = res.country || this.countryNames.get(cc) || '';
    const admin1 = loc.admin1 || '';
    const obj: AutoComplete = {
      id: res.geonameid,
      value: loc.getName()!,
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

  /** @private */
  private static zipLocToAutocomplete(loc: Location): AutoComplete {
    return {
      id: loc.zip!,
      value: loc.getName()!,
      admin1: loc.admin1,
      asciiname: loc.getShortName()!,
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
   */
  private mergeZipGeo(
    zipMatches: AutoComplete[],
    geoMatches: AutoComplete[],
  ): AutoComplete[] {
    const zlen = zipMatches.length;
    const glen = geoMatches.length;
    if (zlen && !glen) {
      return zipMatches;
    } else if (glen && !zlen) {
      return geoMatches;
    }
    const map = new Map<string, AutoComplete>();
    for (const obj of zipMatches) {
      const key = [obj.asciiname, stateNames[obj.admin1 ?? ''], obj.cc].join(
        '|',
      );
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
  cacheZips(): void {
    const start = Date.now();
    const stmt = this.zipsDb.prepare(ZIPCODE_ALL_SQL);
    const rows = stmt.all() as ZipRow[];
    this.zipCache = new Map(); // replace QuickLRU
    for (const row of rows) {
      const location = this.makeZipLocation(row);
      this.zipCache.set(row.ZipCode, location);
    }
    const end = Date.now();
    if (this.logger)
      this.logger.info(
        `GeoDb: cached ${rows.length} ZIP codes in ${end - start}ms`,
      );
  }

  /** Reads entire geonames database and caches in-memory */
  cacheGeonames(): void {
    const start = Date.now();
    const stmt = this.geonamesDb.prepare(GEONAME_ALL_SQL);
    const rows = stmt.all() as Required<GeonameRow>[];
    this.geonamesCache = new Map(); // replace QuickLRU
    for (const row of rows) {
      const location = this.makeGeonameLocation(row.geonameid, row);
      this.geonamesCache.set(row.geonameid, location);
    }
    const end = Date.now();
    if (this.logger)
      this.logger.info(
        `GeoDb: cached ${rows.length} geonames in ${end - start}ms`,
      );
  }

  /** Returns the version of the GeoDb package */
  static version(): string {
    return version;
  }

  static is5DigitZip(str: string): boolean {
    if (typeof str !== 'string') {
      return false;
    }
    const s = str.trim();
    if (s.length < 5) {
      return false;
    }
    for (let i = 0; i < 5; i++) {
      if (s.charCodeAt(i) > 57 || s.charCodeAt(i) < 48) {
        return false;
      }
    }
    return true;
  }
}
