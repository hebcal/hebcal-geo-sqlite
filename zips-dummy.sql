CREATE TABLE ZIPCodes_Primary (
  ZipCode char(5) NOT NULL PRIMARY KEY,
  CityMixedCase varchar(35) NULL,
  State char(2),
  Latitude decimal(12, 6),
  Longitude decimal(12, 6),
  TimeZone char(2) NULL,
  DayLightSaving char(1) NULL,
  Population int NULL
);

CREATE VIRTUAL TABLE ZIPCodes_CityFullText
USING fts3(ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population);
