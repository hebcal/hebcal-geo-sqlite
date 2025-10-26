# hebcal-geo-sqlite
Hebcal ES6 interface to GeoNames and USA ZIP code SQLite databases

This package is designed for the hebcal.com and may not be generally reusable.
It requires two separate databases, one made from GeoNames.org data (available
via a Creative Commons license) and a USA ZIP code database (commercial license).

## Installation
```bash
$ npm install @hebcal/geo-sqlite
$ ./node_modules/.bin/download-and-make-dbs
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

## Functions

<dl>
<dt><a href="#buildGeonamesSqlite">buildGeonamesSqlite(opts)</a></dt>
<dd><p>Builds <code>geonames.sqlite3</code> from files downloaded from geonames.org</p>
</dd>
<dt><a href="#doSql">doSql(logger, db, ...sqls)</a></dt>
<dd></dd>
<dt><a href="#doFile">doFile(logger, db, infile, tableName, expectedFields, callback)</a></dt>
<dd></dd>
</dl>

<a name="GeoDb"></a>

## GeoDb
Wrapper around sqlite databases

**Kind**: global class

* [GeoDb](#GeoDb)
    * [new GeoDb(logger, zipsFilename, geonamesFilename)](#new_GeoDb_new)
    * _instance_
        * [.zipCache](#GeoDb+zipCache) : <code>Map.&lt;string, Location&gt;</code>
        * [.geonamesCache](#GeoDb+geonamesCache) : <code>Map.&lt;number, Location&gt;</code>
        * [.legacyCities](#GeoDb+legacyCities) : <code>Map.&lt;string, number&gt;</code>
        * [.countryNames](#GeoDb+countryNames) : <code>Map.&lt;string, string&gt;</code>
        * [.close()](#GeoDb+close)
        * [.lookupZip(zip)](#GeoDb+lookupZip) ⇒ <code>Location</code>
        * [.lookupGeoname(geonameid)](#GeoDb+lookupGeoname) ⇒ <code>Location</code>
        * [.lookupLegacyCity(cityName)](#GeoDb+lookupLegacyCity) ⇒ <code>Location</code>
        * [.autoComplete(qraw, latlong)](#GeoDb+autoComplete) ⇒ <code>Array.&lt;Object&gt;</code>
        * [.cacheZips()](#GeoDb+cacheZips)
        * [.cacheGeonames()](#GeoDb+cacheGeonames)
    * _static_
        * [.transliterate(source, [options])](#GeoDb.transliterate) ⇒ <code>string</code>
        * [.geonameCityDescr(cityName, admin1, countryName)](#GeoDb.geonameCityDescr) ⇒ <code>string</code>
        * [.version()](#GeoDb.version)

<a name="new_GeoDb_new"></a>

### new GeoDb(logger, zipsFilename, geonamesFilename)

| Param | Type |
| --- | --- |
| logger | <code>any</code> |
| zipsFilename | <code>string</code> |
| geonamesFilename | <code>string</code> |

<a name="GeoDb+zipCache"></a>

### geoDb.zipCache : <code>Map.&lt;string, Location&gt;</code>
**Kind**: instance property of [<code>GeoDb</code>](#GeoDb)
<a name="GeoDb+geonamesCache"></a>

### geoDb.geonamesCache : <code>Map.&lt;number, Location&gt;</code>
**Kind**: instance property of [<code>GeoDb</code>](#GeoDb)
<a name="GeoDb+legacyCities"></a>

### geoDb.legacyCities : <code>Map.&lt;string, number&gt;</code>
**Kind**: instance property of [<code>GeoDb</code>](#GeoDb)
<a name="GeoDb+countryNames"></a>

### geoDb.countryNames : <code>Map.&lt;string, string&gt;</code>
**Kind**: instance property of [<code>GeoDb</code>](#GeoDb)
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

<a name="GeoDb+autoComplete"></a>

### geoDb.autoComplete(qraw, latlong) ⇒ <code>Array.&lt;Object&gt;</code>
Generates autocomplete results based on a query string

**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)

| Param | Type | Default |
| --- | --- | --- |
| qraw | <code>string</code> |  |
| latlong | <code>boolean</code> | <code>false</code> |

<a name="GeoDb+cacheZips"></a>

### geoDb.cacheZips()
Reads entire ZIP database and caches in-memory

**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)
<a name="GeoDb+cacheGeonames"></a>

### geoDb.cacheGeonames()
Reads entire geonames database and caches in-memory

**Kind**: instance method of [<code>GeoDb</code>](#GeoDb)
<a name="GeoDb.transliterate"></a>

### GeoDb.transliterate(source, [options]) ⇒ <code>string</code>
Convenience wrapper of the `transliterate` function from `transliteration` npm package.
Transliterate the string `source` and return the result.

**Kind**: static method of [<code>GeoDb</code>](#GeoDb)

| Param | Type |
| --- | --- |
| source | <code>string</code> |
| [options] | <code>any</code> |

<a name="GeoDb.geonameCityDescr"></a>

### GeoDb.geonameCityDescr(cityName, admin1, countryName) ⇒ <code>string</code>
Builds a city description from geonameid string components

**Kind**: static method of [<code>GeoDb</code>](#GeoDb)

| Param | Type | Description |
| --- | --- | --- |
| cityName | <code>string</code> | e.g. 'Tel Aviv' or 'Chicago' |
| admin1 | <code>string</code> | e.g. 'England' or 'Massachusetts' |
| countryName | <code>string</code> | full country name, e.g. 'Israel' or 'United States' |

<a name="GeoDb.version"></a>

### GeoDb.version()
Returns the version of the GeoDb package

**Kind**: static method of [<code>GeoDb</code>](#GeoDb)
<a name="buildGeonamesSqlite"></a>

## buildGeonamesSqlite(opts)
Builds `geonames.sqlite3` from files downloaded from geonames.org

**Kind**: global function

| Param | Type |
| --- | --- |
| opts | <code>any</code> |

<a name="doSql"></a>

## doSql(logger, db, ...sqls)
**Kind**: global function

| Param | Type |
| --- | --- |
| logger | <code>pino.Logger</code> |
| db | <code>Database</code> |
| ...sqls | <code>string</code> |

<a name="doFile"></a>

## doFile(logger, db, infile, tableName, expectedFields, callback)
**Kind**: global function

| Param | Type |
| --- | --- |
| logger | <code>pino.Logger</code> |
| db | <code>Database</code> |
| infile | <code>string</code> |
| tableName | <code>string</code> |
| expectedFields | <code>number</code> |
| callback | <code>function</code> |
