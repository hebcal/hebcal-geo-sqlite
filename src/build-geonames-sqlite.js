import Database from 'better-sqlite3';
import pino from 'pino';
import events from 'events';
import fs from 'fs';
import readline from 'readline';

const logger = pino({
  // level: argv.quiet ? 'warn' : 'info',
  prettyPrint: {translateTime: true, ignore: 'pid,hostname'},
});

/**
 * Builds `geonames.sqlite3` from files downloaded from geonames.org
 * @param {string} dbFilename
 * @param {string} countryInfotxt
 * @param {string} cities5000txt
 * @param {string} citiesPatch
 * @param {string} admin1CodesASCIItxt
 * @param {string} ILtxt
 */
export async function buildGeonamesSqlite(
    dbFilename,
    countryInfotxt,
    cities5000txt,
    citiesPatch,
    admin1CodesASCIItxt,
    ILtxt,
) {
  const db = new Database(dbFilename);
  db.pragma('journal_mode = MEMORY');

  doSql(db,
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
  await doFile(db, countryInfotxt, 'country', 19);

  doSql(db,
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

  await doFile(db, cities5000txt, 'geoname', 19);
  await doFile(db, citiesPatch, 'geoname', 19);
  await doFile(db, ILtxt, 'geoname', 19, (a) => {
    return a[6] == 'P' && (a[7] == 'PPL' || a[7] == 'STLMT');
  });

  doSql(db,
      `DROP TABLE IF EXISTS admin1`,

      `CREATE TABLE admin1 (
      key TEXT PRIMARY KEY,
      name nvarchar(200) NOT NULL,
      asciiname nvarchar(200) NOT NULL,
      geonameid int NOT NULL
      );`,
  );

  await doFile(db, admin1CodesASCIItxt, 'admin1', 4);

  // fix inconsistencies with the USA capitol
  doSql(db,
      `UPDATE geoname
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE geonameid = 4140963;`,

      `UPDATE admin1
      SET name = 'Washington, D.C.', asciiname = 'Washington, D.C.'
      WHERE key = 'US.DC';`,
  );

  doSql(db,
      `DROP TABLE IF EXISTS geoname_he`,
      `CREATE TABLE geoname_he AS SELECT * FROM geoname LIMIT 0`,
  );

  await doFile(db, ILtxt, 'geoname_he', 19, filterPlacesHebrew);

  doSql(db,
      `update admin1 set name='',asciiname='' where key like 'PS.%';`,
      `update country set country = '' where iso = 'PS';`,
      `delete from geoname where geonameid = 7303419;`,
  );

  doSql(db,
      `DROP TABLE IF EXISTS geoname_fulltext`,

      `CREATE VIRTUAL TABLE geoname_fulltext
      USING fts3(geonameid int, longname text,
      asciiname text, admin1 text, country text,
      population int, latitude real, longitude real, timezone text
      );
    `,

      `DROP TABLE IF EXISTS geoname_non_ascii`,

      `CREATE TABLE geoname_non_ascii AS
      SELECT geonameid FROM geoname WHERE asciiname <> name`,

      `INSERT INTO geoname_fulltext
      SELECT g.geonameid, g.asciiname||', '||a.asciiname||', '||c.Country,
      g.asciiname, a.asciiname, c.Country,
      g.population, g.latitude, g.longitude, g.timezone
      FROM geoname g, admin1 a, country c
      WHERE g.country = c.ISO
      AND g.country||'.'||g.admin1 = a.key
      `,

      `INSERT INTO geoname_fulltext
      SELECT g.geonameid, g.asciiname||', '||c.Country,
      g.asciiname, '', c.Country,
      g.population, g.latitude, g.longitude, g.timezone
      FROM geoname g, country c
      WHERE g.country = c.ISO
      AND (g.admin1 = '' OR g.admin1 = '00')
      `,

      `INSERT INTO geoname_fulltext
      SELECT g.geonameid, g.name||', '||a.name||', '||c.Country,
      g.name, a.name, c.Country,
      g.population, g.latitude, g.longitude, g.timezone
      FROM geoname_non_ascii gna, geoname g, admin1 a, country c
      WHERE gna.geonameid = g.geonameid
      AND g.country = c.ISO
      AND g.country||'.'||g.admin1 = a.key
      `,

      `INSERT INTO geoname_fulltext
      SELECT g.geonameid, g.name||', ישראל',
      g.name, '', 'ישראל',
      g.population, g.latitude, g.longitude, g.timezone
      FROM geoname_he g, admin1 a, country c
      WHERE g.country = c.ISO
      AND g.country||'.'||g.admin1 = a.key
      `,
  );

  db.close();
  return Promise.resolve(true);
}

/**
 * @param {string[]} a
 * @return {boolean}
 */
function filterPlacesHebrew(a) {
  if (a[6] != 'P' || (a[7] != 'PPL' && a[7] != 'STLMT')) {
    return false;
  }
  const alternatenames = a[3].split(',');
  for (const name of alternatenames) {
    const firstchar = name[0];
    if (firstchar >= '\u05D0' && firstchar <= '\u05EA') {
      a[1] = name; // replace 'name' field with Hebrew
      return true;
    }
  }
  return false;
}

/**
 * @param {Database} db
 * @param  {...string} sqls
 */
function doSql(db, ...sqls) {
  for (let i = 0; i < sqls.length; i++) {
    logger.info(sqls[i]);
    db.exec(sqls[i]);
  }
}

/**
 * @param {Database} db
 * @param {string} infile
 * @param {string} tableName
 * @param {number} expectedFields
 * @param {Function} callback
 */
async function doFile(db, infile, tableName, expectedFields, callback) {
  logger.info(`${infile} => ${tableName}`);
  db.exec('BEGIN');
  let sql = `INSERT OR IGNORE INTO ${tableName} VALUES (?`;
  for (let i = 0; i < expectedFields - 1; i++) {
    sql += ',?';
  }
  sql += ')';
  logger.info(sql);
  const stmt = db.prepare(sql);

  return new Promise((resolve, reject) => {
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
        db.exec('COMMIT');
      });

      return resolve(events.once(rl, 'close'));
    } catch (err) {
      logger.error(err);
      return reject(err);
    }
  });
}
