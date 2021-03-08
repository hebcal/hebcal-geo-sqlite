/* eslint-disable max-len */
import test from 'ava';
import {Location} from '@hebcal/core';
import {GeoDb} from './geodb';
import {buildGeonamesSqlite} from './build-geonames-sqlite';
import Database from 'better-sqlite3';
import os from 'os';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import legacyCities from './legacy.json';

test.before(async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hebcal-test-'));
  const testZipsPath = path.join(tmpDir, 'zips.sqlite3');
  const zipsDb = new Database(testZipsPath);
  const sql = `CREATE TABLE ZIPCodes_Primary (
    ZipCode char(5) NOT NULL PRIMARY KEY,
    CityMixedCase varchar(35) NULL,
    State char(2),
    Latitude decimal(12, 6),
    Longitude decimal(12, 6),
    TimeZone char(2) NULL,
    DayLightSaving char(1) NULL,
    Elevation int NULL
    );

    INSERT INTO ZIPCodes_Primary VALUES ('02912', 'Providence', 'RI', 41.826254, -71.402502, 5, 'Y', 11);
  `;
  zipsDb.exec(sql);
  zipsDb.close();

  const ciPath = path.join(tmpDir, 'test-countryInfo.txt');
  const ciStr =
`IL\tISR\t376\tIS\tIsrael\tJerusalem\t20770\t8883800\tAS\t.il\tILS\tShekel\t972\t#######\t^(\d{7}|\d{5})$\the,ar-IL,en-IL,\t294640\tSY,JO,LB,EG,PS\t
US\tUSA\t840\tUS\tUnited States\tWashington\t9629091\t327167434\tNA\t.us\tUSD\tDollar\t1\t#####-####\t^\d{5}(-\d{4})?$\ten-US,es-US,haw,fr\t6252001\tCA,MX,CU\t
AX\tALA\t248\t\tAland Islands\tMariehamn\t1580\t26711\tEU\t.ax\tEUR\tEuro\t+358-18\t#####\t^(?:FI)*(\d{5})$\tsv-AX\t661882\t\tFI
`;
  fs.writeFileSync(ciPath, ciStr);
  const a1path = path.join(tmpDir, 'test-admin1CodesASCII.txt');
  const a1str = `US.AR\tArkansas\tArkansas\t4099753\nUS.DC\tWashington, D.C.\tWashington, D.C.\t4138106\nUS.DE\tDelaware\tDelaware\t4142224\nUS.FL\tFlorida\tFlorida\t4155751
IL.06\tJerusalem\tJerusalem\t293198
IL.05\tTel Aviv\tTel Aviv\t293396
IL.04\tHaifa\tHaifa\t294800
IL.03\tNorthern District\tNorthern District\t294824
IL.02\tCentral District\tCentral District\t294904
IL.01\tSouthern District\tSouthern District\t294952`;
  fs.writeFileSync(a1path, a1str);
  const c5path = path.join(tmpDir, 'test-cities5000.txt');
  const c5str =
`293397\tTel Aviv\tTel Aviv\tLungsod ng Tel Aviv-Yafo,TLV,Tehl'-Aviu,Tel Avevs,Tel Aviv,Tel Aviv Yaffo,Tel Aviv Yafo,Tel Aviv-Jaffa,Tel Aviv-Jafo,Tel Aviv-Yafo,Tel Avivas,Tel Avív,Tel Avėvs,Tel Awiw,Tel Eviv,Tel'-Aviv,Tel-Aviv,Tel-Avivo,Tel-aviv,Tel-Əviv,Telaviva,Telavivum,Tell Abib,Tell Abīb,Tell Afif,te la wei fu,tel aviv,tel-abibeu,tel-avivi,tela abhibha,tela abhiva,tela aviva,tela'abiba,tel־ʼabiyb-yapwo,teruabibu,thel xa wif,tl abyb,tl abyb yafa,tl alrbyʿ,tl avyv,tl awyw,tl awyw yafw,tl ʼbyb,tlawyw,tl‌awyw,tl‌awyw yafw,tێl yەvyv,Τελ Αβίβ,Тел Авив,Тел-Авив,Тель-Авив,Тель-Авів,Тэль-Авіў,Թել Ավիվ,תֵּל־אָבִיב–יָפוֹ,תל אביב,תל אביב-יפו,تل آویو,تل آویو یافو,تل آڤیڤ,تل أبيب,تل أبيب يافا,تل ابيب,تل ابیب,تل الربيع,تل اویو,تل اویو یافو,تلاویو,تل‌آویو,تل‌آویو یافو,تل‌اویو,تل‌اویو یافو,تێل ئەڤیڤ,تېلاۋىف,ܬܠ ܐܒܝܒ,तेल अभिव,तेल अविव,तेल अवीव,তেল আভিভ,তেলআবিব,டெல் அவீவ்,ടെൽ അവീവ്,เทลอาวีฟ,თელ-ავივი,ቴል አቪቭ,テルアビブ,特拉維夫,特拉维夫,텔아비브\t32.08088\t34.78057\tP\tPPLA\tIL\t\t05\t\t\t\t432892\t\t15\tAsia/Jerusalem\t2020-05-28
4140963\tWashington\tWashington\tDistrict of Columbia,Federal Capital,Federal City,Federal Town,Nations Capital,Ouasinkton,Ranatakariahshne,Ranatakariáhshne,Rome,Territory of Columbia,Vashington,Vasingtonas,Vasingtonia,Vašingtonas,WAS,Washington,Washington City,Washington D. C.,Washington D.C.,Washington DC,Waszyngton,hua sheng dun te qu,wosingteon D.C.,wosingteon DC,Ουάσιγκτον,Вашингтон,华盛顿特区,워싱턴 D.C.,워싱턴 DC\t38.89511\t-77.03637\tP\tPPLC\tUS\t\tDC\t001\t\t\t601723\t7\t6\tAmerica/New_York\t2020-04-30
4119403\tLittle Rock\tLittle Rock\tAcropolis,Anilco,Arkopolis,LIT,La Petit Roche,Litl Rok,Litl Rokas,Litl Roks,Litl-Rok,Litlroka,Little Rock,Littlerock,Litul Rok,Old Channel,Old Channel Little River,Petit Roche,Petit Rochelle,Petit Rocher,lie du luo bu,litala raka,litala roka,liteullog,litil rak,litila raka,littil rak,lytl rak  arkanzas,lytl rwk,lytl rwq,ritorurokku,xiao shi cheng,xiao yan cheng,Λιτλ Ροκ,Литл Рок,Литл-Рок,Литъл Рок,Літл-Рок,Լիթլ Ռոք,ליטל ראק,ליטל רוק,ليتل روك,لٹل راک,لٹل راک، آرکنساس,لیتل راک، آرکانزاس,लिटल रॉक,लिटिल रक,लिटिल् राक्,लितल रक,லிட்டில் ராக்,ලිට්ල් රොක්,ლიტლ-როკი,リトルロック,列度洛埠,小岩城,小石城,리틀록\t34.74648\t-92.28959\tP\tPPLA\tUS\t\tAR\t119\t90300\t\t197992\t102\t105\tAmerica/Chicago\t2019-09-05
282926\tModi‘in Makkabbim Re‘ut\tModi'in Makkabbim Re'ut\tGane Modi'in,Gane Modi‘in,Makkabbim,Makkabbim Re\`ut,Makkabbim Re‘ut,Makkabim,Modi'in,Modi'in Makkabbim Re'ut,Modiin,Modi‘in,Modi‘in Makkabbim Re‘ut,Nahal Modi'im,Naẖal Modi‘im,Ramot Modi'in,Ramot Modi‘in,Re\`ut,Re‘ut,mwdyʻyn,mwodiyʻiyn-makabiym-reʻwt,מוֹדִיעִין-מַכַּבִּים-רֵעוּת,מודיעין,מודיעין מכבים רעות,מכבים רעות,רעות\t31.89385\t35.01504\tP\tPPL\tIL\t\t02\t\t\t\t88749\t\t276\tAsia/Jerusalem\t2020-06-10
293807\tRa'anana\tRa'anana\tRa'anana,Ra'ananah,Ra'ananna,Raanana,Ra‘anana,Ra‘ananah,Ra‘ananna,rʻnnh,רעננה\t32.1836\t34.87386\tP\tPPL\tIL\t\t02\t\t\t\t80000\t\t49\tAsia/Jerusalem\t2017-07-02
295530\tBeersheba\tBeersheba\tB'er Sheva',B'eyr-Sheva',BEV,Be'er Scheva,Be'er Sheva,Be'er Sheva,Beehr-Sheva,Beer Scheva,Beer Seba,Beer Seva,Beer Sheba,Beer Sheva,Beer Sjeva,Beer Szewa,Beer Ŝeba,Beer Ševa,Beer Șeva,Beer-Seva,Beer-Sheva,Beer-Xeva,Beer-Şeva,Beerseba,Beerseva,Beersheba,Beerxeba,Beerşeba,Beerševa,Ber Seva,Bersabee,Bersabée,Berseba,Bersebá,Bersheva,Bersyeba,Berséba,Beér-Seva,Beër Sjeva,Beėršėva,Be’er Scheva,Bir el Saba,Bir es Sab,Bir es Sabe,Birsheba,Biʾr as-Sab',Biʾr as-Sabʿ,B’er Sheva‘,beer-sheva,beerusheba,bei er xie ba,beiyr chi ba,beleusyeba,biiyr shivaʿ,byr alsbʿ,byr sbʿ,byyr shybʿ,byyr shyfʿ,byyr shyvʿ,bʼr sbʻ,pircepa,Μπερ Σεβά,Беер Шева,Беер-Шева,Бершева,Беэр-Шева,Биршеба,Բեեր Շևա,באר שבע,بئر السبع,بئرشبع,بئير شيبع,بئير شيفع,بئير شيڤع,بيئر شيبع,بير السبع,بير سبع,بِئِير شِڤَع,بیر سبع,பீர்சேபா,เบียร์ชีบา,ბეერ-შევა,ቤርሳቤ,ベエルシェバ,贝尔谢巴,베르셰바\t31.25181\t34.7913\tP\tPPLA\tIL\tIL\t01\t\t\t\t186600\t\t285\tAsia/Jerusalem\t2019-03-15
1790630\tXi’an\tXi'an\tCh'ang-an,Ch'ang-an-hsien,Ch’ang-an,Ch’ang-an-hsien,Hsi Gnan Fu,Hsi-an,Hsi-an-shih,Hsi-ching,Hsi-ching-shih,Hsingan,SIA,Si-Gan-Fu,Sian,Sian',Siana,Sianas,Sianfu,Siano,Siaņa,Siking,Singan,Tay An,Tây An,Xi'an,Xi'an - xi an,Xi'an - 西安,Xi'an Shi,Xian,Xi’an,Xi’an Shi,Xī'ān,si xan,sian si,xi an,xi an shi,Ŝiano,Сиань,شىئەن شەھىرى,ซีอาน,西安,西安市,시안 시\t34.25833\t108.92861\tP\tPPLA\tCN\t\t26\t\t\t\t6501190\t\t416\tAsia/Shanghai\t2020-06-10
`;
  fs.writeFileSync(c5path, c5str);
  const testDbPath = path.join(tmpDir, 'test-geonames.sqlite3');
  await buildGeonamesSqlite(testDbPath, ciPath, c5path, 'cities-patch.txt', a1path, '/dev/null');
  const logger = pino({
    prettyPrint: {translateTime: true, ignore: 'pid,hostname'},
  });
  t.context.db = new GeoDb(logger, testZipsPath, testDbPath);
});

test.after((t) => {
  t.context.db.close();
});

test('legacy', (t) => {
  const expected = {
    'Be\'er Sheva': 295530,
    'Beer Sheva': 295530,
    'Raanana': 293807,
    'Ra\'anana': 293807,
    'CN-Xian': 1790630,
  };
  for (const [key, val] of Object.entries(expected)) {
    const loc = t.context.db.lookupLegacyCity(key);
    t.is(loc == null, false);
    t.is(typeof loc, 'object');
    t.is(loc instanceof Location, true);
    t.is(loc.getGeoId(), val);
  }
  t.is(t.context.db.lookupLegacyCity('*nonexistent*'), null);
});

test('munge', (t) => {
  const expected = {
    'Tel Aviv': 'telaviv',
    'Tel+Aviv': 'telaviv',
    'TelAviv': 'telaviv',
    'Tel-Aviv': 'tel-aviv',
    'US-Las Vegas-NV': 'us-lasvegas-nv',
    'CR-San José': 'cr-sanjosé',
    'Ra\'anana': 'raanana',
    'Petaẖ Tiqwa': 'petaẖtiqwa',
  };
  for (const [key, val] of Object.entries(expected)) {
    t.is(GeoDb.munge(key), val, `munge(${key}) should be ${val}`);
  }
});

test('legacy2', (t) => {
  for (const key of legacyCities) {
    const name = GeoDb.munge(key);
    const geonameid = t.context.db.legacyCities.get(name);
    t.is(typeof geonameid, 'number', key);
  }
});

test('geoname', (t) => {
  t.is(t.context.db.lookupGeoname(0), null);
  t.is(t.context.db.lookupGeoname('0'), null);
  t.is(t.context.db.lookupGeoname(1234), null);
  const loc = t.context.db.lookupGeoname(4119403);
  t.is(loc == null, false);
  t.is(typeof loc, 'object');
  t.is(loc instanceof Location, true);
  t.is(loc.getGeoId(), 4119403);
  t.is(loc.getShortName(), 'Little Rock');
  t.is(loc.getName(), 'Little Rock, Arkansas, USA');
  const expected = {
    latitude: 34.74648,
    longitude: -92.28959,
    il: false,
    tzid: 'America/Chicago',
    name: 'Little Rock, Arkansas, USA',
    cc: 'US',
    geoid: 4119403,
    geo: 'geoname',
    geonameid: 4119403,
    admin1: 'Arkansas',
  };
  t.deepEqual(Object.assign({}, loc), expected);
});

test('zip', (t) => {
  t.is(t.context.db.lookupZip('00000'), null);
  t.is(t.context.db.lookupZip('00001'), null);
  t.is(t.context.db.lookupZip('00000'), null);
  const loc = t.context.db.lookupZip('02912');
  t.is(loc == null, false);
  t.is(typeof loc, 'object');
  t.is(loc instanceof Location, true);
  t.is(loc.getGeoId(), '02912');
  t.is(loc.getShortName(), 'Providence');
  t.is(loc.getName(), 'Providence, RI 02912');
  const expected = {
    latitude: 41.826254,
    longitude: -71.402502,
    il: false,
    tzid: 'America/New_York',
    name: 'Providence, RI 02912',
    cc: 'US',
    geoid: '02912',
    state: 'RI',
    admin1: 'RI',
    geo: 'zip',
    zip: '02912',
  };
  t.deepEqual(Object.assign({}, loc), expected);
});

test('autoComplete', (t) => {
  const expected = [
    {
      id: 293397,
      value: 'Tel Aviv, Israel',
      asciiname: 'Tel Aviv',
      latitude: 32.08088,
      longitude: 34.78057,
      timezone: 'Asia/Jerusalem',
      population: 432892,
      geo: 'geoname',
      country: 'Israel',
      admin1: 'Tel Aviv',
      tokens: ['Tel', 'Aviv', 'Israel'],
    },
    {
      id: 11049562,
      value: 'Kiryat Ono, Israel',
      asciiname: 'Kiryat Ono',
      latitude: 32.05503,
      longitude: 34.85789,
      timezone: 'Asia/Jerusalem',
      population: 37791,
      geo: 'geoname',
      country: 'Israel',
      admin1: 'Tel Aviv',
      tokens: ['Kiryat', 'Ono', 'Tel', 'Aviv', 'Israel'],
    },
  ];
  const result = t.context.db.autoComplete('tel');
  t.deepEqual(result, expected);
});
