import {Location} from '@hebcal/core';

export type AutoComplete = {
    id: number | string;
    value: string;
    geo: 'geoname' | 'zip';
    name?: string;
    asciiname?: string;
    admin1?: string;
    country?: string;
    cc?: string;
    population?: number;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    elevation?: number;
};

/**
 * Options for configuring the GeoDb constructor.
 */
export type GeoDbOptions = {
    /** Maximum number of entries in the ZIP code LRU cache. Default is 150. */
    zipsCacheSize?: number;
    /** Maximum number of entries in the geonames LRU cache. Default is 750. */
    geonamesCacheSize?: number;
};

/**
 * Options for `buildGeonamesSqlite`.
 */
export type BuildGeonamesSqliteOptions = {
    /** Path to the output SQLite database file. */
    dbFilename: string;
    /** Path to countryInfo.txt from geonames.org. */
    countryInfotxt: string;
    /** Path to cities5000.txt (or similar) from geonames.org. */
    cities5000txt: string;
    /** Path to a TSV patch file with additional city rows. */
    citiesPatch: string;
    /** Path to admin1CodesASCII.txt from geonames.org. */
    admin1CodesASCIItxt: string;
    /** Path to IL.txt (Israel geonames) from geonames.org. */
    ILtxt: string;
    /** Path to IL alternate names file from geonames.org. */
    ILalternate: string;
    /** Logger instance (e.g. pino). */
    logger: any;
    /** Minimum population filter for PPL feature codes. */
    population?: number;
};

/**
 * Wrapper around SQLite databases for looking up geographic locations
 * by ZIP code, geoname ID, or legacy Hebcal city name.
 */
export class GeoDb {
    /**
     * Opens the ZIP code and geonames SQLite databases.
     * @param logger - Logger instance (e.g. pino), or `null` to disable logging
     * @param zipsFilename - Path to the ZIP codes SQLite database file
     * @param geonamesFilename - Path to the geonames SQLite database file
     * @param options - Optional cache size configuration
     */
    constructor(logger: any, zipsFilename: string, geonamesFilename: string, options?: GeoDbOptions);

    /** Closes both database handles. */
    close(): void;

    /**
     * Looks up a US ZIP code and returns the corresponding location.
     * @param zip - 5-digit US ZIP code (leading zeros preserved as string)
     * @returns The location, or `null` if not found
     */
    lookupZip(zip: string): Location;

    /**
     * Looks up a geonames.org ID and returns the corresponding location.
     * @param geonameid - Numeric geoname ID from geonames.org
     * @returns The location, or `null` if not found
     */
    lookupGeoname(geonameid: number): Location;

    /**
     * Looks up a legacy Hebcal city name (e.g. "Jerusalem" or "New York")
     * and returns the corresponding location.
     * @param cityName - Legacy city name string
     * @returns The location, or `null` if not found
     */
    lookupLegacyCity(cityName: string): Location;

    /**
     * Generates autocomplete suggestions for a query string.
     * Numeric queries search ZIP codes; alphabetic queries search geonames
     * and ZIP city names via full-text search.
     * @param qraw - Raw query string from user input
     * @param latlong - If `true`, include latitude, longitude, timezone, and population in results
     * @returns Array of autocomplete suggestion objects, sorted by population
     */
    autoComplete(qraw: string, latlong?: boolean): AutoComplete[];

    /**
     * Reads the entire ZIP code database into an in-memory cache,
     * replacing the default LRU cache. Useful for high-throughput servers.
     */
    cacheZips(): void;

    /**
     * Reads the entire geonames database into an in-memory cache,
     * replacing the default LRU cache. Useful for high-throughput servers.
     */
    cacheGeonames(): void;

    /**
     * Returns the version string of the `@hebcal/geo-sqlite` package.
     */
    static version(): string;

    /**
     * Tests whether the given string begins with exactly 5 ASCII digits
     * (a valid US ZIP code format).
     * @param str - String to test
     * @returns `true` if the string starts with 5 digits
     */
    static is5DigitZip(str: string): boolean;

    /**
     * Convenience wrapper around the `transliterate` function from the
     * `transliteration` npm package. Converts Unicode text to ASCII.
     * @param source - String to transliterate
     * @param options - Options passed to the underlying `transliterate` function
     * @returns Transliterated ASCII string
     */
    static transliterate(source: string, options?: any): string;

    /**
     * Builds a display string for a city from its name components.
     * Applies special formatting for US ("USA") and UK ("UK") country names,
     * and omits the admin1 subdivision when it duplicates the city name.
     * @param cityName - City name, e.g. "Tel Aviv" or "Chicago"
     * @param admin1 - First-level administrative subdivision, e.g. "Illinois"
     * @param countryName - Full country name, e.g. "United States" or "Israel"
     * @returns Formatted city description, e.g. "Chicago, Illinois, USA"
     */
    static geonameCityDescr(cityName: string, admin1: string, countryName: string): string;
}

/**
 * Builds the `geonames.sqlite3` database from raw text files
 * downloaded from geonames.org.
 * @param opts - Paths to input files and configuration
 * @returns Resolves when the database has been built and closed
 */
export function buildGeonamesSqlite(opts: BuildGeonamesSqliteOptions): Promise<boolean>;

/**
 * Builds the `zips.sqlite3` database from a bundled SQL schema file.
 * @param dbFilename - Path to the output SQLite database file
 * @param sqlFile - Path to the SQL schema file to execute
 */
export function makeZipsSqlite(dbFilename: string, sqlFile: string): void;
