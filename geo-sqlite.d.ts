/// <reference types="node"/>

import {Location} from '@hebcal/core';

declare module '@hebcal/geo-sqlite' {
    export type AutoComplete = {
        id: number | string;
        value: string;
        geo: 'geoname' | 'zip';
        asciiname: string;
        admin1?: string;
        country?: string;
        population?: number;
        latitude?: number;
        longitude?: number;
        timezone?: string;
    };
    export class GeoDb {
        constructor(logger: any, zipsFilename: string, geonamesFilename: string);
        close(): void;
        lookupZip(zip: string): Location;
        lookupGeoname(geonameid: number): Location;
        lookupLegacyCity(cityName: string): Location;
        autoComplete(qraw: string, latlong?: boolean): AutoComplete[];
        cacheZips(): void;
        cacheGeonames(): void;
    }
}
