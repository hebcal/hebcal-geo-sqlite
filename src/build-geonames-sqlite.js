import Database from 'better-sqlite3';
import events from 'events';
import fs from 'fs';
import readline from 'readline';
import {Locale} from '@hebcal/core';

const fcodeKeep = {
  PPL: true,   // populated place a city, town, village, or other agglomeration of
  PPLA: true,  // seat of a first-order administrative division seat of a first-order administrative division (PPLC takes precedence over PPLA)
  PPLA2: true, // seat of a second-order administrative division
  PPLA3: true, // seat of a third-order administrative division
  PPLC: true,  // capital of a political entity
  PPLL: true,  // populated locality an area similar to a locality but with a small
  PPLX: true,  // section of populated place
  STLMT: true, // israeli settlement
};

/**
 * Builds `geonames.sqlite3` from files downloaded from geonames.org
 * @param {any} opts
 */
export async function buildGeonamesSqlite(opts) {
  const dbFilename = opts.dbFilename;
  const countryInfotxt = opts.countryInfotxt;
  const cities5000txt = opts.cities5000txt;
  const citiesPatch = opts.citiesPatch;
  const admin1CodesASCIItxt = opts.admin1CodesASCIItxt;
  const ILtxt = opts.ILtxt;
  const ILalternate = opts.ILalternate;
  const logger = opts.logger;
  logger.info(`Opening ${dbFilename}`);
  const db = new Database(dbFilename);
  db.pragma('journal_mode = MEMORY');

  doSql(logger, db,
      `DROP TABLE IF EXISTS country`,

      `CREATE TABLE country (
      ISO TEXT PRIMARY KEY,
      ISO3 TEXT NOT NULL,
      IsoNumeric TEXT NOT NULL,
      fips TEXT NOT NULL,
      Country TEXT NOT NULL,
      Capital TEXT NOT NULL,
      Area INT NOT NULL,
      Population INT NOT NULL,
      Continent TEXT NOT NULL,
      tld TEXT NOT NULL,
      CurrencyCode TEXT NOT NULL,
      CurrencyName TEXT NOT NULL,
      Phone TEXT NOT NULL,
      PostalCodeFormat TEXT,
      PostalCodeRegex TEXT,
      Languages TEXT NOT NULL,
      geonameid INT NOT NULL,
      neighbours TEXT NOT NULL,
      EquivalentFipsCode TEXT NOT NULL
    );`,
  );
  await doFile(logger, db, countryInfotxt, 'country', 19);

  doSql(logger, db,
      `DROP TABLE IF EXISTS geoname`,

      `CREATE TABLE geoname (
      geonameid int PRIMARY KEY,
      name nvarchar(200),
      asciiname nvarchar(200),
      alternatenames nvarchar(4000),
      latitude decimal(18,15),
      longitude decimal(18,15),
      fclass nchar(1),
      fcode nvarchar(10),
      country nvarchar(2),
      cc2 nvarchar(60),
      admin1 nvarchar(20),
      admin2 nvarchar(80),
      admin3 nvarchar(20),
      admin4 nvarchar(20),
      population int,
      elevation int,
      gtopo30 int,
      timezone nvarchar(40),
      moddate date);`,
  );

  const truncateAlternateNames = (a) => {
    a[3] = '';
    return true;
  };
  const minPopulation = opts.population;
  const citiesFilter = (a) => {
    const fcode = a[7];
    console.log(a[0], a[1], fcode);
    if (!fcodeKeep[fcode]) {
      return false;
    }
    if (minPopulation) {
      const population = a[14];
      if (fcode === 'PPL' && population && population < minPopulation) {
        return false;
      }
    }
    a[3] = '';
    return true;
  };
  await doFile(logger, db, cities5000txt, 'geoname', 19, citiesFilter);
  await doFile(logger, db, citiesPatch, 'geoname', 19, truncateAlternateNames);
  await doFile(logger, db, ILtxt, 'geoname', 19, (a) => {
    a[3] = '';
    return a[6] == 'P' && fcodeKeep[a[7]];
  });

  doSql(logger, db,
      `DROP TABLE IF EXISTS admin1`,

      `CREATE TABLE admin1 (
      key TEXT PRIMARY KEY,
      name nvarchar(200) NOT NULL,
      asciiname nvarchar(200) NOT NULL,
      geonameid int NOT NULL
      );`,
  );

  await doFile(logger, db, admin1CodesASCIItxt, 'admin1', 4);

  // fix inconsistencies with the USA capitol
  doSql(logger, db,
      `UPDATE geoname
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE geonameid = 4140963;`,

      `UPDATE admin1
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE key = 'US.DC';`,
  );

  doSql(logger, db,
      `DROP TABLE IF EXISTS alternatenames`,

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

  await doFile(logger, db, ILalternate, 'alternatenames', 10, (a) => {
    const firstchar = a[3][0];
    if (a[2] === 'he' && (firstchar < '\u05D0' || firstchar > '\u05EA')) {
      a[2] = 'en';
    }
    if (a[2] === 'he' || a[2] === 'en') {
      if (a[2] === 'he') {
        a[3] = a[3].replace(/‘/g, '׳');
        a[3] = a[3].replace(/’/g, '׳');
        a[3] = a[3].replace(/'/g, '׳');
        a[3] = Locale.hebrewStripNikkud(a[3]);
      } else {
        a[3] = a[3].replace(/‘/g, '\'');
        a[3] = a[3].replace(/’/g, '\'');
        a[3] = a[3].replace(/Ḥ/g, 'Ch');
        a[3] = a[3].replace(/H̱/g, 'Ch');
        a[3] = a[3].replace(/ẖ/g, 'ch');
        a[3] = a[3].replace(/Ẕ/g, 'Tz');
        a[3] = a[3].replace(/ẕ/g, 'tz');
        a[3] = a[3].replace(/ā/g, 'a');
        a[3] = a[3].replace(/é/g, 'e');
      }
      return true;
    }
    return false;
  });

  // remove duplicates from alternatenames
  doSql(logger, db,
      `DROP TABLE IF EXISTS altnames`,

      `CREATE TABLE altnames
    AS SELECT geonameid, isolanguage, name
    FROM alternatenames
    GROUP BY 1, 2, 3
    `,
  );

  doSql(logger, db,
      // `update admin1 set name='',asciiname='' where key like 'PS.%';`,
      // `update country set country = '' where iso = 'PS';`,
      `delete from geoname where country = 'PS' and admin1 = 'GZ';`,
      `delete from geoname where geonameid = 7303419;`,
      `update geoname set country = 'IL' where country = 'PS' and admin1 = 'WE';`,
  );

  doSql(logger, db,
      `DROP TABLE IF EXISTS geoname_fulltext`,

      `CREATE VIRTUAL TABLE geoname_fulltext
      USING fts5(geonameid UNINDEXED, longname, population, city, admin1, country);
    `,

      `DROP TABLE IF EXISTS geoname_non_ascii`,

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

      'VACUUM',
  );

  return new Promise((resolve, reject) => {
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

/**
 * @param {pino.Logger} logger
 * @param {Database} db
 * @param  {...string} sqls
 */
function doSql(logger, db, ...sqls) {
  for (let i = 0; i < sqls.length; i++) {
    logger.info(sqls[i]);
    db.exec(sqls[i]);
  }
}

/**
 * @param {pino.Logger} logger
 * @param {Database} db
 * @param {string} infile
 * @param {string} tableName
 * @param {number} expectedFields
 * @param {Function} callback
 */
async function doFile(logger, db, infile, tableName, expectedFields, callback) {
  return new Promise((resolve, reject) => {
    logger.info(`${infile} => ${tableName}`);
    db.exec('BEGIN');
    let sql = `INSERT OR IGNORE INTO ${tableName} VALUES (?`;
    for (let i = 0; i < expectedFields - 1; i++) {
      sql += ',?';
    }
    sql += ')';
    logger.info(sql);
    let stmt = db.prepare(sql);
    try {
      const rl = readline.createInterface({
        input: fs.createReadStream(infile),
        crlfDelay: Infinity,
      });
      let num = 0;
      let accepted = 0;
      rl.on('line', (line) => {
        num++;
        if (line[0] == '#') {
          return;
        }
        const a = line.split('\t');
        if (a.length != expectedFields) {
          logger.warn(`${infile}:${num}: got ${a.length} fields (expected ${expectedFields})`);
          return;
        }
        if (callback) {
          const accept = callback(a);
          if (!accept) {
            return;
          }
        }
        stmt.run(a);
        accepted++;
      });

      rl.on('close', () => {
        logger.info(`Inserted ${accepted} / ${num} into ${tableName} from ${infile}`);
        stmt = null;
        db.exec('COMMIT');
      });

      return resolve(events.once(rl, 'close'));
    } catch (err) {
      logger.error(err);
      return reject(err);
    }
  });
}
