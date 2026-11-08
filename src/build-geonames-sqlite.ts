import {DatabaseSync} from 'node:sqlite';
import events from 'node:events';
import fs from 'node:fs';
import readline from 'node:readline';
import {Locale} from '@hebcal/core';
import type {Logger} from 'pino';

/**
 * Options for {@link buildGeonamesSqlite}.
 */
export type BuildGeonamesSqliteOptions = {
  /** Path to the output SQLite database file. */
  dbFilename: string;
  /** Path to countryInfo.txt from geonames.org. */
  countryInfotxt: string;
  /** Path to cities5000.txt (or similar) from geonames.org. */
  cities5000txt: string;
  /** Path to a TSV patch file with additional city rows. */
  citiesPatch: string;
  /** Path to admin1CodesASCII.txt from geonames.org. */
  admin1CodesASCIItxt: string;
  /** Path to IL.txt (Israel geonames) from geonames.org. */
  ILtxt: string;
  /** Path to IL alternate names file from geonames.org. */
  ILalternate: string;
  /** Logger instance (e.g. pino). */
  logger: Logger;
  /** Minimum population filter for PPL feature codes. */
  population?: number;
};

const fcodeKeep: Record<string, boolean> = {
  PPL: true, // populated place: a city, town, village, or other agglomeration of
  PPLA: true, // seat of a first-order administrative division (PPLC takes precedence over PPLA)
  PPLA2: true, // seat of a second-order administrative division
  PPLA3: true, // seat of a third-order administrative division
  PPLA4: true, // seat of a fourth-order administrative division (population >= minPopulation or 1)
  PPLC: true, // capital of a political entity
  // an area similar to a locality but with a small group of dwellings or other buildings
  PPLG: true, // seat of government of a political entity
  PPLL: true, // populated locality
  // cities, towns, villages, or other agglomerations of buildings where people live and work
  PPLS: true, // populated places
  PPLX: true, // section of populated place
  STLMT: true, // israeli settlement
};

/**
 * Builds `geonames.sqlite3` from files downloaded from geonames.org
 */
export async function buildGeonamesSqlite(
  opts: BuildGeonamesSqliteOptions,
): Promise<boolean> {
  const dbFilename = opts.dbFilename;
  const countryInfotxt = opts.countryInfotxt;
  const cities5000txt = opts.cities5000txt;
  const citiesPatch = opts.citiesPatch;
  const admin1CodesASCIItxt = opts.admin1CodesASCIItxt;
  const ILtxt = opts.ILtxt;
  const ILalternate = opts.ILalternate;
  const logger = opts.logger;
  logger.info(`Opening ${dbFilename}`);
  const db = new DatabaseSync(dbFilename);
  db.exec('PRAGMA journal_mode = MEMORY');

  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS country',

    // Only the columns read by consumers are kept (GeoDb, hebcal-api-go,
    // hebcal-web shabbat-browse.js). countryInfo.txt has 19 fields:
    // 0 ISO, 4 Country, 8 Continent.
    `CREATE TABLE country (
      ISO TEXT PRIMARY KEY,
      Country TEXT NOT NULL,
      Continent TEXT NOT NULL
    );`,
  );
  await doFile(logger, db, countryInfotxt, 'country', 19, undefined, [0, 4, 8]);

  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS geoname',

    // Only the columns read by consumers are kept (GeoDb, hebcal-api-go,
    // hebcal-web nearestCity.js and shabbat-browse.js). geonameid is an
    // INTEGER PRIMARY KEY so it aliases the rowid instead of needing a
    // separate unique index. Note that `gtopo30` (not the sparsely populated
    // `elevation` field) is what consumers read as the elevation.
    `CREATE TABLE geoname (
      geonameid INTEGER PRIMARY KEY,
      name nvarchar(200),
      asciiname nvarchar(200),
      latitude decimal(18,15),
      longitude decimal(18,15),
      country nvarchar(2),
      admin1 nvarchar(20),
      population int,
      gtopo30 int,
      timezone nvarchar(40));`,
  );

  // Field indices (of 19) in geonames.org "geoname" dump files for the
  // columns above: geonameid, name, asciiname, latitude, longitude,
  // country code, admin1 code, population, dem (gtopo30), timezone.
  const geonameColumns = [0, 1, 2, 4, 5, 8, 10, 14, 16, 17];
  const minPopulation = opts.population;
  const citiesFilter = (a: string[]): boolean => {
    if (!a[17]) {
      return false; // require a non-empty iana timezone id
    }
    const fcode = a[7];
    logger.debug(`${a[0]} ${a[1]} ${fcode}`);
    if (!fcodeKeep[fcode]) {
      return false;
    }
    const population = Number(a[14]);
    if (fcode === 'PPLA4' && population < (minPopulation || 1)) {
      return false; // also skips thousands of PPLA4 townships/villages with no population data
    }
    if (minPopulation) {
      if (fcode === 'PPL' && population && population < minPopulation) {
        return false;
      }
    }
    return true;
  };
  await doFile(
    logger,
    db,
    cities5000txt,
    'geoname',
    19,
    citiesFilter,
    geonameColumns,
  );
  await doFile(
    logger,
    db,
    citiesPatch,
    'geoname',
    19,
    undefined,
    geonameColumns,
  );
  await doFile(
    logger,
    db,
    ILtxt,
    'geoname',
    19,
    a => a[6] === 'P' && Boolean(fcodeKeep[a[7]]),
    geonameColumns,
  );

  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS admin1',

    // admin1CodesASCII.txt has 4 fields; the 4th (geonameid) is unused.
    `CREATE TABLE admin1 (
      key TEXT PRIMARY KEY,
      name nvarchar(200) NOT NULL,
      asciiname nvarchar(200) NOT NULL
      );`,
  );

  await doFile(
    logger,
    db,
    admin1CodesASCIItxt,
    'admin1',
    4,
    undefined,
    [0, 1, 2],
  );

  // fix inconsistencies with the USA capitol
  doSql(
    logger,
    db,
    `UPDATE geoname
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE geonameid = 4140963;`,

    `UPDATE admin1
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE key = 'US.DC';`,
  );

  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS alternatenames',

    `CREATE TABLE alternatenames (
    id int PRIMARY KEY,
    geonameid int NOT NULL,
    isolanguage varchar(7),
    name varchar(400),
    isPreferredName tinyint,
    isShortName tinyint,
    isColloquial tinyint,
    isHistoric tinyint,
    periodFrom NULL,
    periodTo NULL
    );`,
  );

  await doFile(logger, db, ILalternate, 'alternatenames', 10, a => {
    const firstchar = a[3][0];
    if (a[2] === 'he' && (firstchar < 'א' || firstchar > 'ת')) {
      a[2] = 'en';
    }
    if (a[2] === 'he' || a[2] === 'en') {
      if (a[2] === 'he') {
        a[3] = a[3].replaceAll('‘', '׳');
        a[3] = a[3].replaceAll('’', '׳');
        a[3] = a[3].replaceAll("'", '׳');
        a[3] = Locale.hebrewStripNikkud(a[3]);
      } else {
        a[3] = a[3].replaceAll('‘', "'");
        a[3] = a[3].replaceAll('’', "'");
        a[3] = a[3].replaceAll('Ḥ', 'Ch');
        a[3] = a[3].replaceAll('H̱', 'Ch');
        a[3] = a[3].replaceAll('ẖ', 'ch');
        a[3] = a[3].replaceAll('Ẕ', 'Tz');
        a[3] = a[3].replaceAll('ẕ', 'tz');
        a[3] = a[3].replaceAll('ā', 'a');
        a[3] = a[3].replaceAll('é', 'e');
      }
      return true;
    }
    return false;
  });

  // remove duplicates from alternatenames
  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS altnames',

    `CREATE TABLE altnames
    AS SELECT geonameid, isolanguage, name
    FROM alternatenames
    GROUP BY 1, 2, 3
    `,
  );

  doSql(
    logger,
    db,
    // `update admin1 set name='',asciiname='' where key like 'PS.%';`,
    // `update country set country = '' where iso = 'PS';`,
    "delete from geoname where country = 'PS' and admin1 = 'GZ';",
    'delete from geoname where geonameid = 7303419;',
    "update geoname set country = 'IL' where country = 'PS' and admin1 = 'WE';",
  );

  doSql(
    logger,
    db,
    'DROP TABLE IF EXISTS geoname_fulltext',

    `CREATE VIRTUAL TABLE geoname_fulltext
      USING fts5(geonameid UNINDEXED, longname, population, city, admin1, country);
    `,
    // NOTE: population is never matched against, but don't make it UNINDEXED:
    // FTS5's bm25() normalizes by the total token count across all indexed
    // columns, so doing so changes autocomplete ranking.

    'DROP TABLE IF EXISTS geoname_non_ascii',

    `CREATE TABLE geoname_non_ascii AS
      SELECT geonameid FROM geoname WHERE asciiname <> name`,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.asciiname||', '||a.asciiname||', '||c.Country,
      g.population,
      g.asciiname,a.asciiname,c.Country
      FROM geoname g, admin1 a, country c
      WHERE g.country = c.ISO
      AND g.country <> 'US'
      AND g.country <> 'IL'
      AND g.country <> 'GB'
      AND g.country||'.'||g.admin1 = a.key
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.asciiname||', '||a.asciiname||', USA',
      g.population,
      g.asciiname,a.asciiname,'United States'
      FROM geoname g, admin1 a
      WHERE g.country = 'US'
      AND g.country||'.'||g.admin1 = a.key
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.asciiname||', '||a.asciiname||', UK',
      g.population,
      g.asciiname,a.asciiname,'UK'
      FROM geoname g, admin1 a
      WHERE g.country = 'GB'
      AND g.country||'.'||g.admin1 = a.key
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.asciiname||', Israel',
      g.population,
      g.asciiname,NULL,'Israel'
      FROM geoname g
      WHERE g.country = 'IL'
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.asciiname||', '||c.Country,
      g.population,
      g.asciiname,NULL,c.Country
      FROM geoname g, country c
      WHERE g.country = c.ISO
      AND (g.admin1 = '' OR g.admin1 = '00')
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      g.name||', '||a.name||', '||c.Country,
      g.population,
      g.name,a.name,c.Country
      FROM geoname_non_ascii gna, geoname g, admin1 a, country c
      WHERE gna.geonameid = g.geonameid
      AND g.country = c.ISO
      AND g.country||'.'||g.admin1 = a.key
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      alt.name||', ישראל',
      g.population,
      alt.name,NULL,'ישראל'
      FROM geoname g, altnames alt
      WHERE g.country = 'IL'
      AND alt.isolanguage = 'he'
      AND g.geonameid = alt.geonameid
      `,

    `INSERT INTO geoname_fulltext
      SELECT g.geonameid,
      alt.name||', Israel',
      g.population,
      alt.name,NULL,'Israel'
      FROM geoname g, altnames alt
      WHERE g.country = 'IL'
      AND alt.isolanguage = 'en'
      AND g.geonameid = alt.geonameid
      `,

    "INSERT INTO geoname_fulltext(geoname_fulltext) VALUES('optimize')",

    // scratch tables used only to build geoname_fulltext
    'DROP TABLE alternatenames',
    'DROP TABLE altnames',
    'DROP TABLE geoname_non_ascii',

    'VACUUM',
  );

  return new Promise<boolean>((resolve, reject) => {
    try {
      logger.info(`Closing ${dbFilename}`);
      db.close();
      logger.info('buildGeonamesSqlite finished');
      resolve(true);
    } catch (err) {
      logger.error(err);
      reject(err);
    }
  });
}

function doSql(logger: Logger, db: DatabaseSync, ...sqls: string[]): void {
  for (const sql of sqls) {
    logger.info(sql);
    db.exec(sql);
  }
}

async function doFile(
  logger: Logger,
  db: DatabaseSync,
  infile: string,
  tableName: string,
  expectedFields: number,
  callback?: (a: string[]) => boolean,
  columns?: number[],
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    logger.info(`${infile} => ${tableName}`);
    db.exec('BEGIN');
    const numParams = columns ? columns.length : expectedFields;
    const sql = `INSERT OR IGNORE INTO ${tableName} VALUES (${Array(numParams).fill('?').join(',')})`;
    logger.info(sql);
    const stmt = db.prepare(sql);
    try {
      const rl = readline.createInterface({
        input: fs.createReadStream(infile),
        crlfDelay: Infinity,
      });
      let num = 0;
      let accepted = 0;
      rl.on('line', line => {
        num++;
        if (line.startsWith('#')) {
          return;
        }
        const a = line.split('\t');
        if (a.length !== expectedFields) {
          logger.warn(
            `${infile}:${num}: got ${a.length} fields (expected ${expectedFields})`,
          );
          return;
        }
        if (callback) {
          const accept = callback(a);
          if (!accept) {
            return;
          }
        }
        stmt.run(...(columns ? columns.map(i => a[i]) : a));
        accepted++;
      });

      rl.on('close', () => {
        logger.info(
          `Inserted ${accepted} / ${num} into ${tableName} from ${infile}`,
        );
        db.exec('COMMIT');
      });

      return resolve(events.once(rl, 'close'));
    } catch (err) {
      logger.error(err);
      return reject(err);
    }
  });
}
