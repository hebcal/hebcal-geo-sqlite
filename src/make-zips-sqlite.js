import Database from 'better-sqlite3';
import fs from 'fs';

/**
 * Builds `zips.sqlite3` from the bundled zips-dummy.sql schema file
 * @param {string} dbFilename path to the output SQLite database file
 * @param {string} sqlFile path to the SQL schema file
 */
export function makeZipsSqlite(dbFilename, sqlFile) {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const db = new Database(dbFilename);
  db.exec(sql);
  db.close();
}
