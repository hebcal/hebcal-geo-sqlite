# hebcal-geo-sqlite
Hebcal ES6 interface to GeoNames and USA ZIP code SQLite databases

This package is designed for the hebcal.com and may not be generally reusable.
It requires two separate databases, one made from GeoNames.org data (available
via a Creative Commons license) and a USA ZIP code database (commercial license).

## Installation
```bash
$ npm install @hebcal/geo-sqlite
```

## Synopsis
```js
import {Location} from '@hebcal/core';
import {GeoDb} from '@hebcal/geo-sqlite';
import pino from 'pino';
const logger = pino();

const db = new GeoDb(logger, 'zips.sqlite3', 'geonames.sqlite3');
const loc1 = db.lookupZip('90210'); // Beverly Hills, California
const loc2 = db.lookupGeoname(293397); // Tel Aviv
const loc3 = db.lookupLegacyCity('IL-Netanya');
db.close();
```

## Classes

<dl>
<dt><a href="#GeoDb">GeoDb</a></dt>
<dd><p>Wrapper around sqlite databases</p>
</dd>
</dl>


<a name="GeoDb"></a>

## GeoDb
Wrapper around sqlite databases

**Kind**: global class  

* [GeoDb](#GeoDb)
    * [new GeoDb(logger, zipsFilename, geonamesFilename)](#new_GeoDb_new)
    * [.close()](#GeoDb+close)
    * [.lookupZip(zip)](#GeoDb+lookupZip) ⇒ <code>Location</code>
    * [.lookupGeoname(geonameid)](#GeoDb+lookupGeoname) ⇒ <code>Location</code>
    * [.lookupLegacyCity(cityName)](#GeoDb+lookupLegacyCity) ⇒ <code>Location</code>

<a name="new_GeoDb_new"></a>

### new GeoDb(logger, zipsFilename, geonamesFilename)

| Param | Type |
| --- | --- |
| logger | <code>any</code> | 
| zipsFilename | <code>string</code> | 
| geonamesFilename | <code>string</code> | 

<a name="GeoDb+close"></a>

### geoDb.close()
Closes database handles

**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)  
<a name="GeoDb+lookupZip"></a>

### geoDb.lookupZip(zip) ⇒ <code>Location</code>
**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)  

| Param | Type |
| --- | --- |
| zip | <code>string</code> | 

<a name="GeoDb+lookupGeoname"></a>

### geoDb.lookupGeoname(geonameid) ⇒ <code>Location</code>
**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)  

| Param | Type |
| --- | --- |
| geonameid | <code>number</code> | 

<a name="GeoDb+lookupLegacyCity"></a>

### geoDb.lookupLegacyCity(cityName) ⇒ <code>Location</code>
**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)  

| Param | Type |
| --- | --- |
| cityName | <code>string</code> | 
