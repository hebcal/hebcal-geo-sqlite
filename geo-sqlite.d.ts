/// <reference types="node"/>

import {Location} from '@hebcal/core';

declare module '@hebcal/geo-sqlite' {
    export class GeoDb {
        constructor(logger: any, zipsFilename: string, geonamesFilename: string);
        close(): void;
        lookupZip(zip: string): Location;
        lookupGeoname(geonameid: number): Location;
        lookupLegacyCity(cityName: string): Location;
        autoComplete(qraw: string): Object[];
    }
}
