import Database from 'better-sqlite3';
import pino from 'pino';
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
 * @param {string} admin1CodesASCIItxt
 * @param {string} ILtxt
 */
export function buildGeonamesSqlite(
    dbFilename,
    countryInfotxt,
    cities5000txt,
    admin1CodesASCIItxt,
    ILtxt,
) {
  const db = new Database(dbFilename);
  const initialSqls = [
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

    `DROP TABLE IF EXISTS admin1`,

    `CREATE TABLE admin1 (
    key TEXT PRIMARY KEY,
    name nvarchar(200) NOT NULL,
    asciiname nvarchar(200) NOT NULL,
    geonameid int NOT NULL
    );`,

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
  ];

  doSql(initialSqls);

  doFile(db, countryInfotxt, 'country', 19);
  doFile(db, cities5000txt, 'geoname', 19);
  doFile(db, admin1CodesASCIItxt, 'admin1', 4);
  doFile(db, ILtxt, 'geoname', 19, (a) => {
    return a[6] == 'P' && (a[7] == 'PPL' || a[7] == 'STLMT');
  });

  doSql(
      `DROP TABLE IF EXISTS geoname_he`,
      `CREATE TABLE geoname_he AS SELECT * FROM geoname LIMIT 0`,
  );

  doFile(db, ILtxt, 'geoname_he', 19, filterPlacesHebrew);

  db.exec('COMMIT');

  doSql(
      `update admin1 set name='',asciiname='' where key like 'PS.%';`,
      `update country set country = '' where iso = 'PS';`,
      `delete from geoname where geonameid = 7303419;`,
  );

  db.exec('COMMIT');

  doSql(
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

  db.exec('COMMIT');
  db.close();
}

/**
 * @param {string[]} a
 * @return {boolean}
 */
function filterPlacesHebrew(a) {
  if (a[6] != 'P' || (a[7] != 'PPL' && a[7] != 'STLMT')) {
    return false;
  }
  alternatenames = a[3].split(',');
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
  for (const sql of sqls) {
    logger.info(sql);
    db.exec(sql);
  }
}

/**
 * @param {Database} db
 * @param {string} infile
 * @param {string} tableName
 * @param {number} expectedFields
 * @param {Function} callback
 */
function doFile(db, infile, tableName, expectedFields, callback) {
  let sql = `INSERT OR IGNORE INTO ${tableName} VALUES (?`;
  for (let i = 0; i < expectedFields - 1; i++) {
    sql += ',?';
  }
  sql += ')';
  logger.info(sql);
  const stmt = db.prepare(sql);

  // eslint-disable-next-line require-jsdoc
  async function processLineByLine() {
    const rl = readline.createInterface({
      input: fs.createReadStream(infile),
    });

    let num = 0;
    for await (const line of rl) {
      num++;
      if (line[0] == '#') {
        continue;
      }
      const a = line.split('\t');
      if (a.length != expectedFields) {
        logger.warn(`${infile}:${num}: got ${a.length} fields (expected ${expectedFields})`);
        continue;
      }
      if (callback) {
        const accept = callback(a);
        if (!accept) {
          continue;
        }
      }
      stmt.run(a);
      if (0 == num % 1000) {
        db.exec('COMMIT');
      }
    }
    rl.close();
  }

  processLineByLine();
  db.exec('COMMIT');
}
