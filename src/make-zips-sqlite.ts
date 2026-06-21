import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';

/**
 * Builds `zips.sqlite3` from the bundled zips-dummy.sql schema file
 * @param dbFilename path to the output SQLite database file
 * @param sqlFile path to the SQL schema file
 */
export function makeZipsSqlite(dbFilename: string, sqlFile: string): void {
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const db = new DatabaseSync(dbFilename);
  console.log(sql);
  db.exec(sql);
  db.close();
}
