# @hebcal/geo-sqlite
Hebcal ES6 interface to GeoNames and USA ZIP code SQLite databases

This package is designed for the hebcal.com and may not be generally reusable.
It requires two separate databases, one made from GeoNames.org data (available
via a Creative Commons license) and a USA ZIP code database (commercial license).

## Installation

Build the databases with one of the two `npx` alternatives below. Both write
`geonames.sqlite3` and `zips.sqlite3` to the current working directory. The
`--package` flag is needed because the command names differ from the package
name; `-y` skips npx's install confirmation prompt.

### Option 1: full databases (downloads from geonames.org)

```bash
npx -y --package=@hebcal/geo-sqlite download-and-make-dbs
```

Downloads `countryInfo.txt`, `admin1CodesASCII.txt`, a cities export, and the
Israel (`IL`) data from [GeoNames.org](https://www.geonames.org/) (requires
network access), then builds the complete `geonames.sqlite3`. The `zips.sqlite3`
file is created from the bundled `zips-dummy.sql` schema and contains no real
ZIP code data (the USA ZIP code database is commercially licensed).

Behavior can be tuned with environment variables:

| Variable     | Default       | Description |
| ------------ | ------------- | ----------- |
| `CITIES`     | `cities1000`  | GeoNames export to download and use as the source of places: `cities500`, `cities1000`, `cities5000`, or `cities15000`. A lower number includes smaller places and produces a larger database. |
| `POPULATION` | `0`           | Minimum population for a place to be included (e.g. `POPULATION=750`). `0` applies no extra filter beyond what `CITIES` already provides. |

For example:

```bash
CITIES=cities500 POPULATION=850 \
 npx -y --package=@hebcal/geo-sqlite download-and-make-dbs
```

### Option 2: test databases (no network access)

```bash
npx -y --package=@hebcal/geo-sqlite make-test-dbs
```

Builds small databases using only fixture data bundled in the package (the ~60
"classic" Hebcal cities, `cities-patch.txt`, and minimal country/admin1 data),
so there are no external network dependencies. Ideal for unit tests and CI.
The `POPULATION` environment variable is honored here too; `CITIES` is not used.

## Synopsis
```js
import {GeoDb} from '@hebcal/geo-sqlite';
import pino from 'pino';
const logger = pino();

// The fourth argument is optional; the values shown are the defaults.
const db = new GeoDb(logger, 'zips.sqlite3', 'geonames.sqlite3', {
  // max entries in the ZIP code LRU cache
  zipsCacheSize: 150,
  // max entries in the geonames LRU cache
  geonamesCacheSize: 750,
  // ms between checks for a replaced geonames file; 0 disables
  geonamesPollInterval: 600000,
});
const loc1 = db.lookupZip('90210'); // Beverly Hills, California
const loc2 = db.lookupGeoname(293397); // Tel Aviv
const loc3 = db.lookupLegacyCity('IL-Netanya');
db.close();
```

## Data attribution

Some location data is incorporated directly into this package, including the
bundled fixtures used by `make-test-dbs` to build test databases (the ~60
"classic" Hebcal cities, `cities-patch.txt`, and related country/admin1 data).
This data is derived from [GeoNames.org](https://www.geonames.org/) and is used
under the
[Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/).
