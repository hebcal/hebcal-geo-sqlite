/* eslint-disable require-jsdoc, max-len */
import Database from 'better-sqlite3';
import path from 'path';

export function makeDummyZipsDb(logger, tmpDir) {
  const testZipsPath = path.join(tmpDir, 'zips.sqlite3');
  logger.info(testZipsPath);
  const zipsDb = new Database(testZipsPath);
  const sqls = [`CREATE TABLE ZIPCodes_Primary (
    ZipCode char(5) NOT NULL PRIMARY KEY,
    CityMixedCase varchar(35) NULL,
    State char(2),
    StateFullName TEXT,
    Latitude decimal(12, 6),
    Longitude decimal(12, 6),
    TimeZone char(2),
    DayLightSaving char(1),
    Population int
    );`,

  `INSERT INTO ZIPCodes_Primary VALUES ('65807','Springfield','MO','Missouri',37.171008,-93.331857,6,'Y',54952);
INSERT INTO ZIPCodes_Primary VALUES ('62704','Springfield','IL','Illinois',39.771921,-89.686047,6,'Y',39831);
INSERT INTO ZIPCodes_Primary VALUES ('11413','Springfield Gardens','NY','New York',40.665415,-73.749702,5,'Y',38912);
INSERT INTO ZIPCodes_Primary VALUES ('01109','Springfield','MA','Massachusetts',42.118748,-72.549032,5,'Y',30250);
INSERT INTO ZIPCodes_Primary VALUES ('01089','West Springfield','MA','Massachusetts',42.125682,-72.641677,5,'Y',28391);
INSERT INTO ZIPCodes_Primary VALUES ('19064','Springfield','PA','Pennsylvania',39.932544,-75.342975,5,'Y',24459);
INSERT INTO ZIPCodes_Primary VALUES ('02901','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02902','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02903','Providence','RI','Rhode Island',41.818167000000006083,-71.409728000000001202,'5','Y',10780);
INSERT INTO ZIPCodes_Primary VALUES ('02904','Providence','RI','Rhode Island',41.854637999999999564,-71.437492000000002434,'5','Y',29359);
INSERT INTO ZIPCodes_Primary VALUES ('02905','Providence','RI','Rhode Island',41.786946000000000367,-71.399191999999995772,'5','Y',25223);
INSERT INTO ZIPCodes_Primary VALUES ('02906','Providence','RI','Rhode Island',41.838150000000000616,-71.393139000000003235,'5','Y',28387);
INSERT INTO ZIPCodes_Primary VALUES ('02907','Providence','RI','Rhode Island',41.795126000000006882,-71.424763999999996144,'5','Y',27445);
INSERT INTO ZIPCodes_Primary VALUES ('02908','Providence','RI','Rhode Island',41.839295999999999153,-71.438804000000004634,'5','Y',37467);
INSERT INTO ZIPCodes_Primary VALUES ('02909','Providence','RI','Rhode Island',41.822232000000001406,-71.448291999999993251,'5','Y',43540);
INSERT INTO ZIPCodes_Primary VALUES ('02912','Providence','RI','Rhode Island',41.826254000000000488,-71.402501999999996584,'5','Y',1370);
INSERT INTO ZIPCodes_Primary VALUES ('02918','Providence','RI','Rhode Island',41.844266000000001071,-71.434915999999999414,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02940','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('27315','Providence','NC','North Carolina',36.500447999999998671,-79.393259999999994391,'5','Y',2243);
INSERT INTO ZIPCodes_Primary VALUES ('42450','Providence','KY','Kentucky',37.391308000000003097,-87.762130999999996561,'6','Y',4063);
INSERT INTO ZIPCodes_Primary VALUES ('84332','Providence','UT','Utah',41.673151999999999972,-111.81449999999999445,'7','Y',7218);
`,
  `CREATE VIRTUAL TABLE ZIPCodes_CityFullText
USING fts4(ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population);`,

  `INSERT INTO ZIPCodes_CityFullText
SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary;`,

  `CREATE VIRTUAL TABLE ZIPCodes_CityFullText5
USING fts5(ZipCode UNINDEXED,CityMixedCase,Population UNINDEXED,longname);`,

  `INSERT INTO ZIPCodes_CityFullText5
SELECT ZipCode,CityMixedCase,Population,
CityMixedCase||', '||State||' '||ZipCode
FROM ZIPCodes_Primary;`,
  ];
  for (const sql of sqls) {
    logger.info(sql);
    zipsDb.exec(sql);
  }
  zipsDb.close();
  return testZipsPath;
}
