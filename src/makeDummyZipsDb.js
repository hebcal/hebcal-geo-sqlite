/* eslint-disable require-jsdoc, max-len */
import Database from 'better-sqlite3';
import path from 'path';

/*
.mode insert ZIPCodes_Primary

SELECT ZipCode,CityMixedCase,State,StateFullName,Latitude,Longitude,Elevation,
TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary
WHERE ZipCode IN (
'65807',
'62704',
'11413',
'01109',
'01089',
'19064',
'02901',
'02902',
'02903',
'02904',
'02905',
'02906',
'02907',
'02908',
'02909',
'02912',
'02918',
'02940',
'27315',
'42450',
'84332'
);
*/
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
    Elevation int,
    TimeZone char(2),
    DayLightSaving char(1),
    Population int
    );`,

  `INSERT INTO ZIPCodes_Primary VALUES('01089','West Springfield','MA','Massachusetts',42.125681999999997628,-72.641676999999997832,179,'5','Y',28835);
INSERT INTO ZIPCodes_Primary VALUES('01109','Springfield','MA','Massachusetts',42.118747999999994746,-72.549031999999993303,209,'5','Y',30968);
INSERT INTO ZIPCodes_Primary VALUES('02901','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,9,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES('02902','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,9,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES('02903','Providence','RI','Rhode Island',41.818167000000006083,-71.409728000000001202,26,'5','Y',13264);
INSERT INTO ZIPCodes_Primary VALUES('02904','Providence','RI','Rhode Island',41.854637999999999564,-71.437492000000002434,75,'5','Y',31542);
INSERT INTO ZIPCodes_Primary VALUES('02905','Providence','RI','Rhode Island',41.786946000000000367,-71.399191999999995772,58,'5','Y',26334);
INSERT INTO ZIPCodes_Primary VALUES('02906','Providence','RI','Rhode Island',41.838150000000000616,-71.393139000000003235,89,'5','Y',25559);
INSERT INTO ZIPCodes_Primary VALUES('02907','Providence','RI','Rhode Island',41.795126000000006882,-71.424763999999996144,61,'5','Y',29827);
INSERT INTO ZIPCodes_Primary VALUES('02908','Providence','RI','Rhode Island',41.839295999999999153,-71.438804000000004634,120,'5','Y',38507);
INSERT INTO ZIPCodes_Primary VALUES('02909','Providence','RI','Rhode Island',41.822232000000001406,-71.448291999999993251,89,'5','Y',46119);
INSERT INTO ZIPCodes_Primary VALUES('02912','Providence','RI','Rhode Island',41.826254000000000488,-71.402501999999996584,118,'5','Y',4739);
INSERT INTO ZIPCodes_Primary VALUES('02918','Providence','RI','Rhode Island',41.844266000000001071,-71.434915999999999414,185,'5','Y',3125);
INSERT INTO ZIPCodes_Primary VALUES('02940','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,9,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES('11413','Springfield Gardens','NY','New York',40.665415000000004752,-73.749701999999999202,13,'5','Y',42978);
INSERT INTO ZIPCodes_Primary VALUES('19064','Springfield','PA','Pennsylvania',39.932544000000000039,-75.342974999999992036,270,'5','Y',25045);
INSERT INTO ZIPCodes_Primary VALUES('27315','Providence','NC','North Carolina',36.500447999999998671,-79.393259999999994391,474,'5','Y',1892);
INSERT INTO ZIPCodes_Primary VALUES('42450','Providence','KY','Kentucky',37.391308000000003097,-87.762130999999996561,416,'6','Y',3909);
INSERT INTO ZIPCodes_Primary VALUES('62704','Springfield','IL','Illinois',39.771920999999998969,-89.686047000000002071,579,'6','Y',39157);
INSERT INTO ZIPCodes_Primary VALUES('65807','Springfield','MO','Missouri',37.171007999999998716,-93.331856999999995849,1239,'6','Y',55168);
INSERT INTO ZIPCodes_Primary VALUES('84332','Providence','UT','Utah',41.673151999999999972,-111.81449999999999445,4650,'7','Y',8238);
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
