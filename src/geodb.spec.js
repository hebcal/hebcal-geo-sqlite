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
  const logger = t.context.logger = pino({
    transport: {
      target: 'pino-pretty',
      options: {translateTime: 'SYS:standard', ignore: 'pid,hostname'},
    },
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hebcal-test-'));
  const testZipsPath = path.join(tmpDir, 'zips.sqlite3');
  logger.info(testZipsPath);
  const zipsDb = new Database(testZipsPath);
  const sqls = [`CREATE TABLE ZIPCodes_Primary (
    ZipCode char(5) NOT NULL PRIMARY KEY,
    CityMixedCase varchar(35) NULL,
    State char(2),
    StateFullName TEXT,
    Latitude decimal(12, 6),
    Longitude decimal(12, 6),
    TimeZone char(2),
    DayLightSaving char(1),
    Population int
    );`,

  `INSERT INTO ZIPCodes_Primary VALUES ('65807','Springfield','MO','Missouri',37.171008,-93.331857,6,'Y',54952);
INSERT INTO ZIPCodes_Primary VALUES ('62704','Springfield','IL','Illinois',39.771921,-89.686047,6,'Y',39831);
INSERT INTO ZIPCodes_Primary VALUES ('11413','Springfield Gardens','NY','New York',40.665415,-73.749702,5,'Y',38912);
INSERT INTO ZIPCodes_Primary VALUES ('01109','Springfield','MA','Massachusetts',42.118748,-72.549032,5,'Y',30250);
INSERT INTO ZIPCodes_Primary VALUES ('01089','West Springfield','MA','Massachusetts',42.125682,-72.641677,5,'Y',28391);
INSERT INTO ZIPCodes_Primary VALUES ('19064','Springfield','PA','Pennsylvania',39.932544,-75.342975,5,'Y',24459);
INSERT INTO ZIPCodes_Primary VALUES ('02901','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02902','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02903','Providence','RI','Rhode Island',41.818167000000006083,-71.409728000000001202,'5','Y',10780);
INSERT INTO ZIPCodes_Primary VALUES ('02904','Providence','RI','Rhode Island',41.854637999999999564,-71.437492000000002434,'5','Y',29359);
INSERT INTO ZIPCodes_Primary VALUES ('02905','Providence','RI','Rhode Island',41.786946000000000367,-71.399191999999995772,'5','Y',25223);
INSERT INTO ZIPCodes_Primary VALUES ('02906','Providence','RI','Rhode Island',41.838150000000000616,-71.393139000000003235,'5','Y',28387);
INSERT INTO ZIPCodes_Primary VALUES ('02907','Providence','RI','Rhode Island',41.795126000000006882,-71.424763999999996144,'5','Y',27445);
INSERT INTO ZIPCodes_Primary VALUES ('02908','Providence','RI','Rhode Island',41.839295999999999153,-71.438804000000004634,'5','Y',37467);
INSERT INTO ZIPCodes_Primary VALUES ('02909','Providence','RI','Rhode Island',41.822232000000001406,-71.448291999999993251,'5','Y',43540);
INSERT INTO ZIPCodes_Primary VALUES ('02912','Providence','RI','Rhode Island',41.826254000000000488,-71.402501999999996584,'5','Y',1370);
INSERT INTO ZIPCodes_Primary VALUES ('02918','Providence','RI','Rhode Island',41.844266000000001071,-71.434915999999999414,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('02940','Providence','RI','Rhode Island',41.823800000000002086,-71.413300000000008438,'5','Y',0);
INSERT INTO ZIPCodes_Primary VALUES ('27315','Providence','NC','North Carolina',36.500447999999998671,-79.393259999999994391,'5','Y',2243);
INSERT INTO ZIPCodes_Primary VALUES ('42450','Providence','KY','Kentucky',37.391308000000003097,-87.762130999999996561,'6','Y',4063);
INSERT INTO ZIPCodes_Primary VALUES ('84332','Providence','UT','Utah',41.673151999999999972,-111.81449999999999445,'7','Y',7218);
`,
  `CREATE VIRTUAL TABLE ZIPCodes_CityFullText
USING fts4(ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population);`,

  `INSERT INTO ZIPCodes_CityFullText
SELECT ZipCode,CityMixedCase,State,Latitude,Longitude,TimeZone,DayLightSaving,Population
FROM ZIPCodes_Primary;`,

  `CREATE VIRTUAL TABLE ZIPCodes_CityFullText5
USING fts5(ZipCode UNINDEXED,CityMixedCase,Population UNINDEXED,longname);`,

  `INSERT INTO ZIPCodes_CityFullText5
SELECT ZipCode,CityMixedCase,Population,
CityMixedCase||', '||StateFullName||', '||ZipCode
FROM ZIPCodes_Primary;`,
  ];
  for (const sql of sqls) {
    logger.info(sql);
    zipsDb.exec(sql);
  }
  zipsDb.close();

  const ciPath = path.join(tmpDir, 'test-countryInfo.txt');
  const ciStr =
`IL\tISR\t376\tIS\tIsrael\tJerusalem\t20770\t8883800\tAS\t.il\tILS\tShekel\t972\t#######\t^(\\d{7}|\\d{5})$\the,ar-IL,en-IL,\t294640\tSY,JO,LB,EG,PS\t
US\tUSA\t840\tUS\tUnited States\tWashington\t9629091\t327167434\tNA\t.us\tUSD\tDollar\t1\t#####-####\t^\\d{5}(-\\d{4})?$\ten-US,es-US,haw,fr\t6252001\tCA,MX,CU\t
ZA\tZAF\t710\tSF\tSouth Africa\tPretoria\t1219912\t57779622\tAF\t.za\tZAR\tRand\t27\t####\t^(\\d{4})$\tzu,xh,af,nso,en-ZA,tn,st,ts,ss,ve,nr\t953987\tZW,SZ,MZ,BW,NA,LS\t
AX\tALA\t248\t\tAland Islands\tMariehamn\t1580\t26711\tEU\t.ax\tEUR\tEuro\t+358-18\t#####\t^(?:FI)*(\\d{5})$\tsv-AX\t661882\t\tFI
BS\tBHS\t044\tBF\tBahamas\tNassau\t13940\t385640\tNA\t.bs\tBSD\tDollar\t+1-242\t\t\ten-BS\t3572887\t\t
`;
  fs.writeFileSync(ciPath, ciStr);
  const a1path = path.join(tmpDir, 'test-admin1CodesASCII.txt');
  const a1str = `US.AR\tArkansas\tArkansas\t4099753
US.CO\tColorado\tColorado\t5417618
US.DC\tWashington, D.C.\tWashington, D.C.\t4138106
US.DE\tDelaware\tDelaware\t4142224
US.FL\tFlorida\tFlorida\t4155751
US.IL\tIllinois\tIllinois\t4896861
US.KY\tKentucky\tKentucky\t6254925
US.MA\tMassachusetts\tMassachusetts\t6254926
US.MO\tMissouri\tMissouri\t4398678
US.NC\tNorth Carolina\tNorth Carolina\t4482348
US.NY\tNew York\tNew York\t5128638
US.PA\tPennsylvania\tPennsylvania\t6254927
US.RI\tRhode Island\tRhode Island\t5224323
US.UT\tUtah\tUtah\t5549030
BS.23\tNew Providence\tNew Providence\t3571815
ZA.06\tGauteng\tGauteng\t1085594
IL.06\tJerusalem\tJerusalem\t293198
IL.05\tTel Aviv\tTel Aviv\t293396
IL.04\tHaifa\tHaifa\t294800
IL.03\tNorthern District\tNorthern District\t294824
IL.02\tCentral District\tCentral District\t294904
IL.01\tSouthern District\tSouthern District\t294952
`;
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
5417598\tColorado Springs\tColorado Springs\tCOS,Colorado Springs,El Paso,Fontes Coloratenses,Kalarada-Spryngs,Kolorado Springs,Kolorado Springsas,Kolorado Sprinqs,Kolorado-Springs,Kolorado-Springz,Koloradospringsa,Koloranto Sprin\'nks,Kolorādospringsa,kalorado sprinsa,ke luo la duo si pu lin si,klradw aspryngz,kolloladoseupeulingseu,kolorado springja,kolorado springs,kolorryado springas,kororadosupuringusu,kwlwradw sbrynghs,qwlwrdw spryngs,Κολοράντο Σπρινγκς,Каларада-Спрынгс,Колорадо Спрингс,Колорадо-Спрингс,Колорадо-Спрінгз,Կոլորադո Սպրինգս,קולורדו ספרינגס,كولورادو سبرينغس,کلرادو اسپرینگز,کولاریڈو سپرنگس، کولاریڈو,कॉलोराडो स्प्रिंग्ज,कोलोराडो स्प्रिंग्स्,कोलोर्र्याडो स्प्रिङ्गस्,কলোরাডো স্প্রিংস,კოლორადო-სპრინგზი,コロラドスプリングス,科罗拉多斯普林斯,콜로라도스프링스\t38.83388\t-104.82136\tP\tPPLA2\tUS\t\tCO\t041\t\t\t456568\t1832\t1838\tAmerica/Denver\t2019-09-05
952865\tSprings\tSprings\tSprings\t-26.25\t28.4\tP\tPPLX\tZA\t\t06\tEKU\tEKU\t\t186394\t\t1630\tAfrica/Johannesburg\t2018-09-27
4409896\tSpringfield\tSpringfield\tNorth Springfield,SGF,Springfield,Springfijld,Springfild,aspryngfyld  myzwry,sbrynghfyld,seupeulingpildeu,si pu lin fei er de,spryngpyld,supuringufirudo,Спрингфийлд,Спрингфилд,Спрингфілд,ספרינגפילד,اسپرینگفیلد، میزوری,سبرينغفيلد,سپرنگفیلڈ، مسوری,スプリングフィールド,斯普林菲尔德,스프링필드\t37.21533\t-93.29824\tP\tPPLA2\tUS\t\tMO\t077\t70009\t\t166810\t396\t399\tAmerica/Chicago\t2019-02-27
4951788\tSpringfield\tSpringfield\tAgawam,Agawome,Campifons,Nayasset,SFY,Springfield,Springfield City,Springfijld,Springfild,Springfilda,Springfildas,Springfīlda,Spryngfild,aspryngfyld  masachwst,sbrynghfyld,seupeulingpildeu,si pu lin fei er de,spryngpyld,supuringufirudo,Спрингфийлд,Спрингфилд,Спрингфілд,Спрынгфілд,ספרינגפילד,اسپرینگفیلد، ماساچوست,سبرينغفيلد,سپرنگفیلڈ، میساچوسٹس,スプリングフィールド,斯普林菲尔德,스프링필드\t42.10148\t-72.58981\tP\tPPL\tUS\t\tMA\t013\t67000\t\t154341\t25\t49\tAmerica/New_York\t2017-05-23
934138\tProvidence\tProvidence\tProvidence\t-20.24472\t57.61222\tP\tPPL\tMU\t\t15\t\t\t\t3126\t\t395\tIndian/Mauritius\t2018-12-05
3571824\tNassau\tNassau\tCity of Nassau,NAS,Nasau,Nasauo,Nasaŭo,Naso,Nassaou,Nassau,Nassau City,Nassau pa Bahamas,Nassau på Bahamas,Nasáu,na sao,nasa'u,nasau,nasaw,nasayw,nasea,naso,nasso,neco,nsaw,Νασσάου,Насау,Нассау,Նասաու,נסאו,ناسائو,ناساو,نساؤ,नासाउ,নাসাউ,ਨਸਾਊ,நேசோ,നാസോ,แนสซอ,ན་སའོ།,ნასაუ,ናሶ,ナッソー,拿騷,拿骚,나사우,나소\t25.05823\t-77.34306\tP\tPPLC\tBS\t\t23\t\t\t\t227940\t\t5\tAmerica/Nassau\t2019-09-05
3703837\tNueva Providencia\tNueva Providencia\tNew Providence,Nueva Providencia\t9.26333\t-79.81556\tP\tPPLA3\tPA\t\t04\t0301\t030109\t\t0\t\t39\tAmerica/Panama\t2020-10-21
4305294\tProvidence\tProvidence\t\t38.57451\t-85.22107\tP\tPPL\tUS\t\tKY\t223\t\t\t3492\t259\t255\tAmerica/New_York\t2006-01-17
4305295\tProvidence\tProvidence\tProvidence,Providens,Savageville,Провиденс\t37.39755\t-87.76279\tP\tPPL\tUS\t\tKY\t233\t\t\t3065\t134\t135\tAmerica/Chicago\t2017-03-09
4330331\tLake Providence\tLake Providence\tLejk Providens,lai ke pu luo wei deng si,lyk brwfaydns,lyk prawydns  lwyyzyana,Лејк Провиденс,ليك بروفايدنس,لیک پراویدنس، لوئیزیانا,莱克普罗维登斯\t32.80499\t-91.17098\tP\tPPLA2\tUS\t\tLA\t035\t\t\t3715\t32\t35\tAmerica/Chicago\t2018-05-17
5101775\tNew Providence\tNew Providence\tNju Providens,Nju-Providens,New Providence,Nju Providens,Turkey,nyw prawydns  nywjrsy,Њу Провиденс,Нью Провиденс,Нью-Провиденс,نیو پراویدنس، نیوجرسی\t40.69843\t-74.40154\tP\tPPL\tUS\t\tNJ\t039\t51810\t\t12469\t67\t71\tAmerica/New_York\t2017-05-23
5221931\tEast Providence\tEast Providence\tIst Providens,Ist-Providens,ayst brwfydans,ayst prawydns  rwd aylnd,dong pu luo wei deng si,isutopurobidensu,xis t phr x wi den s,Іст-Провіденс,Ист Провиденс,إيست بروفيدانس,ایست پراویدنس، رود آیلند,ایسٹ پروویڈنس، روڈ آئلینڈ,อีสต์พรอวิเดนซ์,イーストプロビデンス,东普罗维登斯\t41.81371\t-71.37005\tP\tPPL\tUS\t\tRI\t007\t22960\t\t47408\t19\t-2\tAmerica/New_York\t2017-05-23
5223681\tNorth Providence\tNorth Providence\tNort Providens,Nort-Providens,North Providence,North-Providence,nosupurobidensu,nwrth brwfydans,nxrth phr x wi den s,Норт Провиденс,Норт-Провіденс,نارتھ پروویڈنس، روڈ آئلینڈ,نورث بروفيدانس,นอร์ทพรอวิเดนซ์,ノースプロビデンス\t41.8501\t-71.46617\tP\tPPLA3\tUS\t\tRI\t007\t5223683\t\t33835\t56\t39\tAmerica/New_York\t2013-08-25
5224151\tProvidence\tProvidence\tPVD,Provedensos,Providns,Providehns,Providence,Providenco,Providens,Providensa,Providensas,Providentia,Provintens,Provėdensos,brwfydns,peulobideonseu,phr x wi den s,piravitens,prabhidensa,pravidens,prawydns,probhidensa,provhidansa,prwbydns,prwwyڈns  rwڈ aylynڈ,pu luo wei deng si,pu luo wei dun si,purobidensu,purovuidensu,Πρόβιντενς,Провиденс,Провидънс,Провіденс,Провідэнс,Փրովիդենս,פראווידענס,פרובידנס,بروفيدنس,پراویدنس,پروویڈنس,پروویڈنس، روڈ آئلینڈ,प्रभिदेन्स,प्राविडेन्स्,प्रॉव्हिडन्स,प्रोभिडेन्स,பிராவிடென்ஸ்,พรอวิเดนซ์,プロビデンス,プロヴィデンス,普洛威頓斯,普罗维登斯,프로비던스\t41.82399\t-71.41283\tP\tPPLA\tUS\t\tRI\t007\t59000\t\t190934\t2\t-17\tAmerica/New_York\t2021-10-13
5780020\tProvidence\tProvidence\tProvidence,Providens,Providuns,Spring Creek,brwfydans,prawydns  ywta,pu luo wei deng si,Провиденс,Провидънс,بروفيدانس,پراویدنس، یوتا,پروویڈنس، یوٹاہ,普罗维登斯\t41.70632\t-111.81717\tP\tPPL\tUS\t\tUT\t005\t\t\t7124\t1401\t1401\tAmerica/Denver\t2017-03-09
7315379\tProvidence Village\tProvidence Village\tProvidence Village\t33.2334\t-96.96158\tP\tPPL\tUS\t\tTX\t121\t\t\t4786\t177\t180\tAmerica/Chicago\t2022-02-25
`;
  fs.writeFileSync(c5path, c5str);
  const altNamePath = path.join(tmpDir, 'test-IL-alt.txt');
  const altNameStr =
`1605940\t294801\tde\tHaifa\t\t\t\t\t\t
1605941\t294801\ten\tHaifa\t1\t\t\t\t\t
1605942\t294801\tes\tHaifa\t\t\t\t\t\t
1605943\t294801\tar\tحيفا\t1\t\t\t\t\t
1605948\t294801\tfr\tHaïfa\t\t\t\t\t\t
1605949\t294801\the\tחיפה\t1\t\t\t\t\t
1605950\t294801\tid\tHaifa\t\t\t\t\t\t
204884\t293100\ten\tSfat\t\t\t\t\t\t
204885\t293100\ten\tSafed\t1\t\t\t\t\t
204886\t293100\ten\tTsefat\t\t\t\t\t\t
2922563\t293100\tlink\thttps://en.wikipedia.org/wiki/Safed\t\t\t\t\t\t
3037853\t293100\tru\tЦфат\t\t\t\t\t\t
3047569\t293100\tlink\thttps://ru.wikipedia.org/wiki/%D0%A6%D1%84%D0%B0%D1%82\t\t\t\t\t\t
7202955\t293100\ten\tẔefat\t\t\t\t\t\t
7202956\t293100\the\tצפת\t1\t\t\t\t\t
8701460\t293100\tan\tSafet\t\t\t\t\t\t
1620514\t293397\ten\tTel Aviv\t1\t\t\t\t\t
1620515\t293397\tes\tTel Aviv\t\t\t\t\t\t
1620516\t293397\tar\tتل أبيب\t1\t\t\t\t\t
1620517\t293397\tbg\tТел Авив\t\t\t\t\t\t
1620518\t293397\tca\tTel Aviv\t\t\t\t\t\t
1620519\t293397\tcs\tTel Aviv\t\t\t\t\t\t
1620520\t293397\tda\tTel Aviv\t\t\t\t\t\t
1620521\t293397\teo\tTel-Avivo\t\t\t\t\t\t
1620522\t293397\tfa\tتل‌آویو\t\t\t\t\t\t
1620523\t293397\tfi\tTel Aviv\t\t\t\t\t\t
1620525\t293397\the\tתל אביב-יפו\t\t\t\t\t\t
1620526\t293397\thr\tTel Aviv\t\t\t\t\t\t
205898\t293807\ten\tRa‘anana\t\t\t\t\t\t
205899\t293807\ten\tRa‘ananah\t\t\t\t\t\t
4472882\t293807\ten\tRa‘ananna\t\t\t\t\t\t
7954091\t293807\the\tרעננה\t1\t\t\t\t\t
8289411\t293807\tlink\thttps://en.wikipedia.org/wiki/Ra%27anana\t\t\t\t\t\t
8289412\t293807\ten\tRaanana\t1\t\t\t\t\t
15350968\t293807\twkdt\tQ309164\t\t\t\t\t\t
16933760\t293807\tunlc\tILRAA\t\t\t\t\t\t
`;
  fs.writeFileSync(altNamePath, altNameStr);
  const testDbPath = path.join(tmpDir, 'test-geonames.sqlite3');
  logger.info(testDbPath);
  const filenames = {
    dbFilename: testDbPath,
    countryInfotxt: ciPath,
    cities5000txt: c5path,
    citiesPatch: 'cities-patch.txt',
    admin1CodesASCIItxt: a1path,
    ILtxt: '/dev/null',
    ILalternate: altNamePath,
  };
  await buildGeonamesSqlite(filenames);
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
    asciiname: 'Little Rock',
    cc: 'US',
    geoid: 4119403,
    geo: 'geoname',
    geonameid: 4119403,
    population: 197992,
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
    stateName: 'Rhode Island',
    geo: 'zip',
    zip: '02912',
    population: 1370,
  };
  t.deepEqual(Object.assign({}, loc), expected);
});

test('autoComplete', (t) => {
  const expected = [
    {
      id: 293397,
      value: 'Tel Aviv, Israel',
      asciiname: 'Tel Aviv',
      admin1: 'Tel Aviv',
      country: 'Israel',
      cc: 'IL',
      latitude: 32.08088,
      longitude: 34.78057,
      timezone: 'Asia/Jerusalem',
      population: 432892,
      geo: 'geoname',
    },
  ];
  const result = t.context.db.autoComplete('tel', true);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});

test('autoCompleteZip', (t) => {
  const expected = [
    {
      id: '65807',
      value: 'Springfield, MO 65807',
      admin1: 'MO',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 37.171008,
      longitude: -93.331857,
      timezone: 'America/Chicago',
      population: 54952,
      geo: 'zip',
    },
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39831,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('6', true);
  t.deepEqual(result, expected);
});

test('autoCompleteZipPlus4', (t) => {
  const expected = [
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39831,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('62704-1234', true);
  t.deepEqual(result, expected);
});

test('autoCompleteZipMerge', (t) => {
  const expected = [
    {
      id: 5417598,
      value: 'Colorado Springs, Colorado, USA',
      admin1: 'Colorado',
      country: 'United States',
      cc: 'US',
      latitude: 38.83388,
      longitude: -104.82136,
      timezone: 'America/Denver',
      geo: 'geoname',
      population: 456568,
      asciiname: 'Colorado Springs',
    },
    {
      id: 952865,
      value: 'Springs, Gauteng, South Africa',
      admin1: 'Gauteng',
      country: 'South Africa',
      cc: 'ZA',
      latitude: -26.25,
      longitude: 28.4,
      timezone: 'Africa/Johannesburg',
      geo: 'geoname',
      population: 186394,
      asciiname: 'Springs',
    },
    {
      id: 4409896,
      value: 'Springfield, Missouri, USA',
      admin1: 'Missouri',
      country: 'United States',
      cc: 'US',
      latitude: 37.21533,
      longitude: -93.29824,
      timezone: 'America/Chicago',
      geo: 'geoname',
      population: 166810,
      asciiname: 'Springfield',
    },
    {
      id: 4951788,
      value: 'Springfield, Massachusetts, USA',
      admin1: 'Massachusetts',
      country: 'United States',
      cc: 'US',
      latitude: 42.10148,
      longitude: -72.58981,
      timezone: 'America/New_York',
      geo: 'geoname',
      population: 154341,
      asciiname: 'Springfield',
    },
    {
      id: '62704',
      value: 'Springfield, IL 62704',
      admin1: 'IL',
      asciiname: 'Springfield',
      country: 'United States',
      cc: 'US',
      latitude: 39.771921,
      longitude: -89.686047,
      timezone: 'America/Chicago',
      population: 39831,
      geo: 'zip',
    },
    {
      id: '11413',
      value: 'Springfield Gardens, NY 11413',
      admin1: 'NY',
      asciiname: 'Springfield Gardens',
      country: 'United States',
      cc: 'US',
      latitude: 40.665415,
      longitude: -73.749702,
      timezone: 'America/New_York',
      population: 38912,
      geo: 'zip',
    },
  ];
  const result = t.context.db.autoComplete('Spring', true).slice(0, 6);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});

test('autoCompleteZipMerge2', (t) => {
  const result = t.context.db.autoComplete('Providence', true)
      .map((res) => {
        return {
          i: res.id,
          v: res.value,
          p: res.population,
        };
      });
  const expected = [
    {i: 3571824, v: 'Nassau, New Providence, Bahamas', p: 227940},
    {i: 5224151, v: 'Providence, Rhode Island, USA', p: 190934},
    {i: 5221931, v: 'East Providence, Rhode Island, USA', p: 47408},
    {i: 5223681, v: 'North Providence, Rhode Island, USA', p: 33835},
    {i: 5780020, v: 'Providence, Utah, USA', p: 7124},
    {i: 4305295, v: 'Providence, Kentucky, USA', p: 3065},
    {i: '27315', v: 'Providence, NC 27315', p: 2243},
  ];
  t.deepEqual(result, expected);
});

test('autoComplete-no-match', (t) => {
  const expected = [];
  const result = t.context.db.autoComplete('foobar', false);
  t.deepEqual(result, expected);
});

test('autoComplete-nolatlong', (t) => {
  const expected = [{
    id: 293807,
    value: 'Ra\'anana, Israel',
    asciiname: 'Ra\'anana',
    admin1: 'Central District',
    country: 'Israel',
    cc: 'IL',
    geo: 'geoname',
  }];
  const result = t.context.db.autoComplete('Ra\'a', false);
  for (const res of result) {
    delete res.rank;
  }
  t.deepEqual(result, expected);
});


test('cacheZips', (t) => {
  t.context.db.cacheZips();
  t.pass('OK');
});

test('cacheGeonames', (t) => {
  t.context.db.cacheGeonames();
  t.pass('OK');
});

test('countryNames', (t) => {
  const m = t.context.db.countryNames;
  t.is(typeof m, 'object');
  t.is(m.get('ZA'), 'South Africa');
});

test('legacy3', (t) => {
  // fetch from @hebacal/cities because no trailing "h"
  const loc = t.context.db.lookupLegacyCity('IL-Petah Tikva');
  t.is(loc instanceof Location, true);
  const expected = {
    latitude: 32.08707,
    longitude: 34.88747,
    il: true,
    tzid: 'Asia/Jerusalem',
    name: 'Petah Tiqwa',
    cc: 'IL',
    geoid: 1007988,
  };
  const plainObj = JSON.parse(JSON.stringify(loc));
  t.deepEqual(plainObj, expected);
});

test('alternatenames', (t) => {
  const sql = `SELECT * from alternatenames where geonameid = ?`;
  const stmt = t.context.db.geonamesDb.prepare(sql);
  const results = stmt.all([293100]);
  const actual = JSON.parse(JSON.stringify(results));
  const expected = [
    {'id': 204884, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Sfat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204885, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Safed', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 204886, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tsefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202955, 'geonameid': 293100, 'isolanguage': 'en', 'name': 'Tzefat', 'isPreferredName': '', 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
    {'id': 7202956, 'geonameid': 293100, 'isolanguage': 'he', 'name': 'צפת', 'isPreferredName': 1, 'isShortName': '', 'isColloquial': '', 'isHistoric': '', 'periodFrom': '', 'periodTo': ''},
  ];
  t.deepEqual(actual, expected);
});
