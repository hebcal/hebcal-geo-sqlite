CREATE TABLE ZIPCodes_Primary (
  ZipCode char(5) NOT NULL PRIMARY KEY,
  CityMixedCase varchar(35) NULL,
  State char(2),
  Latitude decimal(12, 6),
  Longitude decimal(12, 6),
  Elevation int NULL,
  TimeZone char(2) NULL,
  DayLightSaving char(1) NULL,
  Population int NULL
);

CREATE VIRTUAL TABLE ZIPCodes_CityFullText
USING fts4(ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population);

CREATE VIRTUAL TABLE ZIPCodes_CityFullText5
USING fts5(ZipCode UNINDEXED,CityMixedCase,Population UNINDEXED,longname);
