CREATE TABLE ZIPCodes_Primary (
  ZipCode char(5) NOT NULL PRIMARY KEY,
  CityMixedCase varchar(35) NOT NULL,
  State char(2) NOT NULL,
  Latitude decimal(12, 6) NOT NULL,
  Longitude decimal(12, 6) NOT NULL,
  Elevation int NOT NULL,
  TimeZone char(2) NOT NULL,
  DayLightSaving char(1) NOT NULL,
  Population int NULL
);

INSERT INTO ZIPCodes_Primary VALUES('01109','Springfield','MA',42.118748,-72.549032,209,'5','Y',30968);
INSERT INTO ZIPCodes_Primary VALUES('02906','Providence','RI',41.83815,-71.393139,89,'5','Y',25559);
INSERT INTO ZIPCodes_Primary VALUES('62704','Springfield','IL',39.771921,-89.686047,579,'6','Y',39157);
INSERT INTO ZIPCodes_Primary VALUES('85226','Chandler','AZ',33.266332,-111.943009,1157,'7','N',40689);
INSERT INTO ZIPCodes_Primary VALUES('90210','Beverly Hills','CA',34.103131,-118.416253,719,'8','Y',21134);
INSERT INTO ZIPCodes_Primary VALUES('90035','Los Angeles','CA',34.052107,-118.385271,140,'8','Y',31080);

CREATE VIRTUAL TABLE ZIPCodes_CityFullText5
USING fts5(ZipCode UNINDEXED,CityMixedCase,Population UNINDEXED,longname);

INSERT INTO ZIPCodes_CityFullText5
SELECT ZipCode,CityMixedCase,Population,
CityMixedCase||', '||State||' '||ZipCode
FROM ZIPCodes_Primary;
