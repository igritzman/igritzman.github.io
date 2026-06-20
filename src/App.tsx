import { useEffect, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { catalogCoverage, categoryLabels, difficultyLabels, difficultyLevels, questions, regions } from "./data";
import { createRun, difficultyScore, isCorrect, nextDifficulty } from "./quiz";
import regionalPopulationTable from "./regionalPopulations.json";
import countryImageManifest from "./countryImageManifest.json";
import regionFlagManifest from "./regionFlagManifest.json";
import regionImageManifest from "./regionImageManifest.json";
import usStateImageManifest from "./usStateImageManifest.json";
import { createDefaultProfile, loadFriends, loadProfile, loadProfiles, loadRun, saveFriends, saveProfile, saveProfiles, saveRun } from "./storage";
import type { DifficultyLevel, LocalFriend, PlayerProfile, Question, QuizRun, Region } from "./types";

type Tab = "play" | "map" | "review" | "profile";
type MapStyle = "default" | "aerial" | "light" | "dark" | "topographic";

type WorldFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: GeoJSON.Geometry;
};

type WriBoundaryFeature = GeoJSON.Feature<GeoJSON.Geometry, { name?: string; abbrev?: string; iso_a3?: string }>;
type GadmSubdivisionProperties = {
  GID_1?: string;
  GID_2?: string;
  GID_0?: string;
  COUNTRY?: string;
  NAME_1?: string;
  NAME_2?: string;
  VARNAME_1?: string;
  VARNAME_2?: string;
  NL_NAME_1?: string;
  NL_NAME_2?: string;
  TYPE_1?: string;
  TYPE_2?: string;
  ENGTYPE_1?: string;
  ENGTYPE_2?: string;
  ISO_1?: string;
  ISO_2?: string;
  HASC_1?: string;
  HASC_2?: string;
  shapeName?: string;
  shapeISO?: string;
  shapeID?: string;
  shapeGroup?: string;
  shapeType?: string;
};
type GadmSubdivisionFeature = GeoJSON.Feature<GeoJSON.Geometry, GadmSubdivisionProperties>;

type CsvExport = {
  csv: string;
  fileName: string;
  objectUrl: string;
  rowCount: number;
};

type PracticeTopic = "transport" | "capitals" | "flags" | "geography" | "landmarks" | "tourist";

type PlaceImage = {
  name: string;
  type: string;
  region: string;
  imagePath: string;
  attribution: {
    title: string;
    author: string;
    license: string;
    sourceUrl: string;
  };
};

type LightboxImage = {
  src: string;
  title: string;
  caption?: string;
};

type AskCardItem = {
  label: string;
  regionId?: string;
  flag?: string;
  note?: string;
};

type AskCard = {
  id: string;
  tab: string;
  title: string;
  category: string;
  summary: string;
  items: AskCardItem[];
  image?: {
    src: string;
    alt: string;
  };
  compareIds?: string[];
};

const metroImageByPrompt: Record<string, string> = {
  "Medellin MetroCable": "/images/metro-images/Medellin%20Metro.jpg",
  "Al Boraq high-speed train": "/images/metro-images/Railways_Morocco.png",
  "Budapest rail and metro": "/images/metro-images/Budapest.png",
  "Shinkansen station order": "/images/metro-images/Shinkansen_map_202405_en.png",
  "High-speed rail corridor map": "/images/metro-images/Shinkansen_map_202405_en.png",
  "Washington DC Metro core": "/images/metro-images/WMATA.png",
  "Washington DC Metro transfer": "/images/metro-images/WMATA.png",
  "WMATA regional map": "/images/metro-images/WMATA.png",
  "TTC subway reference": "/images/metro-images/TTC%20Toronto%20Subway.png",
  "Bangkok rapid transit map": "/images/metro-images/bangkok-map.png",
  "Mumbai rail map": "/images/metro-images/Mumbai_Rail_Map_-_English.jpg",
  "Hyderabad Metro map": "/images/metro-images/Hyderabad%20Metro.png",
  "Zhengzhou Metro network": "/images/metro-images/Zhengzhou_Metro_Network.png",
  "Phoenix Valley Metro Rail": "/images/metro-images/PhoenixValleyMetroval_msys_rail-oct-2025-lgfmt.jpg",
  "Tucson Sun Link streetcar": "/images/metro-images/Tucson%20Sun%20Link%20streetcar-scaled.jpg",
  "SunRail Central Florida": "/images/metro-images/SunRail.webp",
  "Luoyang Metro network": "/images/metro-images/System_Map_of_Luoyang_Metro.png",
  "Hong Kong MTR": "/images/metro-images/Hong%20Kong.png",
  "Cairo rapid transit": "/images/metro-images/Cairo_Rapid_Transit_map.png",
  "Kuala Lumpur rapid transit": "/images/metro-images/RapidKL%20Kuala%20Lumpur.jpg",
  "Guangzhou Metro network": "/images/metro-images/Guangzhou_Metro_Network.png",
  "Shenzhen Metro network": "/images/metro-images/Shenzhen_Metro_(Rapid_Transit)_System_Map.svg.png",
  "Chongqing Rail Transit": "/images/metro-images/Chongqing%20Rail%20Plan.png",
};

const transitSystemImageById: Record<string, string> = {
  wmata: "/images/metro-images/WMATA.png",
  shinkansen: "/images/metro-images/Shinkansen_map_202405_en.png",
  "bangkok-bts-mrt": "/images/metro-images/bangkok-map.png",
  marta: "/images/metro-images/MARTA.png",
  "chongqing-rail-transit": "/images/metro-images/Chongqing%20Rail%20Plan.png",
  "mumbai-suburban": "/images/metro-images/Mumbai_Rail_Map_-_English.jpg",
  "toronto-ttc": "/images/metro-images/TTC%20Toronto%20Subway.png",
  "hyderabad-metro": "/images/metro-images/Hyderabad%20Metro.png",
  "moscow-metro": "/images/metro-images/moscow.jpg",
  "saint-petersburg-metro": "/images/metro-images/saint-petersburg-metro-map-eng.png",
};

let placeImagesCache: Record<string, PlaceImage> | null = null;
let placeImagesPromise: Promise<Record<string, PlaceImage>> | null = null;
let wriBoundaryCache: WriBoundaryFeature[] | null = null;
let wriBoundaryPromise: Promise<WriBoundaryFeature[]> | null = null;
const gadmSubdivisionCache: Record<string, GadmSubdivisionFeature[]> = {};
const gadmSubdivisionPromises: Record<string, Promise<GadmSubdivisionFeature[]>> = {};

const gadmLevelOneFiles: Record<string, string> = {
  "united-states": "/data/gadm/level1/gadm41_USA_1.json",
  algeria: "/data/gadm/level1/gadm41_DZA_1.json",
  argentina: "/data/gadm/level1/gadm41_ARG_1.json",
  canada: "/data/gadm/level1/gadm41_CAN_1.json",
  brazil: "/data/gadm/level1/gadm41_BRA_1.json",
  chile: "/data/gadm/level1/gadm41_CHL_1.json",
  china: "/data/gadm/level1/gadm41_CHN_1.json",
  egypt: "/data/gadm/level1/gadm41_EGY_1.json",
  ethiopia: "/data/gadm/level1/gadm41_ETH_1.json",
  ghana: "/data/gadm/level1/gadm41_GHA_1.json",
  greece: "/data/gadm/level1/geoBoundaries_GRC_ADM1.json",
  indonesia: "/data/gadm/level1/gadm41_IDN_1.json",
  kenya: "/data/gadm/level1/gadm41_KEN_1.json",
  japan: "/data/gadm/level1/gadm41_JPN_1.json",
  morocco: "/data/gadm/level1/gadm41_MAR_1.json",
  norway: "/data/gadm/level1/gadm41_NOR_1.json",
  poland: "/data/gadm/level1/gadm41_POL_1.json",
  india: "/data/gadm/level1/gadm41_IND_1.json",
  australia: "/data/gadm/level1/gadm41_AUS_1.json",
  germany: "/data/gadm/level1/gadm41_DEU_1.json",
  mexico: "/data/gadm/level1/gadm41_MEX_1.json",
  nepal: "/data/gadm/level1/geoboundaries_NPL_ADM1.json",
  nigeria: "/data/gadm/level1/gadm41_NGA_1.json",
  philippines: "/data/gadm/level1/gadm41_PHL_1.json",
  portugal: "/data/gadm/level1/gadm41_PRT_1.json",
  romania: "/data/gadm/level1/gadm41_ROU_1.json",
  russia: "/data/gadm/level1/gadm41_RUS_1.json",
  "south-africa": "/data/gadm/level1/gadm41_ZAF_1.json",
  "south-korea": "/data/gadm/level1/gadm41_KOR_1.json",
  spain: "/data/gadm/level1/gadm41_ESP_1.json",
  thailand: "/data/gadm/level1/gadm41_THA_1.json",
  italy: "/data/gadm/level1/gadm41_ITA_1.json",
  france: "/data/gadm/level1/gadm41_FRA_1.json",
  ireland: "/data/gadm/level1/gadm41_IRL_1.json",
  turkey: "/data/gadm/level1/gadm41_TUR_1.json",
  uae: "/data/gadm/level1/gadm41_ARE_1.json",
  ukraine: "/data/gadm/level1/gadm41_UKR_1.json",
  "united-kingdom": "/data/gadm/level1/gadm41_GBR_2.json",
  vietnam: "/data/gadm/level1/gadm41_VNM_1.json",
  zimbabwe: "/data/gadm/level1/gadm41_ZWE_1.json",
};

const importedRegionalPopulations = regionalPopulationTable as Record<string, Record<string, string>>;

const subdivisionStudyNotes: Record<string, { capital?: string; population?: string; transit?: string; flagCode?: string }> = {
  "US-FL": { capital: "Tallahassee", population: "about 23 million", transit: "Brightline, SunRail, Miami-Dade Transit, Tri-Rail; major airports MIA, MCO, FLL, TPA, JAX" },
  "US-AL": { capital: "Montgomery", population: "about 5.1 million", transit: "Birmingham MAX, Montgomery Transit, Huntsville Orbit" },
  "US-AZ": { capital: "Phoenix", population: "about 7.5 million", transit: "Valley Metro Rail, Tucson Sun Link, Phoenix Sky Harbor rail connection" },
  "US-CA": { capital: "Sacramento", population: "about 39 million", transit: "BART, LA Metro, Caltrain, Metrolink, San Diego Trolley" },
  "US-CO": { capital: "Denver", population: "about 5.9 million", transit: "Denver RTD rail, airport rail, Front Range bus links" },
  "US-DC": { capital: "Washington, D.C.", population: "about 700,000", transit: "Washington Metro, DC Circulator, Union Station rail" },
  "US-GA": { capital: "Atlanta", population: "about 11 million", transit: "MARTA rail, Atlanta Streetcar, regional bus links" },
  "US-IA": { capital: "Des Moines", population: "about 3.2 million", transit: "DART Des Moines, Iowa City Transit, CyRide, intercity bus corridors" },
  "US-IL": { capital: "Springfield", population: "about 12.5 million", transit: "Chicago L, Metra, Amtrak Illinois corridors" },
  "US-MA": { capital: "Boston", population: "about 7 million", transit: "MBTA subway, commuter rail, regional bus and ferry links" },
  "US-MI": { capital: "Lansing", population: "about 10 million", transit: "Detroit People Mover, QLine, SMART, Amtrak Michigan services" },
  "US-MO": { capital: "Jefferson City", population: "about 6.2 million", transit: "MetroLink St. Louis, Kansas City Streetcar, Amtrak Missouri River Runner" },
  "US-NC": { capital: "Raleigh", population: "about 11 million", transit: "Charlotte LYNX, GoTriangle, Piedmont rail corridor" },
  "US-NY": { capital: "Albany", population: "about 19.5 million", transit: "MTA subway, LIRR, Metro-North, PATH connections" },
  "US-PA": { capital: "Harrisburg", population: "about 13 million", transit: "SEPTA, PATCO links, Pittsburgh light rail, Amtrak Keystone" },
  "US-TX": { capital: "Austin", population: "about 31 million", transit: "DART, Houston METRORail, Austin MetroRail, VIA" },
  "US-WA": { capital: "Olympia", population: "about 8 million", transit: "Sound Transit Link, Sounder, Washington State Ferries" },
  "CA-BC": { capital: "Victoria", transit: "SkyTrain, West Coast Express, BC Ferries" },
  "CA-ON": { capital: "Toronto", population: "about 16 million", transit: "TTC, GO Transit, UP Express, Ottawa O-Train; major airports YYZ and YOW" },
  "CA-QC": { capital: "Quebec City", population: "9,058,089 (2025 estimate; 8,501,840 in 2021)", transit: "Montreal Metro, REM, exo, RTC buses" },
  "JP-01": { capital: "Sapporo", transit: "Sapporo Subway, JR Hokkaido, airport rail to New Chitose" },
  "JP-13": { capital: "Tokyo", transit: "Tokyo Metro, Toei Subway, JR East, private railways" },
  "JP-23": { capital: "Nagoya", transit: "Nagoya Subway, Meitetsu, JR Central, Shinkansen access" },
  "JP-26": { capital: "Kyoto", transit: "Kyoto Municipal Subway, JR West, private railways, Shinkansen" },
  "JP-27": { capital: "Osaka", transit: "Osaka Metro, JR West, Hankyu, Hanshin, Kintetsu" },
  "JP-34": { capital: "Hiroshima", transit: "Hiroshima Electric Railway, JR West, Sanyo Shinkansen" },
  "MX-JAL": { capital: "Guadalajara", transit: "SITEUR light rail, Mi Macro BRT, Guadalajara airport access" },
  "MX-CMX": { capital: "Mexico City", transit: "Mexico City Metro, Metrobús, suburban rail" },
  "AU-NSW": { capital: "Sydney", transit: "Sydney Trains, Sydney Metro, light rail, ferries" },
  "AU-WA": { capital: "Perth", transit: "Transperth trains, buses, ferries, Airport Line" },
  "AU-VIC": { capital: "Melbourne", transit: "Melbourne trams, trains, V/Line, airport bus links" },
  "IN-DL": { capital: "New Delhi", transit: "Delhi Metro, Airport Express, NCR rail" },
  "IN.AP": { capital: "Amaravati", population: "84,580,777 (2011 Census; includes Telangana at the time)", transit: "Vijayawada rail hub, Visakhapatnam port and airport, Amaravati road corridors" },
  "IN.AR": { capital: "Itanagar", population: "1,383,727 (2011 Census)", transit: "Naharlagun rail access, regional road and air links" },
  "IN.AS": { capital: "Dispur", population: "31,205,576 (2011 Census)", transit: "Guwahati rail hub, Lokpriya Gopinath Bordoloi airport, ASTC buses" },
  "IN.BR": { capital: "Patna", population: "104,099,452 (2011 Census)", transit: "Patna Junction, Patna Metro under construction, regional rail" },
  "IN.CH": { capital: "Chandigarh", population: "1,055,450 (2011 Census)", transit: "Chandigarh buses, airport links, northern rail corridors" },
  "IN.CT": { capital: "Raipur", population: "25,545,198 (2011 Census)", transit: "Raipur rail hub, airport links, regional buses" },
  "IN.AN": { capital: "Port Blair", population: "380,581 (2011 Census)", transit: "Port Blair airport, island ferry links" },
  "IN.DN": { capital: "Silvassa", population: "343,709 (2011 Census)", transit: "Western road corridors and Vapi rail access" },
  "IN.DD": { capital: "Daman", population: "243,247 (2011 Census)", transit: "Vapi rail access, coastal road links" },
  "IN.GA": { capital: "Panaji", population: "1,458,545 (2011 Census)", transit: "Konkan Railway, Dabolim and Mopa airports, Kadamba buses" },
  "IN-GJ": { capital: "Gandhinagar", transit: "Ahmedabad Metro, BRTS, western rail corridors" },
  "IN.HR": { capital: "Chandigarh", population: "25,351,462 (2011 Census)", transit: "Delhi NCR metro links, Gurugram Rapid Metro, northern rail corridors" },
  "IN.HP": { capital: "Shimla", population: "6,864,602 (2011 Census)", transit: "Kalka-Shimla Railway, hill road and bus links" },
  "IN.JK": { capital: "Srinagar and Jammu", population: "12,541,302 (2011 Census; pre-2019 state)", transit: "Jammu Tawi rail, Srinagar airport, mountain road corridors" },
  "IN.JH": { capital: "Ranchi", population: "32,988,134 (2011 Census)", transit: "Ranchi rail and airport links, regional bus corridors" },
  "IN.KA": { capital: "Bengaluru", population: "61,095,297 (2011 Census)", transit: "Namma Metro, Bengaluru suburban rail, KSRTC corridors" },
  "IN.KL": { capital: "Thiruvananthapuram", population: "33,406,061 (2011 Census)", transit: "Kochi Metro, Kerala rail corridor, ferries and buses" },
  "IN.LD": { capital: "Kavaratti", population: "64,473 (2011 Census)", transit: "Island ferry and air links" },
  "IN.MP": { capital: "Bhopal", population: "72,626,809 (2011 Census)", transit: "Bhopal and Indore transit corridors, central rail links" },
  "IN-MH": { capital: "Mumbai", transit: "Mumbai Suburban Railway, Metro, Monorail, BEST buses" },
  "IN.MN": { capital: "Imphal", population: "2,855,794 (2011 Census)", transit: "Imphal airport and regional road corridors" },
  "IN.ML": { capital: "Shillong", population: "2,966,889 (2011 Census)", transit: "Shillong road links, Guwahati rail/airport access" },
  "IN.MZ": { capital: "Aizawl", population: "1,097,206 (2011 Census)", transit: "Aizawl road network and Lengpui airport" },
  "IN.NL": { capital: "Kohima", population: "1,978,502 (2011 Census)", transit: "Dimapur rail/airport access and hill road links" },
  "IN.DL": { capital: "New Delhi", population: "16,787,941 (2011 Census)", transit: "Delhi Metro, Airport Express, NCR rail" },
  "IN.OR": { capital: "Bhubaneswar", population: "41,974,218 (2011 Census)", transit: "Bhubaneswar rail/airport, coastal rail corridors" },
  "IN.PY": { capital: "Puducherry", population: "1,247,953 (2011 Census)", transit: "Puducherry buses, rail links, coastal road corridors" },
  "IN.PB": { capital: "Chandigarh", population: "27,743,338 (2011 Census)", transit: "Punjab Roadways, Amritsar/Ludhiana rail, airport links" },
  "IN.RJ": { capital: "Jaipur", population: "68,548,437 (2011 Census)", transit: "Jaipur Metro, Rajasthan rail and bus corridors" },
  "IN.SK": { capital: "Gangtok", population: "610,577 (2011 Census)", transit: "Mountain road links, Pakyong airport, New Jalpaiguri rail access" },
  "IN-TG": { capital: "Hyderabad", transit: "Hyderabad Metro, MMTS, TSRTC buses" },
  "IN-TN": { capital: "Chennai", transit: "Chennai Metro, suburban rail, MRTS" },
  "IN.TR": { capital: "Agartala", population: "3,673,917 (2011 Census)", transit: "Agartala rail/airport and regional bus links" },
  "IN.UP": { capital: "Lucknow", population: "199,812,341 (2011 Census)", transit: "Lucknow Metro, Kanpur Metro, northern rail corridors" },
  "IN.UT": { capital: "Dehradun", population: "10,086,292 (2011 Census)", transit: "Dehradun rail/airport links, mountain road corridors" },
  "IN.WB": { capital: "Kolkata", population: "91,276,115 (2011 Census)", transit: "Kolkata Metro, suburban rail, tram heritage routes" },
  "AU-TAS": { capital: "Hobart", population: "about 572,000", transit: "Hobart bus network, Spirit of Tasmania ferry links, regional air access" },
  "AU-ACT": { capital: "Canberra", population: "about 473,000", transit: "Canberra light rail, ACTION buses, Canberra Airport links" },
  "KR-11": { capital: "Seoul", population: "9,586,195 (2020 Census)", transit: "Seoul Metro, AREX airport rail, KTX at Seoul Station" },
  "KR-26": { capital: "Busan", population: "3,349,016 (2020 Census)", transit: "Busan Metro, KTX, Port of Busan" },
  "KR-27": { capital: "Daegu", population: "2,410,700 (2020 Census)", transit: "Daegu Metro, Dongdaegu KTX hub" },
  "KR-28": { capital: "Incheon", population: "2,945,454 (2020 Census)", transit: "Incheon Subway, AREX, Incheon International Airport" },
  "KR-29": { capital: "Gwangju", population: "1,477,573 (2020 Census)", transit: "Gwangju Metro and regional bus network" },
  "KR-30": { capital: "Daejeon", population: "1,488,435 (2020 Census)", transit: "Daejeon Metro, KTX, central rail corridors" },
  "KR-31": { capital: "Ulsan", population: "1,135,423 (2020 Census)", transit: "Ulsan buses, port links, Donghae rail corridor" },
  "KR-41": { capital: "Suwon", population: "13,511,676 (2020 Census)", transit: "Seoul Metro extensions, Suin-Bundang Line, GTX corridors" },
  "KR-42": { capital: "Chuncheon", population: "1,521,763 (2020 Census)", transit: "ITX-Cheongchun, mountain road and rail links" },
  "KR-43": { capital: "Cheongju", population: "1,632,088 (2020 Census)", transit: "Cheongju airport access and central inland rail corridors" },
  "KR-44": { capital: "Hongseong", population: "2,176,636 (2020 Census)", transit: "West-coast rail and expressway corridors" },
  "KR-45": { capital: "Jeonju", population: "1,802,766 (2020 Census)", transit: "Jeonju rail and regional bus links" },
  "KR-46": { capital: "Muan", population: "1,788,807 (2020 Census)", transit: "Muan airport, Honam rail, island ferry connections" },
  "KR-47": { capital: "Andong", population: "2,644,757 (2020 Census)", transit: "Central inland rail and expressway corridors" },
  "KR-48": { capital: "Changwon", population: "3,333,056 (2020 Census)", transit: "Changwon-Masan rail, Busan metro-region links" },
  "KR-49": { capital: "Jeju", population: "670,858 (2020 Census)", transit: "Jeju buses, ferry routes, Jeju International Airport" },
  "NO-03": { capital: "Oslo", population: "about 700,000", transit: "Oslo Metro, trams, commuter rail, Oslo Airport rail link" },
  "NO-11": { capital: "Stavanger", population: "about 475,000", transit: "Jaeren Line, regional buses, Stavanger Airport links" },
  "NO-15": { capital: "Molde", population: "about 270,000", transit: "Coastal ferries, Atlantic Road corridors, Molde air links" },
  "NO-18": { capital: "Bodo", population: "about 239,000", transit: "Nordland Line, ferries, coastal aviation" },
  "NO-31": { capital: "Sarpsborg", population: "299,647", transit: "Ostfold Line, Oslofjord road and rail corridors" },
  "NO-32": { capital: "Oslo", population: "630,752", transit: "Oslo commuter rail, airport rail, regional buses" },
  "NO-33": { capital: "Drammen", population: "284,955", transit: "Drammen Line, Bergen Line gateway, regional buses" },
  "NO-34": { capital: "Hamar", population: "about 375,000", transit: "Dovre Line, Roros Line, inland road corridors" },
  "NO-39": { capital: "Tonsberg", population: "253,555", transit: "Vestfold Line, coastal buses, ferry links" },
  "NO-40": { capital: "Skien", population: "175,546", transit: "Bratsberg Line, Grenland buses, coastal routes" },
  "NO-42": { capital: "Kristiansand", population: "about 299,000", transit: "Sorlandet Line, ferry routes to Denmark, regional buses" },
  "NO-46": { capital: "Bergen", population: "about 632,000", transit: "Bergen Light Rail, Bergen Line, fjord ferries" },
  "NO-50": { capital: "Steinkjer", population: "about 465,000", transit: "Tronderbanen rail, Trondheim transit, coastal routes" },
  "NO-55": { capital: "Tromso", population: "168,340", transit: "Arctic buses, ferries, Tromso Airport links" },
  "NO-56": { capital: "Vadso", population: "75,540", transit: "Coastal ferries, Arctic road corridors, regional airports" },
  Corsica: { capital: "Ajaccio", transit: "Corsican railways, Ajaccio and Bastia ferry routes" },
  Sardinia: { capital: "Cagliari", transit: "Sardinian rail, Cagliari metrotranvia, ferry routes" },
  "Canary Islands": { capital: "Las Palmas de Gran Canaria", transit: "inter-island ferries, airports, Tenerife tram" },
  Azores: { capital: "Ponta Delgada", transit: "inter-island air and ferry links" },
  Ibiza: { capital: "Ibiza Town", transit: "ferry routes, buses, Ibiza Airport links" },
  "ZA-WC": { capital: "Cape Town", transit: "Metrorail Western Cape, MyCiTi, port and airport links" },
  "ZA-GP": { capital: "Johannesburg", transit: "Gautrain, Rea Vaya, Metrorail Gauteng" },
  "ZA-GT": { capital: "Johannesburg", transit: "Gautrain, Rea Vaya, Metrorail Gauteng" },
  "ZA.NL": { capital: "Pietermaritzburg", transit: "Metrorail Durban corridors, People Mover, King Shaka airport links" },
  England: { capital: "London", population: "about 57.7 million (mid-2024 estimate)", transit: "National Rail, London Underground, Elizabeth line, Manchester Metrolink; major airports LHR, LGW, MAN, BHX" },
  england: { capital: "London", population: "about 57.7 million (mid-2024 estimate)", transit: "National Rail, London Underground, Elizabeth line, Manchester Metrolink; major airports LHR, LGW, MAN, BHX" },
  Scotland: { capital: "Edinburgh", population: "5,546,900 (mid-2024 estimate)", transit: "ScotRail, Glasgow Subway, Edinburgh Trams; major airports EDI and GLA" },
  scotland: { capital: "Edinburgh", population: "5,546,900 (mid-2024 estimate)", transit: "ScotRail, Glasgow Subway, Edinburgh Trams; major airports EDI and GLA" },
  Wales: { capital: "Cardiff", population: "3,187,200 (mid-2024 estimate)", transit: "Transport for Wales rail, Cardiff bus corridors; major airport CWL" },
  wales: { capital: "Cardiff", population: "3,187,200 (mid-2024 estimate)", transit: "Transport for Wales rail, Cardiff bus corridors; major airport CWL" },
  "Northern Ireland": { capital: "Belfast", population: "1,957,000 (mid-2024 estimate)", transit: "Translink rail and Glider BRT; major airports BFS and BHD" },
  "northern-ireland": { capital: "Belfast", population: "1,957,000 (mid-2024 estimate)", transit: "Translink rail and Glider BRT; major airports BFS and BHD" },
  Alba: { capital: "Alba Iulia", transit: "county road and rail links through central Transylvania" },
  Arad: { capital: "Arad", transit: "Arad rail junction, tram network, and western border corridors" },
  Arges: { capital: "Pitesti", transit: "Pitesti rail and A1 motorway corridor" },
  "Argeș": { capital: "Pitesti", transit: "Pitesti rail and A1 motorway corridor" },
  Bacau: { capital: "Bacau", transit: "Bacau rail and airport links" },
  "Bacău": { capital: "Bacau", transit: "Bacau rail and airport links" },
  Bihor: { capital: "Oradea", transit: "Oradea rail, tram, airport, and border links" },
  "Bistrita-Nasaud": { capital: "Bistrita", transit: "Bistrita rail and northern Transylvania road links" },
  "Bistrița-Năsăud": { capital: "Bistrita", transit: "Bistrita rail and northern Transylvania road links" },
  Botosani: { capital: "Botosani", transit: "Botosani rail and Moldavia road links" },
  "Botoșani": { capital: "Botosani", transit: "Botosani rail and Moldavia road links" },
  Brasov: { capital: "Brasov", transit: "Brasov rail hub and mountain road corridors" },
  "Brașov": { capital: "Brasov", transit: "Brasov rail hub and mountain road corridors" },
  Braila: { capital: "Braila", transit: "Danube port, rail, and road corridors" },
  "Brăila": { capital: "Braila", transit: "Danube port, rail, and road corridors" },
  Bucharest: { capital: "Bucharest", transit: "Bucharest Metro, tram, rail, and OTP airport links" },
  Bucuresti: { capital: "Bucharest", transit: "Bucharest Metro, tram, rail, and OTP airport links" },
  "București": { capital: "Bucharest", transit: "Bucharest Metro, tram, rail, and OTP airport links" },
  Buzau: { capital: "Buzau", transit: "Buzau rail and eastern road corridors" },
  "Buzău": { capital: "Buzau", transit: "Buzau rail and eastern road corridors" },
  "Caras-Severin": { capital: "Resita", transit: "Banat mountain road and rail links" },
  "Caraș-Severin": { capital: "Resita", transit: "Banat mountain road and rail links" },
  Calarasi: { capital: "Calarasi", transit: "Danube road and rail access" },
  "Călărași": { capital: "Calarasi", transit: "Danube road and rail access" },
  Cluj: { capital: "Cluj-Napoca", transit: "Cluj-Napoca rail, airport, bus, and tram-trolleybus network" },
  Constanta: { capital: "Constanta", transit: "Black Sea port, rail, and A2 motorway links" },
  "Constanța": { capital: "Constanta", transit: "Black Sea port, rail, and A2 motorway links" },
  Covasna: { capital: "Sfantu Gheorghe", transit: "Szeklerland rail and road corridors" },
  Dambovita: { capital: "Targoviste", transit: "Targoviste rail and Muntenia road links" },
  "Dâmbovița": { capital: "Targoviste", transit: "Targoviste rail and Muntenia road links" },
  Dolj: { capital: "Craiova", transit: "Craiova rail, tram, and airport links" },
  Galati: { capital: "Galati", transit: "Danube port, rail, and road corridors" },
  "Galați": { capital: "Galati", transit: "Danube port, rail, and road corridors" },
  Giurgiu: { capital: "Giurgiu", transit: "Danube bridge and Bucharest-Ruse corridor" },
  Gorj: { capital: "Targu Jiu", transit: "Jiu Valley rail and mountain road links" },
  Harghita: { capital: "Miercurea Ciuc", transit: "Szeklerland rail and mountain road corridors" },
  Hunedoara: { capital: "Deva", transit: "Deva rail, A1 motorway, and Transylvania road links" },
  Ialomita: { capital: "Slobozia", transit: "Baragan road and rail links" },
  "Ialomița": { capital: "Slobozia", transit: "Baragan road and rail links" },
  Iasi: { capital: "Iasi", transit: "Iasi rail, tram, and airport links" },
  "Iași": { capital: "Iasi", transit: "Iasi rail, tram, and airport links" },
  Ilfov: { capital: "Bucharest", transit: "Bucharest suburban, ring-road, rail, and airport corridors" },
  Maramures: { capital: "Baia Mare", transit: "Baia Mare airport and northern rail/road links" },
  "Maramureș": { capital: "Baia Mare", transit: "Baia Mare airport and northern rail/road links" },
  Mehedinti: { capital: "Drobeta-Turnu Severin", transit: "Danube rail, road, and port access" },
  "Mehedinți": { capital: "Drobeta-Turnu Severin", transit: "Danube rail, road, and port access" },
  Mures: { capital: "Targu Mures", transit: "Targu Mures airport, rail, and central Transylvania road links" },
  "Mureș": { capital: "Targu Mures", transit: "Targu Mures airport, rail, and central Transylvania road links" },
  Neamt: { capital: "Piatra Neamt", transit: "Moldavia rail and mountain road links" },
  "Neamț": { capital: "Piatra Neamt", transit: "Moldavia rail and mountain road links" },
  Olt: { capital: "Slatina", transit: "Olt Valley road and rail links" },
  Prahova: { capital: "Ploiesti", transit: "Ploiesti rail, tram, and Bucharest-Brasov corridor" },
  "Satu Mare": { capital: "Satu Mare", transit: "Satu Mare rail, airport, and border corridors" },
  Salaj: { capital: "Zalau", transit: "northwestern road and rail links" },
  "Sălaj": { capital: "Zalau", transit: "northwestern road and rail links" },
  Sibiu: { capital: "Sibiu", transit: "Sibiu rail, airport, and Transylvania road corridors" },
  Suceava: { capital: "Suceava", transit: "Suceava airport, rail, and Bukovina road links" },
  Teleorman: { capital: "Alexandria", transit: "southern Muntenia road and rail links" },
  Timis: { capital: "Timisoara", transit: "Timisoara rail, tram, airport, and western border corridors" },
  "Timiș": { capital: "Timisoara", transit: "Timisoara rail, tram, airport, and western border corridors" },
  Tulcea: { capital: "Tulcea", transit: "Danube Delta port, ferry, and road links" },
  Vaslui: { capital: "Vaslui", transit: "Moldavia road and rail links" },
  Valcea: { capital: "Ramnicu Valcea", transit: "Olt Valley road and rail links" },
  "Vâlcea": { capital: "Ramnicu Valcea", transit: "Olt Valley road and rail links" },
  Vrancea: { capital: "Focsani", transit: "Focsani rail and eastern road corridors" },
  "IT-62": { capital: "Rome", transit: "Rome Metro, Lazio regional rail, Roma Termini, Fiumicino rail" },
  "IT-25": { capital: "Milan", transit: "Milan Metro, Trenord, tram network, Malpensa rail" },
  "FR.IF": { capital: "Paris", transit: "Paris Metro, RER, Transilien, tramways, CDG/Orly rail links" },
  "FR.AR": { capital: "Lyon", transit: "Lyon Metro, trams, TGV and TER regional rail" },
  "auvergne-rhone-alpes": { capital: "Lyon", transit: "Lyon Metro, Grenoble trams, TER Auvergne-Rhone-Alpes, TGV links" },
  "bourgogne-franche-comte": { capital: "Dijon", transit: "TER Bourgogne-Franche-Comte, Dijon tramway, TGV links" },
  brittany: { capital: "Rennes", transit: "Rennes Metro, TER Bretagne, regional coach and ferry links" },
  "centre-val-de-loire": { capital: "Orleans", transit: "Tours and Orleans tramways, TER Centre-Val de Loire" },
  corsica: { capital: "Ajaccio", transit: "Corsican Railways, ferries, Ajaccio and Bastia airports" },
  "grand-est": { capital: "Strasbourg", transit: "Strasbourg tramway, TER Grand Est, TGV Est" },
  "hauts-de-france": { capital: "Lille", transit: "Lille Metro, TER Hauts-de-France, TGV and Eurostar links" },
  "ile-de-france": { capital: "Paris", transit: "Paris Metro, RER, Transilien, tramways, CDG and Orly airport links" },
  normandy: { capital: "Rouen", transit: "TER Normandie, Rouen tramway, Caen tramway, ferry links" },
  "nouvelle-aquitaine": { capital: "Bordeaux", transit: "Bordeaux tramway, TER Nouvelle-Aquitaine, TGV Atlantique" },
  occitanie: { capital: "Toulouse", transit: "Toulouse Metro, Montpellier trams, TER Occitanie" },
  "pays-de-la-loire": { capital: "Nantes", transit: "Nantes tramway, TER Pays de la Loire, Atlantic rail corridors" },
  "provence-alpes-cote-d-azur": { capital: "Marseille", transit: "Marseille Metro, Nice tramway, TER Zou!, TGV Mediterranee" },
  guadeloupe: { capital: "Basse-Terre", transit: "Regional buses, ferry links, Pointe-a-Pitre airport" },
  martinique: { capital: "Fort-de-France", transit: "TCSP Martinique BRT, ferries, airport links" },
  guyane: { capital: "Cayenne", transit: "Regional road links, Cayenne-Felix Eboue airport" },
  reunion: { capital: "Saint-Denis", transit: "Car Jaune regional buses, island road corridors, Roland Garros airport" },
  mayotte: { capital: "Mamoudzou", transit: "Ferry and road links, Dzaoudzi-Pamandzi airport" },
  hokkaido: { capital: "Sapporo", transit: "Sapporo Subway, JR Hokkaido, airport rail to New Chitose" },
  aomori: { capital: "Aomori", transit: "JR East, Aoimori Railway, Tohoku Shinkansen access" },
  iwate: { capital: "Morioka", transit: "Tohoku Shinkansen, JR East regional rail, IGR Iwate Galaxy Railway" },
  miyagi: { capital: "Sendai", transit: "Sendai Subway, Tohoku Shinkansen, airport rail" },
  akita: { capital: "Akita", transit: "Akita Shinkansen, JR Ou and Uetsu lines, Akita airport links" },
  yamagata: { capital: "Yamagata", transit: "Yamagata Shinkansen, JR Senzan and Ou lines" },
  fukushima: { capital: "Fukushima", transit: "Tohoku and Yamagata Shinkansen, JR East regional rail" },
  ibaraki: { capital: "Mito", transit: "JR Joban Line, Tsukuba Express access, Ibaraki airport links" },
  tochigi: { capital: "Utsunomiya", transit: "Tohoku Shinkansen, Utsunomiya Light Rail, JR regional lines" },
  gunma: { capital: "Maebashi", transit: "Joetsu and Hokuriku Shinkansen access, JR Ryomo and Takasaki lines" },
  saitama: { capital: "Saitama", transit: "JR East, Saitama Railway, Tobu and Seibu networks" },
  chiba: { capital: "Chiba", transit: "JR East, Keisei, Chiba Urban Monorail, Narita airport rail" },
  tokyo: { capital: "Tokyo", transit: "Tokyo Metro, Toei Subway, JR East, private railways" },
  kanagawa: { capital: "Yokohama", transit: "Yokohama Subway, JR East, Tokyu, Keikyu, Minatomirai Line" },
  niigata: { capital: "Niigata", transit: "Joetsu Shinkansen, JR East regional rail, port and airport links" },
  toyama: { capital: "Toyama", transit: "Hokuriku Shinkansen, Toyama tram network, Ainokaze Railway" },
  ishikawa: { capital: "Kanazawa", transit: "Hokuriku Shinkansen, IR Ishikawa Railway, bus corridors" },
  fukui: { capital: "Fukui", transit: "Hokuriku Shinkansen, Echizen Railway, Fukui Railway tram-train" },
  yamanashi: { capital: "Kofu", transit: "JR Chuo Main Line, Fujikyu Railway, bus links to Fuji Five Lakes" },
  nagano: { capital: "Nagano", transit: "Hokuriku Shinkansen, Shinano Railway, Nagano Dentetsu" },
  gifu: { capital: "Gifu", transit: "JR Central, Meitetsu, Takayama Main Line" },
  shizuoka: { capital: "Shizuoka", transit: "Tokaido Shinkansen, JR Tokaido Line, Shizutetsu Railway" },
  aichi: { capital: "Nagoya", transit: "Nagoya Subway, Meitetsu, JR Central, Shinkansen access" },
  mie: { capital: "Tsu", transit: "Kintetsu, JR Central, Ise Railway" },
  shiga: { capital: "Otsu", transit: "JR Biwako Line, Keihan Ishiyama Sakamoto Line, Lake Biwa corridors" },
  kyoto: { capital: "Kyoto", transit: "Kyoto Municipal Subway, JR West, private railways, Shinkansen" },
  osaka: { capital: "Osaka", transit: "Osaka Metro, JR West, Hankyu, Hanshin, Kintetsu" },
  hyogo: { capital: "Kobe", transit: "Kobe Subway, JR West, Hankyu, Hanshin, Sanyo Shinkansen" },
  nara: { capital: "Nara", transit: "Kintetsu Railway, JR West, regional bus links" },
  wakayama: { capital: "Wakayama", transit: "JR West, Nankai Railway, ferry links" },
  tottori: { capital: "Tottori", transit: "JR Sanin Line, regional bus and airport links" },
  shimane: { capital: "Matsue", transit: "JR Sanin Line, Ichibata Electric Railway, airport links" },
  okayama: { capital: "Okayama", transit: "Sanyo Shinkansen, Okayama Electric Tramway, JR regional hub" },
  hiroshima: { capital: "Hiroshima", transit: "Hiroshima Electric Railway, JR West, Sanyo Shinkansen" },
  yamaguchi: { capital: "Yamaguchi", transit: "Sanyo Shinkansen access, JR West regional lines" },
  tokushima: { capital: "Tokushima", transit: "JR Shikoku, regional buses, ferry links" },
  kagawa: { capital: "Takamatsu", transit: "JR Shikoku, Kotoden rail, ferry links" },
  ehime: { capital: "Matsuyama", transit: "Iyotetsu trams and rail, JR Shikoku" },
  kochi: { capital: "Kochi", transit: "Tosa Electric Railway trams, JR Shikoku, airport links" },
  fukuoka: { capital: "Fukuoka", transit: "Fukuoka Subway, JR Kyushu, Nishitetsu, Sanyo/Kyushu Shinkansen" },
  saga: { capital: "Saga", transit: "JR Kyushu Nagasaki Main Line, airport and bus links" },
  nagasaki: { capital: "Nagasaki", transit: "Nagasaki Electric Tramway, Nishi Kyushu Shinkansen" },
  kumamoto: { capital: "Kumamoto", transit: "Kumamoto City Tram, JR Kyushu, Kyushu Shinkansen" },
  oita: { capital: "Oita", transit: "JR Kyushu Nippo Main Line, airport and ferry links" },
  miyazaki: { capital: "Miyazaki", transit: "JR Kyushu, airport rail access, regional buses" },
  kagoshima: { capital: "Kagoshima", transit: "Kagoshima City Tram, Kyushu Shinkansen, ferry links" },
  okinawa: { capital: "Naha", transit: "Yui Rail monorail, Naha airport, island bus network" },
  "new-south-wales": { capital: "Sydney", transit: "Sydney Trains, Sydney Metro, light rail, ferries" },
  queensland: { capital: "Brisbane", transit: "Queensland Rail Citytrain, Brisbane busways, Gold Coast light rail" },
  "south-australia": { capital: "Adelaide", transit: "Adelaide Metro trains, trams, O-Bahn busway" },
  tasmania: { capital: "Hobart", transit: "Metro Tasmania buses, ferry and airport links" },
  victoria: { capital: "Melbourne", transit: "Melbourne trams, trains, V/Line, airport bus links" },
  "western-australia": { capital: "Perth", transit: "Transperth trains, buses, ferries, Airport Line" },
  "australian-capital-territory": { capital: "Canberra", transit: "Canberra light rail, ACTION buses, airport links" },
  "northern-territory": { capital: "Darwin", transit: "Darwin buses, Ghan rail terminal, airport and port links" },
  "eastern-cape": { capital: "Bhisho", transit: "Metrorail Eastern Cape corridors, ports, East London and Gqeberha airports" },
  "free-state": { capital: "Bloemfontein", transit: "Mangaung buses, national rail and road corridors" },
  gauteng: { capital: "Johannesburg", transit: "Gautrain, Rea Vaya, Metrorail Gauteng" },
  "kwazulu-natal": { capital: "Pietermaritzburg", transit: "Metrorail Durban corridors, People Mover, King Shaka airport links" },
  limpopo: { capital: "Polokwane", transit: "Regional bus corridors, Polokwane airport links" },
  mpumalanga: { capital: "Mbombela", transit: "Regional buses, N4 corridor, Kruger Mpumalanga airport links" },
  "north-west": { capital: "Mahikeng", transit: "Regional road and bus links, Pilanesberg airport access" },
  "northern-cape": { capital: "Kimberley", transit: "Regional rail, bus corridors, Kimberley airport links" },
  "western-cape": { capital: "Cape Town", transit: "Metrorail Western Cape, MyCiTi, port and airport links" },
  "abu-dhabi": { capital: "Abu Dhabi", population: "4,135,985 (2024)", transit: "Zayed International Airport, Abu Dhabi Central Bus Station, Etihad Rail hub, Yas Island links" },
  ajman: { capital: "Ajman", population: "582,852 (2024)", transit: "Ajman bus network, Dubai-Sharjah-Ajman road corridors, DXB/SHJ airport access" },
  dubai: { capital: "Dubai", population: "3,759,864 (2024)", transit: "Dubai Metro, Dubai Tram, DXB, Jebel Ali, intercity buses" },
  fujairah: { capital: "Fujairah", population: "314,829 (2024)", transit: "Fujairah International Airport, port links, E84/E89 road corridors" },
  "ras-al-khaimah": { capital: "Ras Al Khaimah", population: "400,000 (2023)", transit: "Ras Al Khaimah International Airport, intercity buses, northern emirates road links" },
  sharjah: { capital: "Sharjah", population: "1,800,000 (2022)", transit: "Sharjah bus network, SHJ airport, Dubai-Sharjah commuter corridors" },
  "umm-al-quwain": { capital: "Umm Al Quwain", population: "72,000 (2007)", transit: "Northern emirates road links and Dubai/Sharjah airport access" },
  "addis-ababa": { capital: "Addis Ababa", transit: "Addis Ababa Light Rail, city buses, Bole International Airport" },
  afar: { capital: "Semera", transit: "Awash rail corridor, Semera airport, road links to Djibouti" },
  amhara: { capital: "Bahir Dar", transit: "Bahir Dar airport, regional roads, lake ferry links" },
  "benshangul-gumaz": { capital: "Asosa", transit: "Asosa airport and regional road links" },
  "central-ethiopia": { capital: "Hosaena", transit: "Regional road corridors toward Addis Ababa and Hawassa" },
  "dire-dawa": { capital: "Dire Dawa", transit: "Addis Ababa-Djibouti Railway, Dire Dawa airport" },
  "gambela-peoples": { capital: "Gambela", transit: "Gambela airport and western road corridors" },
  "harari-people": { capital: "Harar", transit: "Dire Dawa rail/airport access and regional roads" },
  oromia: { capital: "Addis Ababa", transit: "Addis Ababa links, regional rail, Bole International Airport access" },
  sidama: { capital: "Hawassa", transit: "Hawassa road corridors and airport access" },
  somali: { capital: "Jijiga", transit: "Jijiga airport and eastern road corridors" },
  "south-ethiopia": { capital: "Wolaita Sodo", transit: "Southern road corridors and regional bus links" },
  "south-west-ethiopia": { capital: "Bonga", transit: "Western road corridors and regional bus links" },
  tigray: { capital: "Mekelle", transit: "Mekelle airport and northern road corridors" },
  "southern-nations-nationalities": { capital: "Hawassa", transit: "Southern road corridors and regional bus links" },
  "GB.GL": { capital: "London", transit: "London Underground, Elizabeth line, Overground, DLR" },
  "GB.NY": { capital: "Northallerton", transit: "York rail hub, TransPennine, Northern, East Coast Main Line access" },
  "US-AK": { capital: "Juneau", population: "about 730,000", transit: "Alaska Railroad, Anchorage People Mover, ferry and air links" },
  "US-AR": { capital: "Little Rock", population: "about 3.1 million", transit: "Rock Region METRO, River Rail streetcar, intercity bus corridors" },
  "US-CT": { capital: "Hartford", population: "about 3.6 million", transit: "CTrail, Metro-North, CTtransit, Bradley airport links" },
  "US-DE": { capital: "Dover", population: "about 1 million", transit: "DART First State, Wilmington rail, SEPTA regional links" },
  "US-HI": { capital: "Honolulu", population: "about 1.4 million", transit: "Skyline rail, TheBus, inter-island air links" },
  "US-ID": { capital: "Boise", population: "about 2 million", transit: "Valley Regional Transit, Boise airport links" },
  "US-IN": { capital: "Indianapolis", population: "about 6.9 million", transit: "IndyGo Red Line, South Shore Line, Amtrak corridor service" },
  "US-KS": { capital: "Topeka", population: "about 2.9 million", transit: "KC Streetcar regional edge, Topeka Metro, Wichita Transit" },
  "US-KY": { capital: "Frankfort", population: "about 4.5 million", transit: "TARC Louisville, Lextran, Cincinnati/Northern Kentucky airport links" },
  "US-LA": { capital: "Baton Rouge", population: "about 4.6 million", transit: "New Orleans streetcars, RTA, Baton Rouge CATS" },
  "US-ME": { capital: "Augusta", population: "about 1.4 million", transit: "Downeaster rail, METRO Portland, ferry links" },
  "US-MD": { capital: "Annapolis", population: "about 6.2 million", transit: "MARC, Baltimore Metro SubwayLink, Light RailLink, WMATA links" },
  "US-MN": { capital: "Saint Paul", population: "about 5.8 million", transit: "Metro Transit light rail, Northstar, MSP airport rail" },
  "US-MS": { capital: "Jackson", population: "about 2.9 million", transit: "JTRAN, Coast Transit, intercity rail and bus corridors" },
  "US-MT": { capital: "Helena", population: "about 1.1 million", transit: "Mountain Line Missoula, Streamline Bozeman, regional air links" },
  "US-NE": { capital: "Lincoln", population: "about 2 million", transit: "Omaha Metro, StarTran Lincoln, Amtrak California Zephyr" },
  "US-NV": { capital: "Carson City", population: "about 3.2 million", transit: "RTC Southern Nevada, Las Vegas Monorail, Reno RTC" },
  "US-NH": { capital: "Concord", population: "about 1.4 million", transit: "Manchester Transit, Concord Coach, Downeaster access nearby" },
  "US-NJ": { capital: "Trenton", population: "about 9.3 million", transit: "NJ Transit rail, PATH, Hudson-Bergen Light Rail, Newark AirTrain" },
  "US-NM": { capital: "Santa Fe", population: "about 2.1 million", transit: "New Mexico Rail Runner, ABQ Ride, Santa Fe Trails" },
  "US-ND": { capital: "Bismarck", population: "about 780,000", transit: "Bis-Man Transit, Fargo MATBUS, Amtrak Empire Builder" },
  "US-OH": { capital: "Columbus", population: "about 11.8 million", transit: "COTA, RTA Cleveland rail, Cincinnati streetcar" },
  "US-OK": { capital: "Oklahoma City", population: "about 4 million", transit: "OKC Streetcar, EMBARK, Tulsa Transit" },
  "US-OR": { capital: "Salem", population: "about 4.2 million", transit: "TriMet MAX, Portland Streetcar, WES, Amtrak Cascades" },
  "US-RI": { capital: "Providence", population: "about 1.1 million", transit: "RIPTA, Providence rail, MBTA commuter rail links" },
  "US-SC": { capital: "Columbia", population: "about 5.4 million", transit: "The COMET, CARTA Charleston, regional airport links" },
  "US-SD": { capital: "Pierre", population: "about 920,000", transit: "Sioux Area Metro, River Cities Transit, regional air links" },
  "US-TN": { capital: "Nashville", population: "about 7.2 million", transit: "WeGo Nashville, Memphis MATA, Music City Star" },
  "US-UT": { capital: "Salt Lake City", population: "about 3.5 million", transit: "UTA TRAX, FrontRunner, Salt Lake airport rail" },
  "US-VT": { capital: "Montpelier", population: "about 650,000", transit: "Green Mountain Transit, Amtrak Vermonter and Ethan Allen Express" },
  "US-VA": { capital: "Richmond", population: "about 8.8 million", transit: "WMATA Virginia stations, GRTC Pulse, VRE, Amtrak corridors" },
  "US-WV": { capital: "Charleston", population: "about 1.8 million", transit: "Kanawha Valley bus, MARC edge service, Amtrak Cardinal" },
  "US-WI": { capital: "Madison", population: "about 5.9 million", transit: "Milwaukee Hop, Madison Metro, Amtrak Hiawatha" },
  "US-WY": { capital: "Cheyenne", population: "about 590,000", transit: "Cheyenne Transit, START Bus Jackson, regional air links" },
  "CA-AB": { capital: "Edmonton", population: "about 5 million", transit: "Edmonton LRT, Calgary CTrain, airport bus links" },
  "CA-MB": { capital: "Winnipeg", population: "about 1.5 million", transit: "Winnipeg Transit, Union Station rail, airport links" },
  "CA-NB": { capital: "Fredericton", population: "about 870,000", transit: "Fredericton Transit, Saint John Transit, VIA Rail access nearby" },
  "CA-NL": { capital: "St. John's", population: "about 550,000", transit: "Metrobus St. John's, Marine Atlantic ferry and air links" },
  "CA-NS": { capital: "Halifax", population: "about 1.1 million", transit: "Halifax Transit buses and ferries, VIA Rail Ocean" },
  "CA-NT": { capital: "Yellowknife", population: "about 45,000", transit: "Yellowknife Transit and northern air links" },
  "CA-NU": { capital: "Iqaluit", population: "about 40,000", transit: "Air and sealift links; no intercity road or rail network" },
  "CA-PE": { capital: "Charlottetown", population: "about 180,000", transit: "T3 Transit, ferry and Confederation Bridge road links" },
  "CA-SK": { capital: "Regina", population: "about 1.3 million", transit: "Regina Transit, Saskatoon Transit, intercity highway and air links" },
  "CA-YT": { capital: "Whitehorse", population: "about 48,000", transit: "Whitehorse Transit and northern air links" },
  abruzzo: { capital: "L'Aquila", transit: "Regional rail and Adriatic corridor links through Pescara" },
  "aosta-valley": { capital: "Aosta", transit: "Aosta Valley rail and Alpine bus links" },
  apulia: { capital: "Bari", transit: "Bari Metro, regional rail, Adriatic port and airport links" },
  basilicata: { capital: "Potenza", transit: "Regional rail and bus links through Potenza and Matera" },
  calabria: { capital: "Catanzaro", transit: "Ferrovie della Calabria, regional rail, Lamezia Terme airport links" },
  campania: { capital: "Naples", transit: "Naples Metro, Circumvesuviana, high-speed rail, ferry links" },
  "emilia-romagna": { capital: "Bologna", transit: "Bologna Centrale, high-speed rail, regional rail and airport links" },
  "friuli-venezia-giulia": { capital: "Trieste", transit: "Trieste rail, regional trains, port and airport links" },
  lazio: { capital: "Rome", transit: "Rome Metro, Lazio regional rail, Roma Termini, Fiumicino rail" },
  liguria: { capital: "Genoa", transit: "Genoa Metro, Ligurian coastal rail, port and airport links" },
  lombardy: { capital: "Milan", transit: "Milan Metro, Trenord, tram network, Malpensa rail" },
  marche: { capital: "Ancona", transit: "Adriatic rail corridor, port, regional bus links" },
  molise: { capital: "Campobasso", transit: "Regional rail and bus links through Campobasso and Termoli" },
  piedmont: { capital: "Turin", transit: "Turin Metro, regional rail, high-speed rail to Milan/France" },
  sardinia: { capital: "Cagliari", transit: "Cagliari light rail, regional rail, ferry and airport links" },
  sicily: { capital: "Palermo", transit: "Palermo rail, Catania Metro, ferry and airport links" },
  "trentino-alto-adige": { capital: "Trento", transit: "Brenner rail corridor, regional rail and Alpine bus links" },
  tuscany: { capital: "Florence", transit: "Florence tramway, high-speed rail, regional rail to Pisa and Siena" },
  umbria: { capital: "Perugia", transit: "Minimetro Perugia, regional rail and bus links" },
  veneto: { capital: "Venice", transit: "Venice Santa Lucia, ACTV waterbus, regional rail and airport links" },
  "ilocos-region": { capital: "San Fernando", transit: "Regional bus corridors and Laoag/San Fernando air-road links" },
  "cagayan-valley": { capital: "Tuguegarao", transit: "Regional bus links and Tuguegarao airport access" },
  "central-luzon": { capital: "San Fernando", transit: "North-South Commuter Railway corridor, Clark airport links" },
  calabarzon: { capital: "Calamba", transit: "PNR South corridor, expressway bus links, Manila commuter edge" },
  mimaropa: { capital: "Calapan", transit: "Ferry links, regional buses, Puerto Princesa airport access" },
  "bicol-region": { capital: "Legazpi", transit: "PNR Bicol corridor, Legazpi/Daraga airport links" },
  "western-visayas": { capital: "Iloilo City", transit: "Iloilo transport hub, ferry links, regional airports" },
  "central-visayas": { capital: "Cebu City", transit: "Cebu BRT corridor, ferries, Mactan-Cebu airport" },
  "eastern-visayas": { capital: "Tacloban", transit: "Tacloban airport, ferry and highway links" },
  "zamboanga-peninsula": { capital: "Pagadian", transit: "Regional bus, ferry, Zamboanga and Pagadian airport links" },
  "northern-mindanao": { capital: "Cagayan de Oro", transit: "Laguindingan airport, port and regional bus links" },
  "davao-region": { capital: "Davao City", transit: "Davao bus corridors, port and airport links" },
  soccsksargen: { capital: "Koronadal", transit: "General Santos airport, regional bus and highway links" },
  caraga: { capital: "Butuan", transit: "Butuan airport, regional bus and ferry links" },
  barmm: { capital: "Cotabato City", transit: "Cotabato airport, ferry and regional road links" },
  "cordillera-administrative-region": { capital: "Baguio", transit: "Mountain bus corridors and Baguio gateway links" },
  "national-capital-region": { capital: "Manila", transit: "LRT, MRT, PNR, NAIA and commuter bus links" },
};

const regionalPopulationByCode: Record<string, string> = {
  "AU-ACT": "486,200 (Sep. 30, 2025 estimate)",
  "AU-NSW": "8,624,500 (Sep. 30, 2025 estimate)",
  "AU-NT": "265,500 (Sep. 30, 2025 estimate)",
  "AU-QLD": "5,692,600 (Sep. 30, 2025 estimate)",
  "AU-SA": "1,908,200 (Sep. 30, 2025 estimate)",
  "AU-TAS": "576,700 (Sep. 30, 2025 estimate)",
  "AU-VIC": "7,104,300 (Sep. 30, 2025 estimate)",
  "AU-WA": "3,061,700 (Sep. 30, 2025 estimate)",
  "CA-AB": "5,048,151 (Q1 2026 estimate)",
  "CA-BC": "5,658,528 (Q1 2026 estimate)",
  "CA-MB": "1,505,117 (Q1 2026 estimate)",
  "CA-NB": "867,383 (Q1 2026 estimate)",
  "CA-NL": "548,557 (Q1 2026 estimate)",
  "CA-NS": "1,090,074 (Q1 2026 estimate)",
  "CA-ON": "16,136,480 (Q1 2026 estimate)",
  "CA-PE": "182,001 (Q1 2026 estimate)",
  "CA-QC": "9,033,887 (Q1 2026 estimate)",
  "CA-SK": "1,265,936 (Q1 2026 estimate)",
  "CA-YT": "48,218 (Q1 2026 estimate)",
  "IN-AP": "49,577,103 (2011 census)",
  "IN-AS": "31,205,576 (2011 census)",
  "IN-BR": "104,099,452 (2011 census)",
  "IN-CT": "25,545,198 (2011 census)",
  "IN-DL": "16,787,941 (2011 census)",
  "IN-GJ": "60,439,692 (2011 census)",
  "IN-HR": "25,351,462 (2011 census)",
  "IN-JK": "12,541,302 (2011 census)",
  "IN-KA": "61,095,297 (2011 census)",
  "IN-KL": "33,406,061 (2011 census)",
  "IN-MH": "112,374,333 (2011 census)",
  "IN-MP": "72,626,809 (2011 census)",
  "IN-OR": "41,974,218 (2011 census)",
  "IN-PB": "27,743,338 (2011 census)",
  "IN-RJ": "68,548,437 (2011 census)",
  "IN-TN": "72,147,030 (2011 census)",
  "IN-TG": "35,193,978 (2011 census)",
  "IN-UP": "199,812,341 (2011 census)",
  "IN-WB": "91,276,115 (2011 census)",
  "JP-01": "5,091,000 (2024 estimate)",
  "JP-13": "14,180,000 (2024 estimate)",
  "JP-23": "7,480,000 (2024 estimate)",
  "JP-26": "2,540,000 (2024 estimate)",
  "JP-27": "8,770,000 (2024 estimate)",
  "JP-34": "2,730,000 (2024 estimate)",
  "JP-40": "5,130,000 (2024 estimate)",
  "MX-AGU": "1,425,607 (2020 census)",
  "MX-BCN": "3,769,020 (2020 census)",
  "MX-BCS": "798,447 (2020 census)",
  "MX-CAM": "928,363 (2020 census)",
  "MX-CHH": "3,741,869 (2020 census)",
  "MX-CHP": "5,543,828 (2020 census)",
  "MX-CMX": "9,209,944 (2020 census)",
  "MX-COA": "3,146,771 (2020 census)",
  "MX-COL": "731,391 (2020 census)",
  "MX-DUR": "1,857,985 (2020 census)",
  "MX-GRO": "3,540,685 (2020 census)",
  "MX-GUA": "6,166,934 (2020 census)",
  "MX-HID": "3,082,841 (2020 census)",
  "MX-JAL": "8,348,151 (2020 census)",
  "MX-MEX": "16,992,418 (2020 census)",
  "MX-MIC": "4,748,846 (2020 census)",
  "MX-MOR": "1,971,520 (2020 census)",
  "MX-NAY": "1,235,456 (2020 census)",
  "MX-NLE": "5,784,442 (2020 census)",
  "MX-OAX": "4,132,148 (2020 census)",
  "MX-PUE": "6,583,278 (2020 census)",
  "MX-QUE": "2,368,467 (2020 census)",
  "MX-ROO": "1,857,985 (2020 census)",
  "MX-SIN": "3,026,943 (2020 census)",
  "MX-SLP": "2,822,255 (2020 census)",
  "MX-SON": "2,944,840 (2020 census)",
  "MX-TAB": "2,402,598 (2020 census)",
  "MX-TAM": "3,527,735 (2020 census)",
  "MX-TLA": "1,342,977 (2020 census)",
  "MX-VER": "8,062,579 (2020 census)",
  "MX-YUC": "2,320,898 (2020 census)",
  "MX-ZAC": "1,832,650 (2020 census)",
  "US-AK": "737,270 (July 1, 2025 estimate)",
  "US-AL": "5,193,088 (July 1, 2025 estimate)",
  "US-AR": "3,114,791 (July 1, 2025 estimate)",
  "US-AZ": "7,623,818 (July 1, 2025 estimate)",
  "US-CA": "39,355,309 (July 1, 2025 estimate)",
  "US-CO": "6,012,561 (July 1, 2025 estimate)",
  "US-CT": "3,688,496 (July 1, 2025 estimate)",
  "US-DC": "693,645 (July 1, 2025 estimate)",
  "US-DE": "1,059,952 (July 1, 2025 estimate)",
  "US-FL": "23,462,518 (July 1, 2025 estimate)",
  "US-GA": "11,302,748 (July 1, 2025 estimate)",
  "US-HI": "1,432,820 (July 1, 2025 estimate)",
  "US-IA": "3,238,387 (July 1, 2025 estimate)",
  "US-ID": "2,029,733 (July 1, 2025 estimate)",
  "US-IL": "12,719,141 (July 1, 2025 estimate)",
  "US-IN": "6,973,333 (July 1, 2025 estimate)",
  "US-KS": "2,977,220 (July 1, 2025 estimate)",
  "US-KY": "4,606,864 (July 1, 2025 estimate)",
  "US-LA": "4,618,189 (July 1, 2025 estimate)",
  "US-MA": "7,154,084 (July 1, 2025 estimate)",
  "US-MD": "6,265,347 (July 1, 2025 estimate)",
  "US-ME": "1,414,874 (July 1, 2025 estimate)",
  "US-MI": "10,127,884 (July 1, 2025 estimate)",
  "US-MN": "5,830,405 (July 1, 2025 estimate)",
  "US-MO": "6,270,541 (July 1, 2025 estimate)",
  "US-MS": "2,954,160 (July 1, 2025 estimate)",
  "US-MT": "1,144,694 (July 1, 2025 estimate)",
  "US-NC": "11,197,968 (July 1, 2025 estimate)",
  "US-ND": "799,358 (July 1, 2025 estimate)",
  "US-NE": "2,018,006 (July 1, 2025 estimate)",
  "US-NH": "1,415,342 (July 1, 2025 estimate)",
  "US-NJ": "9,548,215 (July 1, 2025 estimate)",
  "US-NM": "2,125,498 (July 1, 2025 estimate)",
  "US-NV": "3,282,188 (July 1, 2025 estimate)",
  "US-NY": "20,002,427 (July 1, 2025 estimate)",
  "US-OH": "11,900,510 (July 1, 2025 estimate)",
  "US-OK": "4,123,288 (July 1, 2025 estimate)",
  "US-OR": "4,273,586 (July 1, 2025 estimate)",
  "US-PA": "13,059,432 (July 1, 2025 estimate)",
  "US-RI": "1,114,521 (July 1, 2025 estimate)",
  "US-SC": "5,570,274 (July 1, 2025 estimate)",
  "US-SD": "935,094 (July 1, 2025 estimate)",
  "US-TN": "7,315,076 (July 1, 2025 estimate)",
  "US-TX": "31,709,821 (July 1, 2025 estimate)",
  "US-UT": "3,538,904 (July 1, 2025 estimate)",
  "US-VA": "8,880,107 (July 1, 2025 estimate)",
  "US-VT": "644,663 (July 1, 2025 estimate)",
  "US-WA": "8,001,020 (July 1, 2025 estimate)",
  "US-WI": "5,972,787 (July 1, 2025 estimate)",
  "US-WV": "1,766,147 (July 1, 2025 estimate)",
  "US-WY": "588,753 (July 1, 2025 estimate)",
  "ZA-EC": "6,676,000 (2022 census)",
  "ZA-FS": "2,965,000 (2022 census)",
  "ZA-GP": "15,100,000 (2022 census)",
  "ZA.GT": "15,100,000 (2022 census)",
  "ZA-KZN": "12,400,000 (2022 census)",
  "ZA.NL": "12,400,000 (2022 census)",
  "ZA-LP": "6,572,000 (2022 census)",
  "ZA-MP": "5,144,000 (2022 census)",
  "ZA-NC": "1,356,000 (2022 census)",
  "ZA-NW": "4,804,000 (2022 census)",
  "ZA.NW": "4,804,000 (2022 census)",
  "ZA-WC": "7,433,000 (2022 census)",
};

const regionalPopulationByName: Record<string, string> = {
  Abruzzo: "1,267,222 (Jan. 1, 2026 estimate)",
  Aichi: "7,475,630 (Apr. 1, 2023 estimate)",
  Akita: "918,811 (Apr. 1, 2023 estimate)",
  Aomori: "1,190,685 (Apr. 1, 2023 estimate)",
  "Andaman and Nicobar Islands": "380,581 (2011 Census)",
  "Andhra Pradesh": "84,580,777 (2011 Census; includes Telangana at the time)",
  Apulia: "3,865,277 (Jan. 1, 2026 estimate)",
  "Arunachal Pradesh": "1,383,727 (2011 Census)",
  Assam: "31,205,576 (2011 Census)",
  Basilicata: "525,281 (Jan. 1, 2026 estimate)",
  Bihar: "104,099,452 (2011 Census)",
  Calabria: "1,827,571 (Jan. 1, 2026 estimate)",
  Campania: "5,568,703 (Jan. 1, 2026 estimate)",
  Chandigarh: "1,055,450 (2011 Census)",
  Chiba: "6,269,572 (Apr. 1, 2023 estimate)",
  Chhattisgarh: "25,545,198 (2011 Census)",
  "Dadra and Nagar Haveli": "343,709 (2011 Census)",
  "Daman and Diu": "243,247 (2011 Census)",
  "Emilia-Romagna": "4,477,009 (Jan. 1, 2026 estimate)",
  England: "57,690,300 (mid-2024 estimate)",
  Ehime: "1,296,061 (Apr. 1, 2023 estimate)",
  Fukui: "746,733 (Apr. 1, 2023 estimate)",
  Fukuoka: "5,101,340 (Apr. 1, 2023 estimate)",
  Fukushima: "1,773,723 (Apr. 1, 2023 estimate)",
  "Friuli-Venezia Giulia": "1,193,496 (Jan. 1, 2026 estimate)",
  Gifu: "1,933,019 (Apr. 1, 2023 estimate)",
  Goa: "1,458,545 (2011 Census)",
  Gujarat: "60,439,692 (2011 Census)",
  Gunma: "1,902,834 (Apr. 1, 2023 estimate)",
  Haryana: "25,351,462 (2011 Census)",
  "Himachal Pradesh": "6,864,602 (2011 Census)",
  Hiroshima: "2,745,295 (Apr. 1, 2023 estimate)",
  Hokkaido: "5,114,809 (Apr. 1, 2023 estimate)",
  Hyogo: "5,378,405 (Apr. 1, 2023 estimate)",
  Hyōgo: "5,378,405 (Apr. 1, 2023 estimate)",
  Ibaraki: "2,828,848 (Apr. 1, 2023 estimate)",
  Ishikawa: "1,111,483 (Apr. 1, 2023 estimate)",
  Iwate: "1,168,771 (Apr. 1, 2023 estimate)",
  "Jammu and Kashmir": "12,541,302 (2011 Census; pre-2019 state)",
  Jharkhand: "32,988,134 (2011 Census)",
  Kagawa: "926,866 (Apr. 1, 2023 estimate)",
  Kagoshima: "1,553,060 (Apr. 1, 2023 estimate)",
  Kanagawa: "9,222,108 (Apr. 1, 2023 estimate)",
  Karnataka: "61,095,297 (2011 Census)",
  Kerala: "33,406,061 (2011 Census)",
  Kochi: "669,516 (Apr. 1, 2023 estimate)",
  Kōchi: "669,516 (Apr. 1, 2023 estimate)",
  Kumamoto: "1,708,761 (Apr. 1, 2023 estimate)",
  Kyoto: "2,537,860 (Apr. 1, 2023 estimate)",
  Kyōto: "2,537,860 (Apr. 1, 2023 estimate)",
  Lakshadweep: "64,473 (2011 Census)",
  Lazio: "5,709,444 (Jan. 1, 2026 estimate)",
  Liguria: "1,511,988 (Jan. 1, 2026 estimate)",
  Lombardia: "10,065,694 (Jan. 1, 2026 estimate)",
  "Madhya Pradesh": "72,626,809 (2011 Census)",
  Maharashtra: "112,374,333 (2011 Census)",
  Marche: "1,479,832 (Jan. 1, 2026 estimate)",
  Manipur: "2,855,794 (2011 Census)",
  Meghalaya: "2,966,889 (2011 Census)",
  Mie: "1,731,863 (Apr. 1, 2023 estimate)",
  Miyagi: "2,264,921 (Apr. 1, 2023 estimate)",
  Miyazaki: "1,043,524 (Apr. 1, 2023 estimate)",
  Mizoram: "1,097,206 (2011 Census)",
  Molise: "285,940 (Jan. 1, 2026 estimate)",
  Nagano: "2,007,647 (Apr. 1, 2023 estimate)",
  Nagasaki: "1,270,358 (Apr. 1, 2023 estimate)",
  Nagaland: "1,978,502 (2011 Census)",
  Nara: "1,298,946 (Apr. 1, 2023 estimate)",
  "NCT of Delhi": "16,787,941 (2011 Census)",
  Niigata: "2,135,036 (Apr. 1, 2023 estimate)",
  "Northern Ireland": "1,957,000 (mid-2024 estimate)",
  Odisha: "41,974,218 (2011 Census)",
  Oita: "1,098,383 (Apr. 1, 2023 estimate)",
  Ōita: "1,098,383 (Apr. 1, 2023 estimate)",
  Okayama: "1,850,210 (Apr. 1, 2023 estimate)",
  Okinawa: "1,462,871 (Apr. 1, 2023 estimate)",
  Osaka: "8,770,650 (Apr. 1, 2023 estimate)",
  Ōsaka: "8,770,650 (Apr. 1, 2023 estimate)",
  Piemonte: "4,255,006 (Jan. 1, 2026 estimate)",
  Puducherry: "1,247,953 (2011 Census)",
  Punjab: "27,743,338 (2011 Census)",
  Rajasthan: "68,548,437 (2011 Census)",
  Sardegna: "1,554,490 (Jan. 1, 2026 estimate)",
  Saga: "795,157 (Apr. 1, 2023 estimate)",
  Saitama: "7,328,073 (Apr. 1, 2023 estimate)",
  Scotland: "5,546,900 (mid-2024 estimate)",
  Sicily: "4,775,194 (Jan. 1, 2026 estimate)",
  Shiga: "1,405,299 (Apr. 1, 2023 estimate)",
  Shimane: "650,900 (Apr. 1, 2023 estimate)",
  Shizuoka: "3,561,252 (Apr. 1, 2023 estimate)",
  Sikkim: "610,577 (2011 Census)",
  "Tamil Nadu": "72,147,030 (2011 Census)",
  Telangana: "35,193,978 (2011 Census, post-2014 state geography)",
  Tochigi: "1,898,513 (Apr. 1, 2023 estimate)",
  Tokushima: "697,733 (Apr. 1, 2023 estimate)",
  Tokyo: "14,063,564 (Apr. 1, 2023 estimate)",
  Tōkyō: "14,063,564 (Apr. 1, 2023 estimate)",
  Tottori: "539,190 (Apr. 1, 2023 estimate)",
  Toyama: "1,009,050 (Apr. 1, 2023 estimate)",
  Toscana: "3,659,222 (Jan. 1, 2026 estimate)",
  "Trentino-Alto Adige": "1,090,818 (Jan. 1, 2026 estimate)",
  Tripura: "3,673,917 (2011 Census)",
  Umbria: "850,627 (Jan. 1, 2026 estimate)",
  "United Kingdom": "69,281,400 (mid-2024 estimate)",
  "Uttar Pradesh": "199,812,341 (2011 Census)",
  Uttarakhand: "10,086,292 (2011 Census)",
  "Valle d'Aosta": "122,554 (Jan. 1, 2026 estimate)",
  Veneto: "4,857,460 (Jan. 1, 2026 estimate)",
  Wales: "3,187,200 (mid-2024 estimate)",
  Wakayama: "895,931 (Apr. 1, 2023 estimate)",
  Yamagata: "1,031,642 (Apr. 1, 2023 estimate)",
  Yamaguchi: "1,301,480 (Apr. 1, 2023 estimate)",
  Yamanashi: "796,231 (Apr. 1, 2023 estimate)",
  "West Bengal": "91,276,115 (2011 Census)",
};

const gadmRegionLayerNames = Object.keys(gadmLevelOneFiles)
  .map((regionId) => regions.find((region) => region.id === regionId)?.name ?? regionId)
  .sort((a, b) => a.localeCompare(b));

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "map", label: "Map", icon: "🗺️" },
  { id: "play", label: "Play", icon: "▶️" },
  { id: "review", label: "Review", icon: "📖" },
  { id: "profile", label: "Profile", icon: "👤" },
];

const levelTone: Record<DifficultyLevel, string> = {
  gateway: "green",
  connector: "cyan",
  hub: "blue",
  interchange: "violet",
  express: "amber",
  signal: "orange",
  control: "red",
  dispatch: "cyan",
  crosswind: "blue",
  "night-ops": "violet",
  "deep-route": "amber",
  polar: "white",
  microstate: "orange",
  edgecase: "red",
  "outer-limits": "white",
};

function difficultyRank(level: DifficultyLevel) {
  return difficultyLevels.indexOf(level);
}

const worldFeatureCollection = feature(
  worldAtlas as unknown as Parameters<typeof feature>[0],
  (worldAtlas as unknown as { objects: { countries: unknown } }).objects.countries as Parameters<typeof feature>[1],
) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;

const worldProjection = geoNaturalEarth1().fitSize([100, 100], worldFeatureCollection);
const worldPath = geoPath(worldProjection);
const worldFeatures = worldFeatureCollection.features as WorldFeature[];

const countryNameOverrides: Record<string, string> = {
  "United States of America": "united-states",
  "United Kingdom": "united-kingdom",
  "United Arab Emirates": "uae",
  "Czechia": "czech-republic",
  "Dem. Rep. Congo": "democratic-republic-of-the-congo",
  "Congo": "congo",
  "Central African Rep.": "central-african-republic",
  "Dominican Rep.": "dominican-republic",
  "Eq. Guinea": "equatorial-guinea",
  "Cape Verde": "cabo-verde",
  "Cabo Verde": "cabo-verde",
  "Bosnia and Herz.": "bosnia-and-herzegovina",
  "S. Sudan": "south-sudan",
  "Solomon Is.": "solomon-islands",
  "eSwatini": "eswatini",
  "Timor-Leste": "timor-leste",
  "CÃ´te d'Ivoire": "cote-d-ivoire",
  "N. Cyprus": "cyprus",
  "Somaliland": "somalia",
};

function slugifyCountryName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function regionIdForCountryName(name: string) {
  const override = countryNameOverrides[name];
  if (override) return override;
  const slug = slugifyCountryName(name);
  return regions.some((region) => region.id === slug) ? slug : "";
}

const projectedRegionPositions = worldFeatures.reduce<Record<string, { x: number; y: number }>>((positions, country) => {
  const regionId = regionIdForCountryName(country.properties.name);
  if (!regionId) return positions;
  const centroid = worldPath.centroid(country);
  if (Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
    positions[regionId] = { x: centroid[0], y: centroid[1] };
  }
  return positions;
}, {});

const capitalCoordinatesByRegionId: Record<string, [number, number]> = {
  "united-states": [-98.5795, 39.8283],
  canada: [-75.6972, 45.4215],
  mexico: [-99.1332, 19.4326],
  brazil: [-47.8825, -15.7942],
  chile: [-70.6693, -33.4489],
  argentina: [-58.3816, -34.6037],
  colombia: [-74.0721, 4.711],
  peru: [-77.0428, -12.0464],
  "united-kingdom": [-0.1276, 51.5072],
  ireland: [-6.2603, 53.3498],
  france: [2.3522, 48.8566],
  germany: [13.405, 52.52],
  netherlands: [4.9041, 52.3676],
  belgium: [4.3517, 50.8503],
  switzerland: [7.4474, 46.948],
  austria: [16.3738, 48.2082],
  denmark: [12.5683, 55.6761],
  norway: [10.7522, 59.9139],
  sweden: [18.0686, 59.3293],
  finland: [24.9384, 60.1699],
  iceland: [-21.9426, 64.1466],
  greenland: [-51.7216, 64.1835],
  italy: [12.4964, 41.9028],
  spain: [-3.7038, 40.4168],
  portugal: [-9.1393, 38.7223],
  russia: [37.6173, 55.7558],
  morocco: [-6.8416, 34.0209],
  "south-africa": [28.2293, -25.7479],
  nigeria: [7.3986, 9.0765],
  egypt: [31.2357, 30.0444],
  ethiopia: [38.7578, 8.9806],
  togo: [1.2314, 6.1319],
  "central-african-republic": [18.5582, 4.3947],
  "cabo-verde": [-23.5133, 14.9177],
  eritrea: [38.9251, 15.3229],
  angola: [13.2344, -8.839],
  botswana: [25.9231, -24.6282],
  sudan: [32.5599, 15.5007],
  "south-sudan": [31.5825, 4.8594],
  kenya: [36.8219, -1.2921],
  tanzania: [35.7382, -6.163],
  uganda: [32.5825, 0.3476],
  rwanda: [30.0619, -1.9441],
  burundi: [29.925, -3.4264],
  algeria: [3.0588, 36.7538],
  israel: [35.2137, 31.7683],
  "saudi-arabia": [46.6753, 24.7136],
  turkey: [32.8597, 39.9334],
  uae: [54.3773, 24.4539],
  india: [77.209, 28.6139],
  china: [116.4074, 39.9042],
  japan: [139.6917, 35.6895],
  "south-korea": [126.978, 37.5665],
  taiwan: [121.5654, 25.033],
  "hong-kong": [114.1694, 22.3193],
  singapore: [103.8198, 1.3521],
  malaysia: [101.6869, 3.139],
  thailand: [100.5018, 13.7563],
  vietnam: [105.8342, 21.0278],
  indonesia: [106.8456, -6.2088],
  philippines: [120.9842, 14.5995],
  australia: [149.13, -35.2809],
  "new-zealand": [174.7762, -41.2865],
  uzbekistan: [69.2401, 41.2995],
  kazakhstan: [71.4491, 51.1605],
  kyrgyzstan: [74.5698, 42.8746],
  tajikistan: [68.7864, 38.5598],
  mongolia: [106.9057, 47.8864],
  belize: [-88.7713, 17.251],
  micronesia: [158.161, 6.9248],
  bahamas: [-77.3504, 25.0443],
  jamaica: [-76.7936, 17.9712],
  "antigua-and-barbuda": [-61.8468, 17.1274],
  "dominican-republic": [-69.9312, 18.4861],
  haiti: [-72.3074, 18.5944],
  "saint-lucia": [-60.9875, 14.0101],
  "british-virgin-islands": [-64.6167, 18.4285],
  "cayman-islands": [-81.2546, 19.2866],
  montserrat: [-62.2106, 16.7425],
  "puerto-rico": [-66.1057, 18.4655],
  "marshall-islands": [171.3803, 7.1164],
  kiribati: [172.9791, 1.4518],
  nauru: [166.9315, -0.5477],
  tuvalu: [179.1942, -8.5211],
  fiji: [178.4419, -18.1248],
  tonga: [-175.2049, -21.1393],
  vanuatu: [168.3273, -17.7333],
  "solomon-islands": [159.9556, -9.4456],
  bougainville: [154.6726, -5.4223],
  maldives: [73.5093, 4.1755],
  "saint-vincent-and-the-grenadines": [-61.2248, 13.1600],
  liechtenstein: [9.5228, 47.1410],
  "san-marino": [12.4473, 43.9361],
  malta: [14.5146, 35.8997],
  andorra: [1.5218, 42.5063],
  monaco: [7.4246, 43.7384],
  "sao-tome-and-principe": [6.7273, 0.3365],
  barbados: [-59.6167, 13.1],
  samoa: [-171.7514, -13.8333],
  qatar: [51.531, 25.2854],
  bahrain: [50.586, 26.2235],
  comoros: [43.2551, -11.7172],
  grenada: [-61.7485, 12.0561],
  mauritius: [57.5012, -20.1609],
  palau: [134.6242, 7.5004],
  "new-caledonia": [166.4572, -22.2758],
  "french-polynesia": [-149.5585, -17.5516],
  "wallis-and-futuna": [-176.1777, -13.2825],
  tokelau: [-171.8559, -9.2002],
  niue: [-169.9167, -19.0554],
  "saint-helena": [-5.7181, -15.9247],
  "pitcairn-islands": [-130.1015, -25.0663],
  "saint-kitts-and-nevis": [-62.7177, 17.3026],
  "us-virgin-islands": [-64.9307, 18.3419],
  dominica: [-61.3794, 15.3092],
  "saint-pierre-and-miquelon": [-56.1773, 46.7811],
  lithuania: [25.2797, 54.6872],
  latvia: [24.1052, 56.9496],
  estonia: [24.7536, 59.437],
  belarus: [27.5615, 53.9045],
  poland: [21.0122, 52.2297],
  slovakia: [17.1077, 48.1486],
  slovenia: [14.5058, 46.0569],
  croatia: [15.9819, 45.815],
  "bosnia-and-herzegovina": [18.4131, 43.8563],
  montenegro: [19.2594, 42.4304],
  albania: [19.8187, 41.3275],
  "north-macedonia": [21.4314, 41.9981],
  kosovo: [21.1655, 42.6629],
  serbia: [20.4489, 44.7866],
  greece: [23.7275, 37.9838],
  cyprus: [33.3823, 35.1856],
  luxembourg: [6.1296, 49.6116],
  "moldova": [28.8353, 47.0105],
  "cote-d-ivoire": [-5.2767, 6.8276],
  "equatorial-guinea": [8.7833, 3.75],
  liberia: [-10.7972, 6.3004],
  gabon: [9.4544, 0.3901],
  mozambique: [32.5732, -25.9692],
  "papua-new-guinea": [147.1803, -9.4438],
  seychelles: [55.4513, -4.6191],
  lesotho: [27.4869, -29.3158],
  eswatini: [31.1367, -26.3054],
  pakistan: [73.0479, 33.6844],
  afghanistan: [69.2075, 34.5553],
  bangladesh: [90.4125, 23.8103],
  "vatican-city": [12.4534, 41.9029],
};

const projectedCapitalPositions = Object.fromEntries(
  Object.entries(capitalCoordinatesByRegionId).flatMap(([id, coordinate]) => {
    const projected = worldProjection(coordinate);
    return projected ? [[id, { x: projected[0], y: projected[1] }]] : [];
  }),
) as Record<string, { x: number; y: number }>;

type AttractionKind = "major" | "photo" | "culture" | "nature";

const touristAttractions: Array<{
  id: string;
  name: string;
  country: string;
  countryId: string;
  kind: AttractionKind;
  coordinate: [number, number];
  url: string;
}> = [
  { id: "burj-khalifa", name: "Burj Khalifa", country: "United Arab Emirates", countryId: "uae", kind: "major", coordinate: [55.2744, 25.1972], url: "https://en.wikipedia.org/wiki/Burj_Khalifa" },
  { id: "chichen-itza", name: "Chichen Itza", country: "Mexico", countryId: "mexico", kind: "culture", coordinate: [-88.5678, 20.6843], url: "https://en.wikipedia.org/wiki/Chichen_Itza" },
  { id: "eiffel-tower", name: "Eiffel Tower", country: "France", countryId: "france", kind: "major", coordinate: [2.2945, 48.8584], url: "https://en.wikipedia.org/wiki/Eiffel_Tower" },
  { id: "western-wall", name: "Western Wall", country: "Israel", countryId: "israel", kind: "culture", coordinate: [35.2345, 31.7767], url: "https://en.wikipedia.org/wiki/Western_Wall" },
  { id: "banff-national-park", name: "Banff National Park", country: "Canada", countryId: "canada", kind: "nature", coordinate: [-115.5708, 51.4968], url: "https://en.wikipedia.org/wiki/Banff_National_Park" },
  { id: "taj-mahal", name: "Taj Mahal", country: "India", countryId: "india", kind: "culture", coordinate: [78.0421, 27.1751], url: "https://en.wikipedia.org/wiki/Taj_Mahal" },
  { id: "taipei-101", name: "Taipei 101", country: "Taiwan", countryId: "taiwan", kind: "major", coordinate: [121.5645, 25.0339], url: "https://en.wikipedia.org/wiki/Taipei_101" },
  { id: "victoria-peak", name: "Victoria Peak", country: "Hong Kong", countryId: "hong-kong", kind: "major", coordinate: [114.1455, 22.2759], url: "https://en.wikipedia.org/wiki/Victoria_Peak" },
  { id: "pyramids-giza", name: "Pyramids of Giza", country: "Egypt", countryId: "egypt", kind: "culture", coordinate: [31.1342, 29.9792], url: "https://en.wikipedia.org/wiki/Giza_pyramid_complex" },
  { id: "statue-liberty", name: "Statue of Liberty", country: "United States", countryId: "united-states", kind: "major", coordinate: [-74.0445, 40.6892], url: "https://en.wikipedia.org/wiki/Statue_of_Liberty" },
  { id: "golden-gate", name: "Golden Gate Bridge", country: "United States", countryId: "united-states", kind: "photo", coordinate: [-122.4783, 37.8199], url: "https://en.wikipedia.org/wiki/Golden_Gate_Bridge" },
  { id: "great-wall", name: "Great Wall of China", country: "China", countryId: "china", kind: "culture", coordinate: [116.5704, 40.4319], url: "https://en.wikipedia.org/wiki/Great_Wall_of_China" },
  { id: "machu-picchu", name: "Machu Picchu", country: "Peru", countryId: "peru", kind: "culture", coordinate: [-72.5450, -13.1631], url: "https://en.wikipedia.org/wiki/Machu_Picchu" },
  { id: "uluru", name: "Uluru", country: "Australia", countryId: "australia", kind: "nature", coordinate: [131.0369, -25.3444], url: "https://en.wikipedia.org/wiki/Uluru" },
  { id: "table-mountain", name: "Table Mountain", country: "South Africa", countryId: "south-africa", kind: "nature", coordinate: [18.4098, -33.9628], url: "https://en.wikipedia.org/wiki/Table_Mountain" },
  { id: "cape-town-waterfront", name: "V&A Waterfront", country: "South Africa", countryId: "south-africa", kind: "photo", coordinate: [18.4219, -33.9036], url: "https://en.wikipedia.org/wiki/V%26A_Waterfront" },
  { id: "robben-island", name: "Robben Island", country: "South Africa", countryId: "south-africa", kind: "culture", coordinate: [18.3662, -33.8067], url: "https://en.wikipedia.org/wiki/Robben_Island" },
  { id: "chefchaouen", name: "Chefchaouen", country: "Morocco", countryId: "morocco", kind: "photo", coordinate: [-5.2636, 35.1688], url: "https://en.wikipedia.org/wiki/Chefchaouen" },
  { id: "park-guell", name: "Park Guell", country: "Spain", countryId: "spain", kind: "culture", coordinate: [2.1527, 41.4145], url: "https://en.wikipedia.org/wiki/Park_G%C3%BCell" },
  { id: "petra", name: "Petra", country: "Jordan", countryId: "jordan", kind: "culture", coordinate: [35.4444, 30.3285], url: "https://en.wikipedia.org/wiki/Petra" },
  { id: "colosseum", name: "Colosseum", country: "Italy", countryId: "italy", kind: "culture", coordinate: [12.4922, 41.8902], url: "https://en.wikipedia.org/wiki/Colosseum" },
  { id: "acropolis", name: "Acropolis of Athens", country: "Greece", countryId: "greece", kind: "culture", coordinate: [23.7265, 37.9715], url: "https://en.wikipedia.org/wiki/Acropolis_of_Athens" },
  { id: "victoria-falls", name: "Victoria Falls", country: "Zambia/Zimbabwe", countryId: "zambia", kind: "nature", coordinate: [25.8572, -17.9243], url: "https://en.wikipedia.org/wiki/Victoria_Falls" },
  { id: "angkor-wat", name: "Angkor Wat", country: "Cambodia", countryId: "cambodia", kind: "culture", coordinate: [103.8667, 13.4125], url: "https://en.wikipedia.org/wiki/Angkor_Wat" },
  { id: "maldives-atolls", name: "Maldives Atolls", country: "Maldives", countryId: "maldives", kind: "photo", coordinate: [73.2207, 3.2028], url: "https://en.wikipedia.org/wiki/Maldives" },
] as const;

const projectedTouristAttractions = touristAttractions.flatMap((attraction) => {
  const projected = worldProjection(attraction.coordinate as [number, number]);
  return projected ? [{ ...attraction, x: projected[0], y: projected[1] }] : [];
});

const cityLabels = [
  { id: "new-york", name: "New York", coordinate: [-74.006, 40.7128] },
  { id: "miami", name: "Miami", coordinate: [-80.1918, 25.7617] },
  { id: "los-angeles", name: "Los Angeles", coordinate: [-118.2437, 34.0522] },
  { id: "denver", name: "Denver", coordinate: [-104.9903, 39.7392] },
  { id: "orlando", name: "Orlando", coordinate: [-81.3792, 28.5383] },
  { id: "atlanta", name: "Atlanta", coordinate: [-84.388, 33.749] },
  { id: "boston", name: "Boston", coordinate: [-71.0589, 42.3601] },
  { id: "dallas", name: "Dallas", coordinate: [-96.797, 32.7767] },
  { id: "toronto", name: "Toronto", coordinate: [-79.3832, 43.6532] },
  { id: "montreal", name: "Montreal", coordinate: [-73.5673, 45.5017] },
  { id: "vancouver", name: "Vancouver", coordinate: [-123.1207, 49.2827] },
  { id: "mexico-city", name: "Mexico City", coordinate: [-99.1332, 19.4326] },
  { id: "panama-city", name: "Panama City", coordinate: [-79.5199, 8.9824] },
  { id: "sao-paulo", name: "Sao Paulo", coordinate: [-46.6333, -23.5505] },
  { id: "rio", name: "Rio de Janeiro", coordinate: [-43.1729, -22.9068] },
  { id: "buenos-aires", name: "Buenos Aires", coordinate: [-58.3816, -34.6037] },
  { id: "montevideo", name: "Montevideo", coordinate: [-56.1645, -34.9011] },
  { id: "la-paz", name: "La Paz", coordinate: [-68.1193, -16.4897] },
  { id: "london", name: "London", coordinate: [-0.1276, 51.5072] },
  { id: "paris", name: "Paris", coordinate: [2.3522, 48.8566] },
  { id: "frankfurt", name: "Frankfurt", coordinate: [8.6821, 50.1109] },
  { id: "munich", name: "Munich", coordinate: [11.582, 48.1351] },
  { id: "berlin", name: "Berlin", coordinate: [13.405, 52.52] },
  { id: "amsterdam", name: "Amsterdam", coordinate: [4.9041, 52.3676] },
  { id: "dublin", name: "Dublin", coordinate: [-6.2603, 53.3498] },
  { id: "stockholm", name: "Stockholm", coordinate: [18.0686, 59.3293] },
  { id: "helsinki", name: "Helsinki", coordinate: [24.9384, 60.1699] },
  { id: "oslo", name: "Oslo", coordinate: [10.7522, 59.9139] },
  { id: "madrid", name: "Madrid", coordinate: [-3.7038, 40.4168] },
  { id: "barcelona", name: "Barcelona", coordinate: [2.1734, 41.3851] },
  { id: "lisbon", name: "Lisbon", coordinate: [-9.1393, 38.7223] },
  { id: "rome", name: "Rome", coordinate: [12.4964, 41.9028] },
  { id: "milan", name: "Milan", coordinate: [9.19, 45.4642] },
  { id: "athens", name: "Athens", coordinate: [23.7275, 37.9838] },
  { id: "budapest", name: "Budapest", coordinate: [19.0402, 47.4979] },
  { id: "istanbul", name: "Istanbul", coordinate: [28.9784, 41.0082] },
  { id: "tel-aviv", name: "Tel Aviv", coordinate: [34.7818, 32.0853] },
  { id: "jerusalem", name: "Jerusalem", coordinate: [35.2137, 31.7683] },
  { id: "cairo", name: "Cairo", coordinate: [31.2357, 30.0444] },
  { id: "riyadh", name: "Riyadh", coordinate: [46.6753, 24.7136] },
  { id: "doha", name: "Doha", coordinate: [51.531, 25.2854] },
  { id: "tehran", name: "Tehran", coordinate: [51.389, 35.6892] },
  { id: "astana", name: "Astana", coordinate: [71.4491, 51.1605] },
  { id: "singapore-city", name: "Singapore", coordinate: [103.8198, 1.3521] },
  { id: "bangkok", name: "Bangkok", coordinate: [100.5018, 13.7563] },
  { id: "hanoi", name: "Hanoi", coordinate: [105.8342, 21.0278] },
  { id: "ho-chi-minh", name: "Ho Chi Minh City", coordinate: [106.6297, 10.8231] },
  { id: "manila", name: "Manila", coordinate: [120.9842, 14.5995] },
  { id: "lagos", name: "Lagos", coordinate: [3.3792, 6.5244] },
  { id: "accra", name: "Accra", coordinate: [-0.187, 5.6037] },
  { id: "shanghai", name: "Shanghai", coordinate: [121.4737, 31.2304] },
  { id: "beijing", name: "Beijing", coordinate: [116.4074, 39.9042] },
  { id: "zhengzhou", name: "Zhengzhou", coordinate: [113.6254, 34.7466] },
  { id: "luoyang", name: "Luoyang", coordinate: [112.454, 34.6197] },
  { id: "guangzhou", name: "Guangzhou", coordinate: [113.2644, 23.1291] },
  { id: "shenzhen", name: "Shenzhen", coordinate: [114.0579, 22.5431] },
  { id: "chongqing", name: "Chongqing", coordinate: [106.5516, 29.563] },
  { id: "tianjin", name: "Tianjin", coordinate: [117.3616, 39.3434] },
  { id: "harbin", name: "Harbin", coordinate: [126.6424, 45.7567] },
  { id: "wuhan", name: "Wuhan", coordinate: [114.3055, 30.5928] },
  { id: "chengdu", name: "Chengdu", coordinate: [104.0665, 30.5728] },
  { id: "xian", name: "Xi'an", coordinate: [108.9398, 34.3416] },
  { id: "nanjing", name: "Nanjing", coordinate: [118.7969, 32.0603] },
  { id: "hangzhou", name: "Hangzhou", coordinate: [120.1551, 30.2741] },
  { id: "mumbai", name: "Mumbai", coordinate: [72.8777, 19.076] },
  { id: "delhi", name: "Delhi", coordinate: [77.209, 28.6139] },
  { id: "jakarta", name: "Jakarta", coordinate: [106.8456, -6.2088] },
  { id: "sydney", name: "Sydney", coordinate: [151.2093, -33.8688] },
  { id: "melbourne", name: "Melbourne", coordinate: [144.9631, -37.8136] },
  { id: "perth", name: "Perth", coordinate: [115.8613, -31.9523] },
  { id: "auckland", name: "Auckland", coordinate: [174.7633, -36.8485] },
  { id: "hong-kong", name: "Hong Kong", coordinate: [114.1694, 22.3193] },
  { id: "busan", name: "Busan", coordinate: [129.0756, 35.1796] },
  { id: "osaka", name: "Osaka", coordinate: [135.5023, 34.6937] },
  { id: "kaohsiung", name: "Kaohsiung", coordinate: [120.3014, 22.6273] },
  { id: "kuala-lumpur", name: "Kuala Lumpur", coordinate: [101.6869, 3.139] },
  { id: "abu-dhabi", name: "Abu Dhabi", coordinate: [54.3773, 24.4539] },
  { id: "casablanca", name: "Casablanca", coordinate: [-7.5898, 33.5731] },
  { id: "rabat", name: "Rabat", coordinate: [-6.8498, 34.0209] },
  { id: "prague", name: "Prague", coordinate: [14.4378, 50.0755] },
  { id: "zurich", name: "Zurich", coordinate: [8.5417, 47.3769] },
  { id: "bergen", name: "Bergen", coordinate: [5.3221, 60.39299] },
  { id: "porto", name: "Porto", coordinate: [-8.6291, 41.1579] },
  { id: "valencia", name: "Valencia", coordinate: [-0.3763, 39.4699] },
  { id: "warsaw", name: "Warsaw", coordinate: [21.0122, 52.2297] },
  { id: "moscow", name: "Moscow", coordinate: [37.6173, 55.7558] },
  { id: "saint-petersburg", name: "Saint Petersburg", coordinate: [30.3351, 59.9343] },
  { id: "johannesburg", name: "Johannesburg", coordinate: [28.0473, -26.2041] },
  { id: "cape-town", name: "Cape Town", coordinate: [18.4241, -33.9249] },
  { id: "tallinn", name: "Tallinn", coordinate: [24.7536, 59.437] },
  { id: "reykjavik", name: "Reykjavik", coordinate: [-21.8277, 64.1283] },
  { id: "kyoto", name: "Kyoto", coordinate: [135.7681, 35.0116] },
  { id: "hiroshima", name: "Hiroshima", coordinate: [132.4553, 34.3853] },
  { id: "sapporo", name: "Sapporo", coordinate: [141.3545, 43.0618] },
  { id: "yokohama", name: "Yokohama", coordinate: [139.638, 35.4437] },
  { id: "nagoya", name: "Nagoya", coordinate: [136.9066, 35.1815] },
  { id: "fukuoka", name: "Fukuoka", coordinate: [130.4017, 33.5902] },
  { id: "kobe", name: "Kobe", coordinate: [135.1955, 34.6901] },
  { id: "addis-ababa", name: "Addis Ababa", coordinate: [38.7578, 8.9806] },
  { id: "zagreb", name: "Zagreb", coordinate: [15.9819, 45.815] },
  { id: "ljubljana", name: "Ljubljana", coordinate: [14.5058, 46.0569] },
  { id: "dakar", name: "Dakar", coordinate: [-17.4677, 14.7167] },
  { id: "curitiba", name: "Curitiba", coordinate: [-49.2733, -25.4284] },
  { id: "florianopolis", name: "Florianopolis", coordinate: [-48.548, -27.5949] },
  { id: "recife", name: "Recife", coordinate: [-34.877, -8.0476] },
  { id: "salvador", name: "Salvador", coordinate: [-38.5014, -12.9777] },
  { id: "brasilia", name: "Brasilia", coordinate: [-47.8825, -15.7942] },
  { id: "porto-alegre", name: "Porto Alegre", coordinate: [-51.2177, -30.0346] },
  { id: "santiago", name: "Santiago", coordinate: [-70.6693, -33.4489] },
  { id: "salt-lake-city", name: "Salt Lake City", coordinate: [-111.891, 40.7608] },
  { id: "seattle", name: "Seattle", coordinate: [-122.3321, 47.6062] },
  { id: "honolulu", name: "Honolulu", coordinate: [-157.8583, 21.3069] },
  { id: "calgary", name: "Calgary", coordinate: [-114.0719, 51.0447] },
  { id: "houston", name: "Houston", coordinate: [-95.3698, 29.7604] },
  { id: "phoenix", name: "Phoenix", coordinate: [-112.074, 33.4484] },
  { id: "philadelphia", name: "Philadelphia", coordinate: [-75.1652, 39.9526] },
  { id: "dallas", name: "Dallas", coordinate: [-96.797, 32.7767] },
  { id: "san-antonio", name: "San Antonio", coordinate: [-98.4936, 29.4241] },
  { id: "san-diego", name: "San Diego", coordinate: [-117.1611, 32.7157] },
  { id: "tucson", name: "Tucson", coordinate: [-110.9747, 32.2226] },
  { id: "jacksonville", name: "Jacksonville", coordinate: [-81.6557, 30.3322] },
  { id: "charlotte", name: "Charlotte", coordinate: [-80.8431, 35.2271] },
  { id: "austin", name: "Austin", coordinate: [-97.7431, 30.2672] },
  { id: "tampa", name: "Tampa", coordinate: [-82.4572, 27.9506] },
  { id: "orlando", name: "Orlando", coordinate: [-81.3792, 28.5383] },
  { id: "atlanta", name: "Atlanta", coordinate: [-84.388, 33.749] },
  { id: "portland", name: "Portland", coordinate: [-122.6784, 45.5152] },
  { id: "pittsburgh", name: "Pittsburgh", coordinate: [-79.9959, 40.4406] },
  { id: "detroit", name: "Detroit", coordinate: [-83.0458, 42.3314] },
  { id: "cleveland", name: "Cleveland", coordinate: [-81.6944, 41.4993] },
  { id: "minneapolis", name: "Minneapolis", coordinate: [-93.265, 44.9778] },
  { id: "barranquilla", name: "Barranquilla", coordinate: [-74.8069, 10.9639] },
  { id: "cartagena", name: "Cartagena", coordinate: [-75.4794, 10.391] },
  { id: "cali", name: "Cali", coordinate: [-76.532, 3.4516] },
  { id: "medellin", name: "Medellin", coordinate: [-75.5812, 6.2442] },
  { id: "bucaramanga", name: "Bucaramanga", coordinate: [-73.1198, 7.1193] },
  { id: "sochi", name: "Sochi", coordinate: [39.7342, 43.6028] },
  { id: "vladivostok", name: "Vladivostok", coordinate: [131.8855, 43.1155] },
  { id: "kazan", name: "Kazan", coordinate: [49.1064, 55.7961] },
  { id: "yekaterinburg", name: "Yekaterinburg", coordinate: [60.6122, 56.8519] },
  { id: "lima", name: "Lima", coordinate: [-77.0428, -12.0464] },
] satisfies Array<{ id: string; name: string; coordinate: [number, number] }>;

const projectedCityLabels = cityLabels.flatMap((city) => {
  const projected = worldProjection(city.coordinate);
  return projected ? [{ ...city, x: projected[0], y: projected[1] }] : [];
});

const airportLabels = [
  { code: "JFK", name: "John F. Kennedy International Airport", city: "New York", countryId: "united-states", coordinate: [-73.7781, 40.6413], fact: "Major transatlantic and long-haul gateway for New York." },
  { code: "LGA", name: "LaGuardia Airport", city: "New York", countryId: "united-states", coordinate: [-73.874, 40.7769], fact: "Short-haul domestic airport tied closely to New York city geography." },
  { code: "EWR", name: "Newark Liberty International Airport", city: "Newark/New York", countryId: "united-states", coordinate: [-74.1745, 40.6895], fact: "New Jersey gateway linked to New York by rail and road." },
  { code: "PHL", name: "Philadelphia International Airport", city: "Philadelphia", countryId: "united-states", coordinate: [-75.2411, 39.8744], fact: "Airport gateway for Philadelphia and the Northeast Corridor." },
  { code: "DCA", name: "Ronald Reagan Washington National Airport", city: "Washington, D.C.", countryId: "united-states", coordinate: [-77.0377, 38.8512], fact: "Metro-linked airport beside the Potomac." },
  { code: "IAD", name: "Washington Dulles International Airport", city: "Washington, D.C.", countryId: "united-states", coordinate: [-77.4565, 38.9531], fact: "Silver Line airport link expands the D.C. region westward." },
  { code: "ATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", countryId: "united-states", coordinate: [-84.4277, 33.6407], fact: "One of the world's busiest passenger hubs." },
  { code: "MIA", name: "Miami International Airport", city: "Miami", countryId: "united-states", coordinate: [-80.287, 25.7959], fact: "Major Latin America and Caribbean gateway." },
  { code: "FLL", name: "Fort Lauderdale-Hollywood International Airport", city: "Fort Lauderdale", countryId: "united-states", coordinate: [-80.1527, 26.0726], fact: "South Florida airport paired with Tri-Rail and Brightline corridors." },
  { code: "MCO", name: "Orlando International Airport", city: "Orlando", countryId: "united-states", coordinate: [-81.3081, 28.4312], fact: "Brightline now links Orlando airport with South Florida." },
  { code: "TPA", name: "Tampa International Airport", city: "Tampa", countryId: "united-states", coordinate: [-82.5332, 27.9755], fact: "West Florida aviation gateway." },
  { code: "CLT", name: "Charlotte Douglas International Airport", city: "Charlotte", countryId: "united-states", coordinate: [-80.9431, 35.214], fact: "Major Southeast connecting hub." },
  { code: "ORD", name: "Chicago O'Hare International Airport", city: "Chicago", countryId: "united-states", coordinate: [-87.9073, 41.9742], fact: "Blue Line rail connects O'Hare to the Chicago Loop." },
  { code: "DFW", name: "Dallas Fort Worth International Airport", city: "Dallas-Fort Worth", countryId: "united-states", coordinate: [-97.0403, 32.8998], fact: "Huge Texas hub between Dallas and Fort Worth." },
  { code: "IAH", name: "George Bush Intercontinental Airport", city: "Houston", countryId: "united-states", coordinate: [-95.3414, 29.9902], fact: "Houston's major long-haul gateway." },
  { code: "DEN", name: "Denver International Airport", city: "Denver", countryId: "united-states", coordinate: [-104.6737, 39.8561], fact: "Mountain West hub with airport rail to downtown Denver." },
  { code: "PHX", name: "Phoenix Sky Harbor International Airport", city: "Phoenix", countryId: "united-states", coordinate: [-112.0116, 33.4343], fact: "Desert metro airport tied to Valley Metro Rail by Sky Train." },
  { code: "LAS", name: "Harry Reid International Airport", city: "Las Vegas", countryId: "united-states", coordinate: [-115.1537, 36.084], fact: "Visitor-heavy desert aviation gateway." },
  { code: "SEA", name: "Seattle-Tacoma International Airport", city: "Seattle", countryId: "united-states", coordinate: [-122.3088, 47.4502], fact: "Link light rail connects Sea-Tac to Seattle." },
  { code: "SFO", name: "San Francisco International Airport", city: "San Francisco", countryId: "united-states", coordinate: [-122.379, 37.6213], fact: "BART airport station ties SFO into the Bay Area rail network." },
  { code: "LAX", name: "Los Angeles International Airport", city: "Los Angeles", countryId: "united-states", coordinate: [-118.4085, 33.9416], fact: "LAX is the West Coast's signature global air gateway." },
  { code: "BOS", name: "Boston Logan International Airport", city: "Boston", countryId: "united-states", coordinate: [-71.0096, 42.3656], fact: "Logan links New England to domestic and transatlantic routes, with MBTA connections." },
  { code: "DTW", name: "Detroit Metropolitan Wayne County Airport", city: "Detroit", countryId: "united-states", coordinate: [-83.3534, 42.2162], fact: "A major Great Lakes hub serving Detroit and southeast Michigan." },
  { code: "MSP", name: "Minneapolis-Saint Paul International Airport", city: "Minneapolis-Saint Paul", countryId: "united-states", coordinate: [-93.2218, 44.8848], fact: "Both terminals connect to the METRO Blue Line." },
  { code: "STL", name: "St. Louis Lambert International Airport", city: "St. Louis", countryId: "united-states", coordinate: [-90.37, 38.7487], fact: "MetroLink connects Lambert with central St. Louis." },
  { code: "ICN", name: "Incheon International Airport", city: "Incheon / Seoul", countryId: "south-korea", coordinate: [126.4505, 37.4602], fact: "AREX links the airport terminals with Seoul Station." },
  { code: "MAD", name: "Adolfo Suarez Madrid-Barajas Airport", city: "Madrid", countryId: "spain", coordinate: [-3.5676, 40.4983], fact: "Metro Line 8 and Cercanias connect Madrid with the airport complex." },
  { code: "TLV", name: "Ben Gurion Airport", city: "Tel Aviv / Jerusalem", countryId: "israel", coordinate: [34.8867, 32.0055], fact: "Israel Railways links Terminal 3 with Tel Aviv and Jerusalem." },
  { code: "JNB", name: "O. R. Tambo International Airport", city: "Johannesburg", countryId: "south-africa", coordinate: [28.246, -26.1337], fact: "Gautrain provides rapid rail access to Sandton and Johannesburg." },
  { code: "AKL", name: "Auckland Airport", city: "Auckland", countryId: "new-zealand", coordinate: [174.785, -37.0082], fact: "New Zealand's largest international gateway, connected by airport bus corridors." },
] satisfies Array<{ code: string; name: string; city: string; countryId: string; coordinate: [number, number]; fact: string }>;

const projectedAirportLabels = airportLabels.flatMap((airport) => {
  const projected = worldProjection(airport.coordinate);
  return projected ? [{ ...airport, x: projected[0], y: projected[1] }] : [];
});

function attractionIcon(kind: AttractionKind) {
  return kind === "photo" ? "📷" : kind === "culture" ? "🏛️" : kind === "nature" ? "🌲" : "⭐";
}

function attractionsForRegion(regionId: string) {
  return projectedTouristAttractions.filter((attraction) => attraction.countryId === regionId);
}

type TransitSystemKind = "metro" | "subway" | "regional-rail" | "high-speed-rail" | "intercity-rail" | "light-rail";

type TransitSystemRecord = {
  id: string;
  countryId: string;
  name: string;
  city: string;
  region: string;
  type: string;
  kind: TransitSystemKind;
  coordinate: [number, number];
  sourceUrl: string;
  mapUrl: string;
  keyNodes: string[];
  quizFocus: string;
};

const transitSystemsRepository = [
  { id: "nyc-subway", countryId: "united-states", name: "New York City Subway", city: "New York", region: "New York", type: "Subway", kind: "subway", coordinate: [-74.006, 40.7128], sourceUrl: "https://en.wikipedia.org/wiki/New_York_City_Subway", mapUrl: "https://www.transit.land/map#11/40.7128/-74.0060", keyNodes: ["Times Sq-42 St", "Grand Central", "Atlantic Av-Barclays", "Jamaica Center"], quizFocus: "station geography and borough-to-borough rapid transit" },
  { id: "wmata", countryId: "united-states", name: "Washington Metro", city: "Washington, D.C.", region: "District of Columbia, Maryland, Virginia", type: "Metro", kind: "metro", coordinate: [-77.0369, 38.9072], sourceUrl: "https://en.wikipedia.org/wiki/Washington_Metro", mapUrl: "https://www.transit.land/map#11/38.9072/-77.0369", keyNodes: ["Metro Center", "L'Enfant Plaza", "Rosslyn", "Fort Totten", "Ashburn"], quizFocus: "transfer stations and terminal directions" },
  { id: "tren-urbano", countryId: "puerto-rico", name: "Tren Urbano", city: "San Juan", region: "Puerto Rico", type: "Metro", kind: "metro", coordinate: [-66.1057, 18.4655], sourceUrl: "https://en.wikipedia.org/wiki/Tren_Urbano", mapUrl: "https://www.transit.land/map#12/18.4655/-66.1057", keyNodes: ["Sagrado Corazon", "Rio Piedras", "Bayamon", "Cupey"], quizFocus: "San Juan metro geography, university access, and Bayamon terminal clues" },
  { id: "la-metro", countryId: "united-states", name: "Los Angeles Metro Rail", city: "Los Angeles", region: "Southern California", type: "Metro/light rail", kind: "light-rail", coordinate: [-118.2437, 34.0522], sourceUrl: "https://en.wikipedia.org/wiki/Los_Angeles_Metro_Rail", mapUrl: "https://www.transit.land/map#11/34.0522/-118.2437", keyNodes: ["Union Station", "7th St/Metro Center", "Santa Monica", "North Hollywood"], quizFocus: "regional rail lines across Los Angeles County" },
  { id: "miami-metrorail", countryId: "united-states", name: "Miami Metrorail and Metromover", city: "Miami", region: "South Florida", type: "Metro/people mover", kind: "metro", coordinate: [-80.195, 25.7926], sourceUrl: "https://en.wikipedia.org/wiki/Metrorail_(Miami-Dade_County)", mapUrl: "https://www.transit.land/map#15/25.79263/-80.19503", keyNodes: ["Government Center", "Brickell", "Miami Airport", "Dadeland South"], quizFocus: "airport access and downtown automated circulation" },
  { id: "brightline", countryId: "united-states", name: "Brightline Florida", city: "Miami-Orlando", region: "Florida", type: "Intercity rail", kind: "intercity-rail", coordinate: [-80.1918, 25.7617], sourceUrl: "https://en.wikipedia.org/wiki/Brightline", mapUrl: "https://www.transit.land/map#7/27.6648/-81.5158", keyNodes: ["MiamiCentral", "Fort Lauderdale", "West Palm Beach", "Orlando"], quizFocus: "Florida intercity passenger rail geography" },
  { id: "amtrak-nec", countryId: "united-states", name: "Amtrak Northeast Corridor", city: "Boston-New York-Washington", region: "Northeast United States", type: "Intercity rail", kind: "intercity-rail", coordinate: [-74.5, 40.5], sourceUrl: "https://en.wikipedia.org/wiki/Northeast_Corridor", mapUrl: "https://www.transit.land/map#6/40.7/-74.0", keyNodes: ["Boston South Station", "New York Penn Station", "Philadelphia 30th Street", "Washington Union Station"], quizFocus: "major Northeast rail corridor ordering" },
  { id: "chicago-l", countryId: "united-states", name: "Chicago L", city: "Chicago", region: "Illinois", type: "Metro", kind: "metro", coordinate: [-87.6298, 41.8781], sourceUrl: "https://en.wikipedia.org/wiki/Chicago_%22L%22", mapUrl: "https://www.transit.land/map#11/41.8781/-87.6298", keyNodes: ["The Loop", "O'Hare", "Clark/Lake", "Howard"], quizFocus: "airport rail and Loop transfer geography" },
  { id: "bart", countryId: "united-states", name: "BART", city: "San Francisco Bay Area", region: "California", type: "Regional rail", kind: "regional-rail", coordinate: [-122.4194, 37.7749], sourceUrl: "https://en.wikipedia.org/wiki/Bay_Area_Rapid_Transit", mapUrl: "https://www.transit.land/map#10/37.7749/-122.4194", keyNodes: ["Embarcadero", "Oakland", "SFO", "Richmond"], quizFocus: "Bay Area regional rail and airport access" },
  { id: "tokyo-metro", countryId: "japan", name: "Tokyo Metro", city: "Tokyo", region: "Kanto", type: "Metro", kind: "metro", coordinate: [139.6917, 35.6895], sourceUrl: "https://en.wikipedia.org/wiki/Tokyo_Metro", mapUrl: "https://www.transit.land/map#12/35.6895/139.6917", keyNodes: ["Tokyo", "Shinjuku", "Shibuya", "Ginza"], quizFocus: "core Tokyo metro districts and transfers" },
  { id: "shinkansen", countryId: "japan", name: "Shinkansen", city: "Tokyo-Osaka-Hiroshima", region: "Honshu and Kyushu", type: "High-speed rail", kind: "high-speed-rail", coordinate: [135.5023, 34.6937], sourceUrl: "https://en.wikipedia.org/wiki/Shinkansen", mapUrl: "https://www.transit.land/map#6/34.6937/135.5023", keyNodes: ["Tokyo", "Shinagawa", "Kyoto", "Shin-Osaka", "Hiroshima"], quizFocus: "station order and Japanese corridor geography" },
  { id: "london-underground", countryId: "united-kingdom", name: "London Underground", city: "London", region: "Greater London", type: "Metro", kind: "metro", coordinate: [-0.1276, 51.5072], sourceUrl: "https://en.wikipedia.org/wiki/London_Underground", mapUrl: "https://www.transit.land/map#11/51.5072/-0.1276", keyNodes: ["King's Cross St Pancras", "Waterloo", "Oxford Circus", "Paddington"], quizFocus: "Tube line and terminal station recognition" },
  { id: "paris-metro", countryId: "france", name: "Paris Metro", city: "Paris", region: "Ile-de-France", type: "Metro", kind: "metro", coordinate: [2.3522, 48.8566], sourceUrl: "https://en.wikipedia.org/wiki/Paris_M%C3%A9tro", mapUrl: "https://www.transit.land/map#11/48.8566/2.3522", keyNodes: ["Chatelet", "Gare du Nord", "Nation", "La Defense"], quizFocus: "metro and RER interchange geography" },
  { id: "tgv", countryId: "france", name: "TGV", city: "Paris-Lyon-Marseille", region: "France", type: "High-speed rail", kind: "high-speed-rail", coordinate: [4.8357, 45.764], sourceUrl: "https://en.wikipedia.org/wiki/TGV", mapUrl: "https://www.transit.land/map#6/46.6/2.4", keyNodes: ["Paris Gare de Lyon", "Lyon Part-Dieu", "Avignon TGV", "Marseille Saint-Charles"], quizFocus: "French high-speed rail corridor geography" },
  { id: "ave", countryId: "spain", name: "AVE high-speed rail", city: "Madrid-Barcelona-Seville", region: "Spain", type: "High-speed rail", kind: "high-speed-rail", coordinate: [-3.7038, 40.4168], sourceUrl: "https://en.wikipedia.org/wiki/AVE", mapUrl: "https://www.transit.land/map#6/40.4168/-3.7038", keyNodes: ["Madrid Atocha", "Barcelona Sants", "Seville Santa Justa", "Zaragoza-Delicias"], quizFocus: "Spanish high-speed rail hubs" },
  { id: "al-boraq", countryId: "morocco", name: "Al Boraq", city: "Tangier-Rabat-Casablanca", region: "Morocco Atlantic corridor", type: "High-speed rail", kind: "high-speed-rail", coordinate: [-6.8417, 34.0209], sourceUrl: "https://en.wikipedia.org/wiki/Al_Boraq", mapUrl: "https://www.transit.land/map#7/34.0209/-6.8417", keyNodes: ["Tangier", "Kenitra", "Rabat", "Casablanca"], quizFocus: "North African high-speed rail corridor" },
  { id: "tashkent-metro", countryId: "uzbekistan", name: "Tashkent Metro", city: "Tashkent", region: "Uzbekistan", type: "Metro", kind: "metro", coordinate: [69.2401, 41.2995], sourceUrl: "https://en.wikipedia.org/wiki/Tashkent_Metro", mapUrl: "https://www.transit.land/map#11/41.2995/69.2401", keyNodes: ["Alisher Navoiy", "Pakhtakor", "Kosmonavtlar", "Tashkent station"], quizFocus: "Central Asian metro and Silk Road rail context" },
  { id: "dubai-metro", countryId: "uae", name: "Dubai Metro", city: "Dubai", region: "Dubai", type: "Metro", kind: "metro", coordinate: [55.2708, 25.2048], sourceUrl: "https://en.wikipedia.org/wiki/Dubai_Metro", mapUrl: "https://www.transit.land/map#11/25.2048/55.2708", keyNodes: ["Burj Khalifa/Dubai Mall", "Union", "Jebel Ali", "Dubai International Airport"], quizFocus: "automated metro and airport-city corridor geography" },
  { id: "seoul-metro", countryId: "south-korea", name: "Seoul Metropolitan Subway", city: "Seoul", region: "Capital Area", type: "Metro", kind: "metro", coordinate: [126.978, 37.5665], sourceUrl: "https://en.wikipedia.org/wiki/Seoul_Metropolitan_Subway", mapUrl: "https://www.transit.land/map#11/37.5665/126.9780", keyNodes: ["Seoul Station", "Gangnam", "Hongdae", "Incheon Airport link"], quizFocus: "large Asian metro network geography" },
  { id: "delhi-metro", countryId: "india", name: "Delhi Metro", city: "Delhi", region: "National Capital Region", type: "Metro", kind: "metro", coordinate: [77.209, 28.6139], sourceUrl: "https://en.wikipedia.org/wiki/Delhi_Metro", mapUrl: "https://www.transit.land/map#11/28.6139/77.2090", keyNodes: ["Rajiv Chowk", "New Delhi", "Kashmere Gate", "Airport Express"], quizFocus: "Indian metro scale and airport express service" },
  { id: "sao-paulo-metro", countryId: "brazil", name: "Sao Paulo Metro", city: "Sao Paulo", region: "Sao Paulo", type: "Metro", kind: "metro", coordinate: [-46.6333, -23.5505], sourceUrl: "https://en.wikipedia.org/wiki/S%C3%A3o_Paulo_Metro", mapUrl: "https://www.transit.land/map#11/-23.5505/-46.6333", keyNodes: ["Se", "Paulista", "Luz", "Pinheiros"], quizFocus: "Latin American metro scale and interchange geography" },
  { id: "copenhagen-metro", countryId: "denmark", name: "Copenhagen Metro", city: "Copenhagen", region: "Zealand", type: "Metro", kind: "metro", coordinate: [12.5683, 55.6761], sourceUrl: "https://en.wikipedia.org/wiki/Copenhagen_Metro", mapUrl: "https://www.transit.land/map#11/55.6761/12.5683", keyNodes: ["Kongens Nytorv", "Norreport", "Copenhagen Airport", "Cityringen"], quizFocus: "airport metro and ring-line geography" },
  { id: "taipei-metro", countryId: "taiwan", name: "Taipei Metro", city: "Taipei", region: "Northern Taiwan", type: "Metro", kind: "metro", coordinate: [121.5654, 25.033], sourceUrl: "https://en.wikipedia.org/wiki/Taipei_Metro", mapUrl: "https://www.transit.land/map#11/25.0330/121.5654", keyNodes: ["Taipei Main Station", "Ximen", "Taipei 101/World Trade Center", "Tamsui"], quizFocus: "Taipei urban rail and airport-city orientation" },
  { id: "taiwan-hsr", countryId: "taiwan", name: "Taiwan High Speed Rail", city: "Taipei-Kaohsiung", region: "Western Taiwan corridor", type: "High-speed rail", kind: "high-speed-rail", coordinate: [120.6736, 24.1477], sourceUrl: "https://en.wikipedia.org/wiki/Taiwan_High_Speed_Rail", mapUrl: "https://www.transit.land/map#7/24.1477/120.6736", keyNodes: ["Taipei", "Taichung", "Tainan", "Zuoying"], quizFocus: "north-south high-speed rail ordering" },
  { id: "rome-metro", countryId: "italy", name: "Rome Metro", city: "Rome", region: "Lazio", type: "Metro", kind: "metro", coordinate: [12.4964, 41.9028], sourceUrl: "https://en.wikipedia.org/wiki/Rome_Metro", mapUrl: "https://www.transit.land/map#11/41.9028/12.4964", keyNodes: ["Termini", "Colosseo", "Ottaviano", "San Giovanni"], quizFocus: "historic core metro and terminal station clues" },
  { id: "milan-metro", countryId: "italy", name: "Milan Metro", city: "Milan", region: "Lombardy", type: "Metro", kind: "metro", coordinate: [9.19, 45.4642], sourceUrl: "https://en.wikipedia.org/wiki/Milan_Metro", mapUrl: "https://www.transit.land/map#11/45.4642/9.1900", keyNodes: ["Duomo", "Centrale", "Garibaldi", "Cadorna"], quizFocus: "northern Italy metro and rail interchange geography" },
  { id: "warsaw-metro", countryId: "poland", name: "Warsaw Metro", city: "Warsaw", region: "Masovian Voivodeship", type: "Metro", kind: "metro", coordinate: [21.0122, 52.2297], sourceUrl: "https://en.wikipedia.org/wiki/Warsaw_Metro", mapUrl: "https://www.transit.land/map#11/52.2297/21.0122", keyNodes: ["Centrum", "Swietokrzyska", "Mlociny", "Stadion Narodowy"], quizFocus: "Central European metro and transfer geography" },
  { id: "porto-metro", countryId: "portugal", name: "Porto Metro", city: "Porto", region: "Norte", type: "Light metro", kind: "light-rail", coordinate: [-8.6291, 41.1579], sourceUrl: "https://en.wikipedia.org/wiki/Porto_Metro", mapUrl: "https://www.transit.land/map#11/41.1579/-8.6291", keyNodes: ["Trindade", "Campanha", "Casa da Musica", "Francisco Sa Carneiro Airport"], quizFocus: "Porto light-metro transfers, airport access, and Douro-side city geography" },
  { id: "valencia-metro", countryId: "spain", name: "Metrovalencia", city: "Valencia", region: "Valencian Community", type: "Metro/tram", kind: "metro", coordinate: [-0.3763, 39.4699], sourceUrl: "https://en.wikipedia.org/wiki/Metrovalencia", mapUrl: "https://www.transit.land/map#11/39.4699/-0.3763", keyNodes: ["Angel Guimera", "Xativa", "Aeroport", "Maritim"], quizFocus: "Valencia airport metro, tram links, and Mediterranean city orientation" },
  { id: "moscow-metro", countryId: "russia", name: "Moscow Metro", city: "Moscow", region: "Moscow", type: "Metro", kind: "metro", coordinate: [37.6173, 55.7558], sourceUrl: "https://en.wikipedia.org/wiki/Moscow_Metro", mapUrl: "https://www.transit.land/map#11/55.7558/37.6173", keyNodes: ["Komsomolskaya", "Kievskaya", "Kurskaya", "Moscow Central Circle"], quizFocus: "ring-line geography, terminal stations, and the Moscow Central Circle" },
  { id: "saint-petersburg-metro", countryId: "russia", name: "Saint Petersburg Metro", city: "Saint Petersburg", region: "Northwestern Russia", type: "Metro", kind: "metro", coordinate: [30.3351, 59.9343], sourceUrl: "https://en.wikipedia.org/wiki/Saint_Petersburg_Metro", mapUrl: "https://www.transit.land/map#11/59.9343/30.3351", keyNodes: ["Ploshchad Vosstaniya", "Nevsky Prospekt", "Tekhnologichesky Institut", "Admiralteyskaya"], quizFocus: "deep-station metro clues and Neva-side central transfers" },
  { id: "oslo-metro", countryId: "norway", name: "Oslo Metro", city: "Oslo", region: "Oslofjord", type: "Metro", kind: "metro", coordinate: [10.7522, 59.9139], sourceUrl: "https://en.wikipedia.org/wiki/Oslo_Metro", mapUrl: "https://www.transit.land/map#11/59.9139/10.7522", keyNodes: ["Jernbanetorget", "Nationaltheatret", "Majorstuen", "Frognerseteren"], quizFocus: "Nordic metro geography and central station clues" },
  { id: "berlin-u-bahn", countryId: "germany", name: "Berlin U-Bahn", city: "Berlin", region: "Berlin", type: "Metro", kind: "metro", coordinate: [13.405, 52.52], sourceUrl: "https://en.wikipedia.org/wiki/Berlin_U-Bahn", mapUrl: "https://www.transit.land/map#11/52.5200/13.4050", keyNodes: ["Alexanderplatz", "Zoologischer Garten", "Hauptbahnhof", "Wittenbergplatz"], quizFocus: "U-Bahn and S-Bahn transfer geography" },
  { id: "munich-u-bahn", countryId: "germany", name: "Munich U-Bahn", city: "Munich", region: "Bavaria", type: "Metro", kind: "metro", coordinate: [11.582, 48.1351], sourceUrl: "https://en.wikipedia.org/wiki/Munich_U-Bahn", mapUrl: "https://www.transit.land/map#11/48.1351/11.5820", keyNodes: ["Marienplatz", "Hauptbahnhof", "Odeonsplatz", "Olympiazentrum"], quizFocus: "Bavarian metro and central transfer clues" },
  { id: "vienna-u-bahn", countryId: "austria", name: "Vienna U-Bahn", city: "Vienna", region: "Austria", type: "Metro", kind: "metro", coordinate: [16.3738, 48.2082], sourceUrl: "https://en.wikipedia.org/wiki/Vienna_U-Bahn", mapUrl: "https://www.transit.land/map#11/48.2082/16.3738", keyNodes: ["Stephansplatz", "Karlsplatz", "Praterstern", "Westbahnhof"], quizFocus: "Vienna metro and intercity rail transfer geography" },
  { id: "buenos-aires-subte", countryId: "argentina", name: "Buenos Aires Subte", city: "Buenos Aires", region: "Argentina", type: "Metro", kind: "subway", coordinate: [-58.3816, -34.6037], sourceUrl: "https://en.wikipedia.org/wiki/Buenos_Aires_Underground", mapUrl: "https://www.transit.land/map#11/-34.6037/-58.3816", keyNodes: ["9 de Julio", "Retiro", "Constitucion", "Plaza de Mayo"], quizFocus: "South American subway and terminal geography" },
  { id: "mexico-city-metro", countryId: "mexico", name: "Mexico City Metro", city: "Mexico City", region: "Valley of Mexico", type: "Metro", kind: "metro", coordinate: [-99.1332, 19.4326], sourceUrl: "https://en.wikipedia.org/wiki/Mexico_City_Metro", mapUrl: "https://www.transit.land/map#11/19.4326/-99.1332", keyNodes: ["Pantitlan", "Bellas Artes", "Tacubaya", "Zocalo"], quizFocus: "large Latin American metro and interchange geography" },
  { id: "quito-metro", countryId: "ecuador", name: "Quito Metro", city: "Quito", region: "Ecuadorian Andes", type: "Metro", kind: "metro", coordinate: [-78.4678, -0.1807], sourceUrl: "https://en.wikipedia.org/wiki/Quito_Metro", mapUrl: "https://www.transit.land/map#11/-0.1807/-78.4678", keyNodes: ["Quitumbe", "San Francisco", "La Carolina", "El Labrador"], quizFocus: "Andean metro geography and north-south corridor" },
  { id: "bogota-transmilenio", countryId: "colombia", name: "TransMilenio", city: "Bogota", region: "Bogota", type: "BRT", kind: "light-rail", coordinate: [-74.0721, 4.711], sourceUrl: "https://en.wikipedia.org/wiki/TransMilenio", mapUrl: "https://www.transit.land/map#11/4.7110/-74.0721", keyNodes: ["Portal del Norte", "Portal de Las Americas", "Avenida Jimenez", "El Dorado"], quizFocus: "BRT trunk corridor and portal station geography" },
  { id: "medellin-metro", countryId: "colombia", name: "Medellin Metro", city: "Medellin", region: "Antioquia", type: "Metro/cable transit", kind: "metro", coordinate: [-75.5812, 6.2442], sourceUrl: "https://en.wikipedia.org/wiki/Medell%C3%ADn_Metro", mapUrl: "https://www.transit.land/map#11/6.2442/-75.5812", keyNodes: ["San Antonio", "Acevedo", "Poblado", "MetroCable"], quizFocus: "MetroCable and valley transit geography" },
  { id: "shanghai-metro", countryId: "china", name: "Shanghai Metro", city: "Shanghai", region: "Yangtze River Delta", type: "Metro", kind: "metro", coordinate: [121.4737, 31.2304], sourceUrl: "https://en.wikipedia.org/wiki/Shanghai_Metro", mapUrl: "https://www.transit.land/map#11/31.2304/121.4737", keyNodes: ["People's Square", "Hongqiao Railway Station", "Lujiazui", "Shanghai Railway Station"], quizFocus: "very large metro network and airport rail context" },
  { id: "beijing-subway", countryId: "china", name: "Beijing Subway", city: "Beijing", region: "North China", type: "Metro", kind: "subway", coordinate: [116.4074, 39.9042], sourceUrl: "https://en.wikipedia.org/wiki/Beijing_Subway", mapUrl: "https://www.transit.land/map#11/39.9042/116.4074", keyNodes: ["Tiananmen", "Xidan", "Dongzhimen", "Beijing South"], quizFocus: "capital metro and ring-line geography" },
  { id: "sydney-trains", countryId: "australia", name: "Sydney Trains", city: "Sydney", region: "New South Wales", type: "Suburban rail", kind: "regional-rail", coordinate: [151.2093, -33.8688], sourceUrl: "https://en.wikipedia.org/wiki/Sydney_Trains", mapUrl: "https://www.transit.land/map#11/-33.8688/151.2093", keyNodes: ["Central", "Town Hall", "Parramatta", "Bondi Junction"], quizFocus: "Australian suburban rail and harbor city geography" },
  { id: "melbourne-trams", countryId: "australia", name: "Melbourne tram network", city: "Melbourne", region: "Victoria", type: "Tram", kind: "light-rail", coordinate: [144.9631, -37.8136], sourceUrl: "https://en.wikipedia.org/wiki/Trams_in_Melbourne", mapUrl: "https://www.transit.land/map#11/-37.8136/144.9631", keyNodes: ["Flinders Street", "Southern Cross", "St Kilda", "Docklands"], quizFocus: "world-scale tram network and central city orientation" },
  { id: "auckland-rail", countryId: "new-zealand", name: "Auckland rail network", city: "Auckland", region: "North Island", type: "Suburban rail", kind: "regional-rail", coordinate: [174.7633, -36.8485], sourceUrl: "https://en.wikipedia.org/wiki/Auckland_rail_network", mapUrl: "https://www.transit.land/map#11/-36.8485/174.7633", keyNodes: ["Britomart", "Newmarket", "Papakura", "Swanson"], quizFocus: "New Zealand rail and harbor-city commuter geography" },
  { id: "gautrain", countryId: "south-africa", name: "Gautrain", city: "Johannesburg-Pretoria", region: "Gauteng", type: "Regional rail", kind: "regional-rail", coordinate: [28.0473, -26.2041], sourceUrl: "https://en.wikipedia.org/wiki/Gautrain", mapUrl: "https://www.transit.land/map#10/-26.2041/28.0473", keyNodes: ["OR Tambo", "Sandton", "Park Station", "Pretoria"], quizFocus: "airport rail and Gauteng regional geography" },
  { id: "cape-town-myciti", countryId: "south-africa", name: "Cape Town MyCiTi and rail", city: "Cape Town", region: "Western Cape", type: "BRT/commuter rail", kind: "regional-rail", coordinate: [18.4241, -33.9249], sourceUrl: "https://en.wikipedia.org/wiki/MyCiTi", mapUrl: "https://www.transit.land/map#11/-33.9249/18.4241", keyNodes: ["Civic Centre", "Cape Town Station", "Waterfront", "Airport route"], quizFocus: "Cape Town bus, rail, waterfront, and airport-access geography" },
  { id: "singapore-mrt", countryId: "singapore", name: "Singapore MRT", city: "Singapore", region: "Singapore", type: "Metro", kind: "metro", coordinate: [103.8198, 1.3521], sourceUrl: "https://en.wikipedia.org/wiki/Mass_Rapid_Transit_(Singapore)", mapUrl: "https://www.transit.land/map#11/1.3521/103.8198", keyNodes: ["Dhoby Ghaut", "City Hall", "Changi Airport", "Jurong East"], quizFocus: "island-state metro transfers and airport access" },
  { id: "bangkok-bts-mrt", countryId: "thailand", name: "Bangkok BTS and MRT", city: "Bangkok", region: "Thailand", type: "Metro/skytrain", kind: "metro", coordinate: [100.5018, 13.7563], sourceUrl: "https://en.wikipedia.org/wiki/Rapid_transit_in_Bangkok", mapUrl: "https://www.transit.land/map#11/13.7563/100.5018", keyNodes: ["Siam", "Asok", "Mo Chit", "Sukhumvit"], quizFocus: "elevated rail and metro interchange geography" },
  { id: "hanoi-metro", countryId: "vietnam", name: "Hanoi Metro", city: "Hanoi", region: "Northern Vietnam", type: "Metro", kind: "metro", coordinate: [105.8342, 21.0278], sourceUrl: "https://en.wikipedia.org/wiki/Hanoi_Metro", mapUrl: "https://www.transit.land/map#11/21.0278/105.8342", keyNodes: ["Cat Linh", "Ha Dong", "Nhon", "Hanoi Station"], quizFocus: "Vietnam capital metro corridors" },
  { id: "toronto-ttc", countryId: "canada", name: "TTC subway", city: "Toronto", region: "Ontario", type: "Subway/streetcar", kind: "subway", coordinate: [-79.3832, 43.6532], sourceUrl: "https://en.wikipedia.org/wiki/Toronto_subway", mapUrl: "https://www.transit.land/map#11/43.6532/-79.3832", keyNodes: ["Union", "Bloor-Yonge", "St George", "Kipling", "Finch"], quizFocus: "Toronto subway transfers, downtown spine, and GO/UP Express rail context" },
  { id: "manila-lrt-mrt", countryId: "philippines", name: "Manila LRT and MRT", city: "Manila", region: "Metro Manila", type: "Urban rail", kind: "light-rail", coordinate: [120.9842, 14.5995], sourceUrl: "https://en.wikipedia.org/wiki/Manila_Light_Rail_Transit_System", mapUrl: "https://www.transit.land/map#11/14.5995/120.9842", keyNodes: ["Recto", "Cubao", "Taft Avenue", "North Avenue"], quizFocus: "Metro Manila rail transfer and terminal clues" },
  { id: "lagos-rail-mass-transit", countryId: "nigeria", name: "Lagos Rail Mass Transit", city: "Lagos", region: "Lagos State", type: "Metro/light rail", kind: "light-rail", coordinate: [3.3792, 6.5244], sourceUrl: "https://en.wikipedia.org/wiki/Lagos_Rail_Mass_Transit", mapUrl: "https://www.transit.land/map#11/6.5244/3.3792", keyNodes: ["Marina", "Mile 2", "National Theatre", "Agbado"], quizFocus: "West African urban rail and lagoon-city geography" },
  { id: "accra-rail", countryId: "ghana", name: "Accra suburban rail", city: "Accra", region: "Greater Accra", type: "Commuter rail", kind: "regional-rail", coordinate: [-0.187, 5.6037], sourceUrl: "https://en.wikipedia.org/wiki/Ghana_Railway_Corporation", mapUrl: "https://www.transit.land/map#11/5.6037/-0.1870", keyNodes: ["Accra", "Tema", "Nsawam", "Achimota"], quizFocus: "Ghana coastal commuter rail and port access" },
  { id: "montevideo-bus-corridors", countryId: "uruguay", name: "Montevideo transit corridors", city: "Montevideo", region: "Uruguay", type: "Bus corridors", kind: "light-rail", coordinate: [-56.1645, -34.9011], sourceUrl: "https://en.wikipedia.org/wiki/Transport_in_Uruguay", mapUrl: "https://www.transit.land/map#11/-34.9011/-56.1645", keyNodes: ["Ciudad Vieja", "Tres Cruces", "Pocitos", "Carrasco"], quizFocus: "Uruguay capital transit and intercity bus geography" },
  { id: "mi-teleferico", countryId: "bolivia", name: "Mi Teleferico", city: "La Paz-El Alto", region: "Bolivia", type: "Urban cable car", kind: "light-rail", coordinate: [-68.1193, -16.4897], sourceUrl: "https://en.wikipedia.org/wiki/Mi_Telef%C3%A9rico", mapUrl: "https://www.transit.land/map#11/-16.4897/-68.1193", keyNodes: ["Central", "El Alto", "Irpavi", "Sopocachi"], quizFocus: "high-altitude cable transit and city-pair geography" },
  { id: "panama-metro", countryId: "panama", name: "Panama Metro", city: "Panama City", region: "Panama", type: "Metro", kind: "metro", coordinate: [-79.5199, 8.9824], sourceUrl: "https://en.wikipedia.org/wiki/Panama_Metro", mapUrl: "https://www.transit.land/map#11/8.9824/-79.5199", keyNodes: ["Albrook", "San Miguelito", "Cinco de Mayo", "Tocumen"], quizFocus: "Central American metro and canal-city orientation" },
  { id: "denver-rtD", countryId: "united-states", name: "Denver RTD rail", city: "Denver", region: "Colorado", type: "Light/commuter rail", kind: "light-rail", coordinate: [-104.9903, 39.7392], sourceUrl: "https://en.wikipedia.org/wiki/Regional_Transportation_District", mapUrl: "https://www.transit.land/map#11/39.7392/-104.9903", keyNodes: ["Union Station", "Denver Airport", "Auraria West", "I-25 and Broadway"], quizFocus: "Front Range rail and airport line geography" },
  { id: "sunrail", countryId: "united-states", name: "SunRail", city: "Orlando", region: "Central Florida", type: "Commuter rail", kind: "regional-rail", coordinate: [-81.3792, 28.5383], sourceUrl: "https://en.wikipedia.org/wiki/SunRail", mapUrl: "https://www.transit.land/map#10/28.5383/-81.3792", keyNodes: ["Church Street", "Lynx Central", "Winter Park", "Poinciana"], quizFocus: "Central Florida commuter rail station geography" },
  { id: "marta", countryId: "united-states", name: "MARTA rail", city: "Atlanta", region: "Georgia", type: "Metro", kind: "metro", coordinate: [-84.388, 33.749], sourceUrl: "https://en.wikipedia.org/wiki/MARTA_rail", mapUrl: "https://www.transit.land/map#11/33.7490/-84.3880", keyNodes: ["Five Points", "Airport", "Lindbergh Center", "Doraville"], quizFocus: "Atlanta rail transfer and airport route geography" },
  { id: "mbta-subway", countryId: "united-states", name: "MBTA subway", city: "Boston", region: "Massachusetts", type: "Metro/light rail", kind: "metro", coordinate: [-71.0589, 42.3601], sourceUrl: "https://en.wikipedia.org/wiki/MBTA_subway", mapUrl: "https://www.transit.land/map#11/42.3601/-71.0589", keyNodes: ["Park Street", "Downtown Crossing", "South Station", "Harvard"], quizFocus: "Boston T transfer and station geography" },
  { id: "dart-rail", countryId: "united-states", name: "DART light rail", city: "Dallas", region: "North Texas", type: "Light rail", kind: "light-rail", coordinate: [-96.797, 32.7767], sourceUrl: "https://en.wikipedia.org/wiki/DART_Light_Rail", mapUrl: "https://www.transit.land/map#11/32.7767/-96.7970", keyNodes: ["Akard", "Pearl/Arts District", "DFW Airport", "Downtown Plano"], quizFocus: "Dallas regional light rail and airport geography" },
  { id: "athens-metro", countryId: "greece", name: "Athens Metro", city: "Athens", region: "Attica", type: "Metro", kind: "metro", coordinate: [23.7275, 37.9838], sourceUrl: "https://en.wikipedia.org/wiki/Athens_Metro", mapUrl: "https://www.transit.land/map#11/37.9838/23.7275", keyNodes: ["Syntagma", "Monastiraki", "Piraeus", "Airport"], quizFocus: "airport metro and port-city transfers" },
  { id: "budapest-metro", countryId: "hungary", name: "Budapest Metro", city: "Budapest", region: "Hungary", type: "Metro", kind: "metro", coordinate: [19.0402, 47.4979], sourceUrl: "https://en.wikipedia.org/wiki/Budapest_Metro", mapUrl: "https://www.transit.land/map#11/47.4979/19.0402", keyNodes: ["Deak Ferenc ter", "Keleti", "Kelenfold", "Mexikoi ut"], quizFocus: "Danube capital metro transfer geography" },
  { id: "amsterdam-metro", countryId: "netherlands", name: "Amsterdam Metro", city: "Amsterdam", region: "North Holland", type: "Metro", kind: "metro", coordinate: [4.9041, 52.3676], sourceUrl: "https://en.wikipedia.org/wiki/Amsterdam_Metro", mapUrl: "https://www.transit.land/map#11/52.3676/4.9041", keyNodes: ["Centraal", "Zuid", "Bijlmer ArenA", "Noord"], quizFocus: "Low Countries metro and rail station clues" },
  { id: "dublin-luas", countryId: "ireland", name: "Luas", city: "Dublin", region: "Ireland", type: "Light rail", kind: "light-rail", coordinate: [-6.2603, 53.3498], sourceUrl: "https://en.wikipedia.org/wiki/Luas", mapUrl: "https://www.transit.land/map#11/53.3498/-6.2603", keyNodes: ["O'Connell", "St Stephen's Green", "Heuston", "Tallaght"], quizFocus: "Dublin tram line and station geography" },
  { id: "stockholm-metro", countryId: "sweden", name: "Stockholm Metro", city: "Stockholm", region: "Sweden", type: "Metro", kind: "metro", coordinate: [18.0686, 59.3293], sourceUrl: "https://en.wikipedia.org/wiki/Stockholm_Metro", mapUrl: "https://www.transit.land/map#11/59.3293/18.0686", keyNodes: ["T-Centralen", "Slussen", "Fridhemsplan", "Kungstradgarden"], quizFocus: "Nordic metro transfer and archipelago-city geography" },
  { id: "helsinki-metro", countryId: "finland", name: "Helsinki Metro", city: "Helsinki", region: "Finland", type: "Metro", kind: "metro", coordinate: [24.9384, 60.1699], sourceUrl: "https://en.wikipedia.org/wiki/Helsinki_Metro", mapUrl: "https://www.transit.land/map#11/60.1699/24.9384", keyNodes: ["Rautatientori", "Kamppi", "Itakeskus", "Matinkyla"], quizFocus: "Finnish metro and coastal-city orientation" },
  { id: "barcelona-metro", countryId: "spain", name: "Barcelona Metro", city: "Barcelona", region: "Catalonia", type: "Metro", kind: "metro", coordinate: [2.1734, 41.3851], sourceUrl: "https://en.wikipedia.org/wiki/Barcelona_Metro", mapUrl: "https://www.transit.land/map#11/41.3851/2.1734", keyNodes: ["Catalunya", "Sants Estacio", "Passeig de Gracia", "Sagrada Familia"], quizFocus: "Catalonia metro and rail interchange clues" },
  { id: "madrid-metro", countryId: "spain", name: "Madrid Metro", city: "Madrid", region: "Community of Madrid", type: "Metro", kind: "metro", coordinate: [-3.7038, 40.4168], sourceUrl: "https://en.wikipedia.org/wiki/Madrid_Metro", mapUrl: "https://www.transit.land/map#11/40.4168/-3.7038", keyNodes: ["Sol", "Atocha", "Nuevos Ministerios", "Chamartin"], quizFocus: "Spanish capital metro and high-speed rail transfers" },
  { id: "lisbon-metro", countryId: "portugal", name: "Lisbon Metro", city: "Lisbon", region: "Portugal", type: "Metro", kind: "metro", coordinate: [-9.1393, 38.7223], sourceUrl: "https://en.wikipedia.org/wiki/Lisbon_Metro", mapUrl: "https://www.transit.land/map#11/38.7223/-9.1393", keyNodes: ["Baixa-Chiado", "Marques de Pombal", "Oriente", "Airport"], quizFocus: "airport line and Tagus-side city geography" },
  { id: "istanbul-metro", countryId: "turkey", name: "Istanbul Metro", city: "Istanbul", region: "Turkey", type: "Metro", kind: "metro", coordinate: [28.9784, 41.0082], sourceUrl: "https://en.wikipedia.org/wiki/Istanbul_Metro", mapUrl: "https://www.transit.land/map#11/41.0082/28.9784", keyNodes: ["Yenikapi", "Taksim", "Kadikoy", "Istanbul Airport"], quizFocus: "Europe-Asia metro geography and airport route clues" },
  { id: "tel-aviv-light-rail", countryId: "israel", name: "Tel Aviv Light Rail", city: "Tel Aviv", region: "Gush Dan", type: "Light rail", kind: "light-rail", coordinate: [34.7818, 32.0853], sourceUrl: "https://en.wikipedia.org/wiki/Tel_Aviv_Light_Rail", mapUrl: "https://www.transit.land/map#11/32.0853/34.7818", keyNodes: ["Allenby", "Elifelet", "Jabotinsky", "Petah Tikva"], quizFocus: "Gush Dan urban rail and coastal city geography" },
  { id: "israel-railways", countryId: "israel", name: "Israel Railways", city: "Tel Aviv-Jerusalem-Haifa", region: "Israel", type: "Intercity rail", kind: "intercity-rail", coordinate: [34.7818, 32.0853], sourceUrl: "https://en.wikipedia.org/wiki/Israel_Railways", mapUrl: "https://www.transit.land/map#8/31.7683/35.2137", keyNodes: ["Tel Aviv Savidor", "Jerusalem Yitzhak Navon", "Haifa Hof HaCarmel", "Ben Gurion Airport"], quizFocus: "intercity station geography and airport rail" },
  { id: "jerusalem-light-rail", countryId: "israel", name: "Jerusalem Light Rail", city: "Jerusalem", region: "Israel", type: "Light rail", kind: "light-rail", coordinate: [35.2137, 31.7683], sourceUrl: "https://en.wikipedia.org/wiki/Jerusalem_Light_Rail", mapUrl: "https://www.transit.land/map#11/31.7683/35.2137", keyNodes: ["Central Station", "City Hall", "Damascus Gate", "Mount Herzl"], quizFocus: "Jerusalem rail and old-city station geography" },
  { id: "haifa-cable-car", countryId: "israel", name: "Cable Express Haifa", city: "Haifa", region: "Northern Israel", type: "Cable car transit", kind: "light-rail", coordinate: [34.9896, 32.794], sourceUrl: "https://en.wikipedia.org/wiki/Cable_Express", mapUrl: "https://www.transit.land/map#12/32.7940/34.9896", keyNodes: ["HaMifratz Central", "Technion", "University of Haifa"], quizFocus: "cable transit and hill-city university access" },
  { id: "cairo-metro", countryId: "egypt", name: "Cairo Metro", city: "Cairo", region: "Egypt", type: "Metro", kind: "metro", coordinate: [31.2357, 30.0444], sourceUrl: "https://en.wikipedia.org/wiki/Cairo_Metro", mapUrl: "https://www.transit.land/map#11/30.0444/31.2357", keyNodes: ["Sadat", "Ramses", "Attaba", "Heliopolis"], quizFocus: "African metro scale and Nile capital geography" },
  { id: "riyadh-metro", countryId: "saudi-arabia", name: "Riyadh Metro", city: "Riyadh", region: "Saudi Arabia", type: "Metro", kind: "metro", coordinate: [46.6753, 24.7136], sourceUrl: "https://en.wikipedia.org/wiki/Riyadh_Metro", mapUrl: "https://www.transit.land/map#11/24.7136/46.6753", keyNodes: ["King Abdullah Financial District", "Olaya", "King Khalid Airport", "Qasr Al Hokm"], quizFocus: "Gulf metro megaproject and airport access clues" },
  { id: "doha-metro", countryId: "qatar", name: "Doha Metro", city: "Doha", region: "Qatar", type: "Metro", kind: "metro", coordinate: [51.531, 25.2854], sourceUrl: "https://en.wikipedia.org/wiki/Doha_Metro", mapUrl: "https://www.transit.land/map#11/25.2854/51.5310", keyNodes: ["Msheireb", "Hamad International Airport", "Education City", "Lusail"], quizFocus: "Gulf airport metro and three-line transfer geography" },
  { id: "tehran-metro", countryId: "iran", name: "Tehran Metro", city: "Tehran", region: "Iran", type: "Metro", kind: "metro", coordinate: [51.389, 35.6892], sourceUrl: "https://en.wikipedia.org/wiki/Tehran_Metro", mapUrl: "https://www.transit.land/map#11/35.6892/51.3890", keyNodes: ["Imam Khomeini", "Tajrish", "Tehran Station", "Mehrabad Airport"], quizFocus: "Iranian capital metro and airport rail clues" },
  { id: "almaty-metro", countryId: "kazakhstan", name: "Almaty Metro", city: "Almaty", region: "Kazakhstan", type: "Metro", kind: "metro", coordinate: [76.886, 43.2389], sourceUrl: "https://en.wikipedia.org/wiki/Almaty_Metro", mapUrl: "https://www.transit.land/map#11/43.2389/76.8860", keyNodes: ["Abay", "Moscow", "Raiymbek Batyr", "Saryarka"], quizFocus: "Central Asian metro and mountain-city geography" },
  { id: "guangzhou-metro", countryId: "china", name: "Guangzhou Metro", city: "Guangzhou", region: "Pearl River Delta", type: "Metro", kind: "metro", coordinate: [113.2644, 23.1291], sourceUrl: "https://en.wikipedia.org/wiki/Guangzhou_Metro", mapUrl: "https://www.transit.land/map#11/23.1291/113.2644", keyNodes: ["Tiyu Xilu", "Guangzhou South", "Zhujiang New Town", "Airport South"], quizFocus: "Pearl River Delta metro and airport rail geography" },
  { id: "shenzhen-metro", countryId: "china", name: "Shenzhen Metro", city: "Shenzhen", region: "Pearl River Delta", type: "Metro", kind: "metro", coordinate: [114.0579, 22.5431], sourceUrl: "https://en.wikipedia.org/wiki/Shenzhen_Metro", mapUrl: "https://www.transit.land/map#11/22.5431/114.0579", keyNodes: ["Futian", "Luohu", "Window of the World", "Shenzhen North"], quizFocus: "border-city metro and high-speed rail transfers" },
  { id: "chongqing-rail-transit", countryId: "china", name: "Chongqing Rail Transit", city: "Chongqing", region: "Southwest China", type: "Metro/monorail", kind: "metro", coordinate: [106.5516, 29.563], sourceUrl: "https://en.wikipedia.org/wiki/Chongqing_Rail_Transit", mapUrl: "https://www.transit.land/map#11/29.5630/106.5516", keyNodes: ["Jiefangbei", "Liziba", "Chongqing North", "Jiangbei Airport"], quizFocus: "mountain-city monorail and airport route geography" },
  { id: "zhengzhou-metro", countryId: "china", name: "Zhengzhou Metro", city: "Zhengzhou", region: "Henan", type: "Metro", kind: "metro", coordinate: [113.6254, 34.7466], sourceUrl: "https://en.wikipedia.org/wiki/Zhengzhou_Metro", mapUrl: "https://www.transit.land/map#11/34.7466/113.6254", keyNodes: ["Zhengzhou East", "Erqi Square", "Zhengzhou Railway Station", "Xinzheng Airport"], quizFocus: "Henan metro map recognition and high-speed rail hub geography" },
  { id: "luoyang-metro", countryId: "china", name: "Luoyang Metro", city: "Luoyang", region: "Henan", type: "Metro", kind: "metro", coordinate: [112.454, 34.6197], sourceUrl: "https://en.wikipedia.org/wiki/Luoyang_Subway", mapUrl: "https://www.transit.land/map#11/34.6197/112.4540", keyNodes: ["Luoyang Railway Station", "Longmen High-Speed Railway", "Jiefang Road", "Wuhan Road"], quizFocus: "smaller Chinese metro network and ancient capital geography" },
  { id: "mumbai-suburban", countryId: "india", name: "Mumbai Suburban Railway", city: "Mumbai", region: "Maharashtra", type: "Suburban rail", kind: "regional-rail", coordinate: [72.8777, 19.076], sourceUrl: "https://en.wikipedia.org/wiki/Mumbai_Suburban_Railway", mapUrl: "https://www.transit.land/map#11/19.0760/72.8777", keyNodes: ["Churchgate", "CST", "Dadar", "Bandra"], quizFocus: "dense commuter rail and peninsula-city geography" },
  { id: "ahmedabad-metro", countryId: "india", name: "Ahmedabad Metro", city: "Ahmedabad", region: "Gujarat", type: "Metro", kind: "metro", coordinate: [72.5714, 23.0225], sourceUrl: "https://en.wikipedia.org/wiki/Ahmedabad_Metro", mapUrl: "https://www.transit.land/map#11/23.0225/72.5714", keyNodes: ["Old High Court", "Kalupur", "Vastral Gam", "APMC"], quizFocus: "Gujarat metro expansion and western India city geography" },
  { id: "hyderabad-metro", countryId: "india", name: "Hyderabad Metro", city: "Hyderabad", region: "Telangana", type: "Metro", kind: "metro", coordinate: [78.4867, 17.385], sourceUrl: "https://en.wikipedia.org/wiki/Hyderabad_Metro", mapUrl: "https://www.transit.land/map#11/17.3850/78.4867", keyNodes: ["Ameerpet", "Secunderabad East", "Miyapur", "Raidurg"], quizFocus: "Hyderabad interchange geography and Telangana metro corridors" },
  { id: "jakarta-mrt", countryId: "indonesia", name: "Jakarta MRT", city: "Jakarta", region: "Java", type: "Metro", kind: "metro", coordinate: [106.8456, -6.2088], sourceUrl: "https://en.wikipedia.org/wiki/Jakarta_MRT", mapUrl: "https://www.transit.land/map#11/-6.2088/106.8456", keyNodes: ["Bundaran HI", "Dukuh Atas", "Lebak Bulus", "ASEAN"], quizFocus: "Indonesian capital metro and transfer geography" },
  { id: "perth-rail", countryId: "australia", name: "Transperth rail", city: "Perth", region: "Western Australia", type: "Suburban rail", kind: "regional-rail", coordinate: [115.8613, -31.9523], sourceUrl: "https://en.wikipedia.org/wiki/Transperth_Trains", mapUrl: "https://www.transit.land/map#11/-31.9523/115.8613", keyNodes: ["Perth", "Elizabeth Quay", "Fremantle", "Airport Central"], quizFocus: "Western Australia rail and Indian Ocean city geography" },
  { id: "frankfurt-u-bahn", countryId: "germany", name: "Frankfurt U-Bahn", city: "Frankfurt", region: "Hesse", type: "Metro/light rail", kind: "metro", coordinate: [8.6821, 50.1109], sourceUrl: "https://en.wikipedia.org/wiki/Frankfurt_U-Bahn", mapUrl: "https://www.transit.land/map#11/50.1109/8.6821", keyNodes: ["Hauptwache", "Konstablerwache", "Willy-Brandt-Platz", "Suedbahnhof"], quizFocus: "German financial hub metro and rail interchange clues" },
  { id: "lyon-metro", countryId: "france", name: "Lyon Metro", city: "Lyon", region: "Auvergne-Rhone-Alpes", type: "Metro", kind: "metro", coordinate: [4.8357, 45.764], sourceUrl: "https://en.wikipedia.org/wiki/Lyon_Metro", mapUrl: "https://www.transit.land/map#11/45.7640/4.8357", keyNodes: ["Part-Dieu", "Bellecour", "Vieux Lyon", "Perrache"], quizFocus: "French regional metro and high-speed rail transfer clues" },
  { id: "marseille-metro", countryId: "france", name: "Marseille Metro", city: "Marseille", region: "Provence-Alpes-Cote d'Azur", type: "Metro", kind: "metro", coordinate: [5.3698, 43.2965], sourceUrl: "https://en.wikipedia.org/wiki/Marseille_Metro", mapUrl: "https://www.transit.land/map#11/43.2965/5.3698", keyNodes: ["Saint-Charles", "Vieux-Port", "Castellane", "La Rose"], quizFocus: "Mediterranean port city metro geography" },
  { id: "hong-kong-mtr", countryId: "hong-kong", name: "Hong Kong MTR", city: "Hong Kong", region: "Hong Kong SAR", type: "Metro/airport rail", kind: "metro", coordinate: [114.1694, 22.3193], sourceUrl: "https://en.wikipedia.org/wiki/MTR", mapUrl: "https://www.transit.land/map#11/22.3193/114.1694", keyNodes: ["Central", "Tsim Sha Tsui", "Kowloon", "Hong Kong Airport"], quizFocus: "dense harbor metro, airport express, and cross-harbor station geography" },
  { id: "busan-metro", countryId: "south-korea", name: "Busan Metro", city: "Busan", region: "South Korea", type: "Metro", kind: "metro", coordinate: [129.0756, 35.1796], sourceUrl: "https://en.wikipedia.org/wiki/Busan_Metro", mapUrl: "https://www.transit.land/map#11/35.1796/129.0756", keyNodes: ["Seomyeon", "Busan Station", "Haeundae", "Sasang"], quizFocus: "Korean port-city metro and station transfer geography" },
  { id: "osaka-metro", countryId: "japan", name: "Osaka Metro", city: "Osaka", region: "Kansai", type: "Metro", kind: "metro", coordinate: [135.5023, 34.6937], sourceUrl: "https://en.wikipedia.org/wiki/Osaka_Metro", mapUrl: "https://www.transit.land/map#11/34.6937/135.5023", keyNodes: ["Umeda", "Namba", "Shin-Osaka", "Tennoji"], quizFocus: "Kansai subway hubs and Shinkansen transfer clues" },
  { id: "kaohsiung-metro", countryId: "taiwan", name: "Kaohsiung Metro", city: "Kaohsiung", region: "Southern Taiwan", type: "Metro/light rail", kind: "metro", coordinate: [120.3014, 22.6273], sourceUrl: "https://en.wikipedia.org/wiki/Kaohsiung_Metro", mapUrl: "https://www.transit.land/map#11/22.6273/120.3014", keyNodes: ["Formosa Boulevard", "Zuoying", "Kaohsiung Main", "Siaogang"], quizFocus: "southern Taiwan metro, port, and HSR transfer geography" },
  { id: "kuala-lumpur-rapid-rail", countryId: "malaysia", name: "Kuala Lumpur rapid rail", city: "Kuala Lumpur", region: "Klang Valley", type: "Metro/LRT/monorail", kind: "metro", coordinate: [101.6869, 3.139], sourceUrl: "https://en.wikipedia.org/wiki/Rapid_KL", mapUrl: "https://www.transit.land/map#11/3.1390/101.6869", keyNodes: ["KL Sentral", "Masjid Jamek", "Pasar Seni", "Bukit Bintang"], quizFocus: "Klang Valley transfers across LRT, MRT, monorail, and airport rail" },
  { id: "abu-dhabi-transit", countryId: "uae", name: "Abu Dhabi bus and Etihad Rail hub", city: "Abu Dhabi", region: "United Arab Emirates", type: "Bus/intercity rail", kind: "regional-rail", coordinate: [54.3773, 24.4539], sourceUrl: "https://en.wikipedia.org/wiki/Transport_in_Abu_Dhabi", mapUrl: "https://www.transit.land/map#11/24.4539/54.3773", keyNodes: ["Abu Dhabi Central Bus Station", "Zayed International Airport", "Yas Island", "Etihad Rail"], quizFocus: "capital-region transport, airport access, and emerging intercity rail geography" },
  { id: "casablanca-tramway", countryId: "morocco", name: "Casablanca Tramway", city: "Casablanca", region: "Morocco", type: "Tram", kind: "light-rail", coordinate: [-7.5898, 33.5731], sourceUrl: "https://en.wikipedia.org/wiki/Casablanca_Tramway", mapUrl: "https://www.transit.land/map#11/33.5731/-7.5898", keyNodes: ["Casa Voyageurs", "Place des Nations Unies", "Ain Diab", "Sidi Moumen"], quizFocus: "Morocco's largest city tramway and national rail gateway geography" },
  { id: "rabat-sale-tramway", countryId: "morocco", name: "Rabat-Sale Tramway", city: "Rabat", region: "Morocco", type: "Tram", kind: "light-rail", coordinate: [-6.8498, 34.0209], sourceUrl: "https://en.wikipedia.org/wiki/Rabat%E2%80%93Sal%C3%A9_tramway", mapUrl: "https://www.transit.land/map#11/34.0209/-6.8498", keyNodes: ["Rabat Ville", "Sale", "Bab Chellah", "Agdal"], quizFocus: "capital-region tram geography across the Bou Regreg" },
  { id: "prague-metro", countryId: "czech-republic", name: "Prague Metro", city: "Prague", region: "Czech Republic", type: "Metro", kind: "metro", coordinate: [14.4378, 50.0755], sourceUrl: "https://en.wikipedia.org/wiki/Prague_Metro", mapUrl: "https://www.transit.land/map#11/50.0755/14.4378", keyNodes: ["Muzeum", "Mustek", "Florenc", "Hlavni nadrazi"], quizFocus: "Central European metro transfer stations and main rail station clues" },
  { id: "zurich-s-bahn", countryId: "switzerland", name: "Zurich S-Bahn and trams", city: "Zurich", region: "Switzerland", type: "Regional rail/tram", kind: "regional-rail", coordinate: [8.5417, 47.3769], sourceUrl: "https://en.wikipedia.org/wiki/Z%C3%BCrich_S-Bahn", mapUrl: "https://www.transit.land/map#11/47.3769/8.5417", keyNodes: ["Zurich HB", "Stadelhofen", "Oerlikon", "Airport"], quizFocus: "Swiss rail clockface transfers, airport rail, and tram geography" },
  { id: "bergen-light-rail", countryId: "norway", name: "Bergen Light Rail", city: "Bergen", region: "Western Norway", type: "Light rail", kind: "light-rail", coordinate: [5.3221, 60.39299], sourceUrl: "https://en.wikipedia.org/wiki/Bergen_Light_Rail", mapUrl: "https://www.transit.land/map#11/60.39299/5.3221", keyNodes: ["Byparken", "Flesland Airport", "Nesttun", "Kronstad"], quizFocus: "Norwegian airport light rail and fjord-city geography" },
  { id: "tallinn-tram", countryId: "estonia", name: "Tallinn tram network", city: "Tallinn", region: "Estonia", type: "Tram", kind: "light-rail", coordinate: [24.7536, 59.437], sourceUrl: "https://en.wikipedia.org/wiki/Trams_in_Tallinn", mapUrl: "https://www.transit.land/map#11/59.4370/24.7536", keyNodes: ["Hobujaama", "Tallinn Airport", "Balti jaam", "Kadriorg"], quizFocus: "Baltic tram geography and airport-city access" },
  { id: "reykjavik-straeto", countryId: "iceland", name: "Reykjavik Stræto", city: "Reykjavik", region: "Iceland", type: "Bus network", kind: "regional-rail", coordinate: [-21.8277, 64.1283], sourceUrl: "https://en.wikipedia.org/wiki/Str%C3%A6t%C3%B3_bs", mapUrl: "https://www.transit.land/map#11/64.1283/-21.8277", keyNodes: ["Hlemmur", "BSI", "Mjoedd", "Keflavik coach links"], quizFocus: "North Atlantic city bus geography and airport coach access" },
  { id: "kyoto-municipal-subway", countryId: "japan", name: "Kyoto Municipal Subway", city: "Kyoto", region: "Kansai", type: "Metro", kind: "metro", coordinate: [135.7681, 35.0116], sourceUrl: "https://en.wikipedia.org/wiki/Kyoto_Municipal_Subway", mapUrl: "https://www.transit.land/map#11/35.0116/135.7681", keyNodes: ["Kyoto Station", "Karasuma Oike", "Shijo", "Yamashina"], quizFocus: "historic-city subway and Shinkansen transfer geography" },
  { id: "hiroshima-streetcar", countryId: "japan", name: "Hiroshima Electric Railway", city: "Hiroshima", region: "Western Honshu", type: "Streetcar", kind: "light-rail", coordinate: [132.4553, 34.3853], sourceUrl: "https://en.wikipedia.org/wiki/Hiroshima_Electric_Railway", mapUrl: "https://www.transit.land/map#11/34.3853/132.4553", keyNodes: ["Hiroshima Station", "Hondori", "Atomic Bomb Dome", "Miyajimaguchi"], quizFocus: "streetcar routes, Peace Park geography, and western Honshu station clues" },
  { id: "sapporo-subway", countryId: "japan", name: "Sapporo Municipal Subway", city: "Sapporo", region: "Hokkaido", type: "Metro", kind: "metro", coordinate: [141.3545, 43.0618], sourceUrl: "https://en.wikipedia.org/wiki/Sapporo_Municipal_Subway", mapUrl: "https://www.transit.land/map#11/43.0618/141.3545", keyNodes: ["Sapporo", "Odori", "Susukino", "Shin-Sapporo"], quizFocus: "Hokkaido subway geography and central transfer clues" },
  { id: "yokohama-subway", countryId: "japan", name: "Yokohama Municipal Subway", city: "Yokohama", region: "Kanto", type: "Metro", kind: "metro", coordinate: [139.638, 35.4437], sourceUrl: "https://en.wikipedia.org/wiki/Yokohama_Municipal_Subway", mapUrl: "https://www.transit.land/map#11/35.4437/139.6380", keyNodes: ["Yokohama", "Sakuragicho", "Shin-Yokohama", "Azamino"], quizFocus: "Tokyo Bay city subway and Shinkansen transfer clues" },
  { id: "nagoya-subway", countryId: "japan", name: "Nagoya Municipal Subway", city: "Nagoya", region: "Chubu", type: "Metro", kind: "metro", coordinate: [136.9066, 35.1815], sourceUrl: "https://en.wikipedia.org/wiki/Nagoya_Municipal_Subway", mapUrl: "https://www.transit.land/map#11/35.1815/136.9066", keyNodes: ["Nagoya", "Sakae", "Kanayama", "Fushimi"], quizFocus: "Chubu metro geography and central Japan rail hub clues" },
  { id: "addis-ababa-light-rail", countryId: "ethiopia", name: "Addis Ababa Light Rail", city: "Addis Ababa", region: "Ethiopia", type: "Light rail", kind: "light-rail", coordinate: [38.7578, 8.9806], sourceUrl: "https://en.wikipedia.org/wiki/Addis_Ababa_Light_Rail", mapUrl: "https://www.transit.land/map#11/8.9806/38.7578", keyNodes: ["Menelik II Square", "Lideta", "Ayat", "Kality"], quizFocus: "East African light rail and capital corridor geography" },
  { id: "zagreb-tram", countryId: "croatia", name: "Zagreb tram network", city: "Zagreb", region: "Croatia", type: "Tram", kind: "light-rail", coordinate: [15.9819, 45.815], sourceUrl: "https://en.wikipedia.org/wiki/Trams_in_Zagreb", mapUrl: "https://www.transit.land/map#11/45.8150/15.9819", keyNodes: ["Ban Jelacic Square", "Zagreb Glavni kolodvor", "Dubec", "Jarun"], quizFocus: "Croatian capital tram geography and main station orientation" },
  { id: "ljubljana-urban-transport", countryId: "slovenia", name: "Ljubljana urban buses", city: "Ljubljana", region: "Slovenia", type: "Bus network", kind: "regional-rail", coordinate: [14.5058, 46.0569], sourceUrl: "https://en.wikipedia.org/wiki/Ljubljana_Passenger_Transport", mapUrl: "https://www.transit.land/map#11/46.0569/14.5058", keyNodes: ["Bavarski dvor", "Ljubljana station", "BTC", "Kongresni trg"], quizFocus: "Slovenian capital buses and central station geography" },
  { id: "dakar-ter", countryId: "senegal", name: "Dakar Regional Express Train", city: "Dakar", region: "Senegal", type: "Regional rail", kind: "regional-rail", coordinate: [-17.4677, 14.7167], sourceUrl: "https://en.wikipedia.org/wiki/Train_Express_Regional_(Dakar)", mapUrl: "https://www.transit.land/map#11/14.7167/-17.4677", keyNodes: ["Dakar", "Diamniadio", "Blaise Diagne Airport", "Thiaroye"], quizFocus: "airport regional rail and Dakar peninsula geography" },
  { id: "curitiba-brt", countryId: "brazil", name: "Curitiba BRT", city: "Curitiba", region: "Parana", type: "BRT", kind: "light-rail", coordinate: [-49.2733, -25.4284], sourceUrl: "https://en.wikipedia.org/wiki/Rede_Integrada_de_Transporte", mapUrl: "https://www.transit.land/map#11/-25.4284/-49.2733", keyNodes: ["Praça Rui Barbosa", "Boqueirao", "Santa Candida", "Pinheirinho"], quizFocus: "classic BRT planning model and southern Brazil city geography" },
  { id: "santiago-metro", countryId: "chile", name: "Santiago Metro", city: "Santiago", region: "Chile", type: "Metro", kind: "metro", coordinate: [-70.6693, -33.4489], sourceUrl: "https://en.wikipedia.org/wiki/Santiago_Metro", mapUrl: "https://www.transit.land/map#11/-33.4489/-70.6693", keyNodes: ["Baquedano", "Los Heroes", "Tobalaba", "Pajaritos"], quizFocus: "Andean capital metro and transfer geography" },
  { id: "uta-trax", countryId: "united-states", name: "UTA TRAX and FrontRunner", city: "Salt Lake City", region: "Utah", type: "Light/commuter rail", kind: "light-rail", coordinate: [-111.891, 40.7608], sourceUrl: "https://en.wikipedia.org/wiki/TRAX_(light_rail)", mapUrl: "https://www.transit.land/map#11/40.7608/-111.8910", keyNodes: ["Salt Lake Central", "Airport", "Gallivan Plaza", "Provo FrontRunner"], quizFocus: "Wasatch Front rail and airport light rail geography" },
  { id: "sound-transit", countryId: "united-states", name: "Sound Transit Link", city: "Seattle", region: "Washington", type: "Light rail", kind: "light-rail", coordinate: [-122.3321, 47.6062], sourceUrl: "https://en.wikipedia.org/wiki/Link_light_rail", mapUrl: "https://www.transit.land/map#11/47.6062/-122.3321", keyNodes: ["Westlake", "University of Washington", "SeaTac/Airport", "Northgate"], quizFocus: "Puget Sound light rail and airport-city geography" },
  { id: "honolulu-skyline", countryId: "united-states", name: "Honolulu Skyline", city: "Honolulu", region: "Hawaii", type: "Metro/light metro", kind: "metro", coordinate: [-157.8583, 21.3069], sourceUrl: "https://en.wikipedia.org/wiki/Skyline_(Honolulu)", mapUrl: "https://www.transit.land/map#11/21.3069/-157.8583", keyNodes: ["Aloha Stadium", "East Kapolei", "Daniel K. Inouye Airport", "Pearlridge"], quizFocus: "island light metro, airport access, and Oahu geography" },
  { id: "vancouver-skytrain", countryId: "canada", name: "Vancouver SkyTrain", city: "Vancouver", region: "British Columbia", type: "Metro", kind: "metro", coordinate: [-123.1207, 49.2827], sourceUrl: "https://en.wikipedia.org/wiki/SkyTrain_(Vancouver)", mapUrl: "https://www.transit.land/map#11/49.2827/-123.1207", keyNodes: ["Waterfront", "Commercial-Broadway", "Metrotown", "YVR-Airport"], quizFocus: "automated metro, airport branch, and regional transfer geography" },
  { id: "calgary-ctrain", countryId: "canada", name: "Calgary CTrain", city: "Calgary", region: "Alberta", type: "Light rail", kind: "light-rail", coordinate: [-114.0719, 51.0447], sourceUrl: "https://en.wikipedia.org/wiki/CTrain", mapUrl: "https://www.transit.land/map#11/51.0447/-114.0719", keyNodes: ["City Hall", "7 Avenue", "Somerset-Bridlewood", "Tuscany"], quizFocus: "Prairie city light rail and downtown transit mall geography" },
  { id: "montreal-metro", countryId: "canada", name: "Montreal Metro", city: "Montreal", region: "Quebec", type: "Metro", kind: "metro", coordinate: [-73.5673, 45.5017], sourceUrl: "https://en.wikipedia.org/wiki/Montreal_Metro", mapUrl: "https://www.transit.land/map#11/45.5017/-73.5673", keyNodes: ["Berri-UQAM", "Lionel-Groulx", "McGill", "Longueuil"], quizFocus: "Quebec metro transfers and island-city geography" },
  { id: "houston-metrorail", countryId: "united-states", name: "Houston METRORail", city: "Houston", region: "Texas", type: "Light rail", kind: "light-rail", coordinate: [-95.3698, 29.7604], sourceUrl: "https://en.wikipedia.org/wiki/METRORail", mapUrl: "https://www.transit.land/map#11/29.7604/-95.3698", keyNodes: ["Downtown Transit Center", "Texas Medical Center", "Museum District", "Northline"], quizFocus: "Texas light rail and medical-center corridor geography" },
  { id: "phoenix-valley-metro", countryId: "united-states", name: "Valley Metro Rail", city: "Phoenix", region: "Arizona", type: "Light rail", kind: "light-rail", coordinate: [-112.074, 33.4484], sourceUrl: "https://en.wikipedia.org/wiki/Valley_Metro_Rail", mapUrl: "https://www.transit.land/map#11/33.4484/-112.0740", keyNodes: ["Downtown Phoenix", "Tempe", "Mesa", "Phoenix Sky Harbor"], quizFocus: "Arizona light rail and desert metro-region geography" },
  { id: "tucson-sun-link", countryId: "united-states", name: "Sun Link streetcar", city: "Tucson", region: "Arizona", type: "Streetcar", kind: "light-rail", coordinate: [-110.9747, 32.2226], sourceUrl: "https://en.wikipedia.org/wiki/Sun_Link", mapUrl: "https://www.transit.land/map#12/32.2226/-110.9747", keyNodes: ["University of Arizona", "Downtown Tucson", "Mercado", "Fourth Avenue"], quizFocus: "Tucson streetcar, university corridor, and downtown geography" },
  { id: "jacksonville-skyway", countryId: "united-states", name: "Jacksonville Skyway", city: "Jacksonville", region: "Florida", type: "People mover", kind: "metro", coordinate: [-81.6557, 30.3322], sourceUrl: "https://en.wikipedia.org/wiki/Jacksonville_Skyway", mapUrl: "https://www.transit.land/map#13/30.3322/-81.6557", keyNodes: ["Central", "Rosa Parks", "Riverplace", "Kings Avenue"], quizFocus: "downtown automated people mover and St. Johns River geography" },
  { id: "charlotte-lynx", countryId: "united-states", name: "Charlotte LYNX", city: "Charlotte", region: "North Carolina", type: "Light rail", kind: "light-rail", coordinate: [-80.8431, 35.2271], sourceUrl: "https://en.wikipedia.org/wiki/Lynx_Blue_Line", mapUrl: "https://www.transit.land/map#11/35.2271/-80.8431", keyNodes: ["Charlotte Transportation Center", "UNC Charlotte", "South End", "I-485/South Boulevard"], quizFocus: "Southeastern light rail and university corridor geography" },
  { id: "austin-capmetro-rail", countryId: "united-states", name: "Austin MetroRail", city: "Austin", region: "Texas", type: "Commuter rail", kind: "regional-rail", coordinate: [-97.7431, 30.2672], sourceUrl: "https://en.wikipedia.org/wiki/Capital_MetroRail", mapUrl: "https://www.transit.land/map#11/30.2672/-97.7431", keyNodes: ["Downtown", "Plaza Saltillo", "Lakeline", "Leander"], quizFocus: "Central Texas commuter rail and downtown station geography" },
  { id: "tampa-teco-line", countryId: "united-states", name: "TECO Line Streetcar", city: "Tampa", region: "Florida", type: "Streetcar", kind: "light-rail", coordinate: [-82.4572, 27.9506], sourceUrl: "https://en.wikipedia.org/wiki/TECO_Line_Streetcar", mapUrl: "https://www.transit.land/map#12/27.9506/-82.4572", keyNodes: ["Downtown Tampa", "Channel District", "Ybor City", "Amalie Arena"], quizFocus: "Florida streetcar geography and downtown-waterfront orientation" },
  { id: "pittsburgh-light-rail", countryId: "united-states", name: "Pittsburgh Light Rail", city: "Pittsburgh", region: "Pennsylvania", type: "Light rail", kind: "light-rail", coordinate: [-79.9959, 40.4406], sourceUrl: "https://en.wikipedia.org/wiki/Pittsburgh_Light_Rail", mapUrl: "https://www.transit.land/map#11/40.4406/-79.9959", keyNodes: ["Steel Plaza", "Gateway", "South Hills Village", "North Side"], quizFocus: "river city light rail and downtown tunnel geography" },
  { id: "detroit-people-mover-qline", countryId: "united-states", name: "Detroit People Mover and QLine", city: "Detroit", region: "Michigan", type: "People mover/streetcar", kind: "light-rail", coordinate: [-83.0458, 42.3314], sourceUrl: "https://en.wikipedia.org/wiki/Detroit_People_Mover", mapUrl: "https://www.transit.land/map#11/42.3314/-83.0458", keyNodes: ["Grand Circus Park", "Renaissance Center", "Campus Martius", "New Center"], quizFocus: "downtown circulator, streetcar, and Detroit River geography" },
  { id: "cleveland-rta-rapid", countryId: "united-states", name: "Cleveland RTA Rapid Transit", city: "Cleveland", region: "Ohio", type: "Metro/light rail", kind: "metro", coordinate: [-81.6944, 41.4993], sourceUrl: "https://en.wikipedia.org/wiki/RTA_Rapid_Transit", mapUrl: "https://www.transit.land/map#11/41.4993/-81.6944", keyNodes: ["Tower City", "Airport", "Shaker Square", "Little Italy"], quizFocus: "Great Lakes rapid transit and airport rail clues" },
  { id: "minneapolis-metro", countryId: "united-states", name: "Metro Transit light rail", city: "Minneapolis-Saint Paul", region: "Minnesota", type: "Light rail", kind: "light-rail", coordinate: [-93.265, 44.9778], sourceUrl: "https://en.wikipedia.org/wiki/Metro_Transit_(Minnesota)", mapUrl: "https://www.transit.land/map#11/44.9778/-93.2650", keyNodes: ["Target Field", "US Bank Stadium", "Mall of America", "MSP Airport"], quizFocus: "Twin Cities light rail, airport, and downtown transfer geography" },
  { id: "lima-metro", countryId: "peru", name: "Lima Metro", city: "Lima", region: "Peru", type: "Metro", kind: "metro", coordinate: [-77.0428, -12.0464], sourceUrl: "https://en.wikipedia.org/wiki/Lima_Metro", mapUrl: "https://www.transit.land/map#11/-12.0464/-77.0428", keyNodes: ["Gamarra", "Miguel Grau", "Villa El Salvador", "Bayovar"], quizFocus: "Peruvian capital metro and coastal-city corridor geography" },
] satisfies TransitSystemRecord[];

const projectedTransitSystems = transitSystemsRepository.flatMap((system) => {
  const projected = worldProjection(system.coordinate);
  return projected ? [{ ...system, x: projected[0], y: projected[1] }] : [];
});

function transitSystemsForRegion(regionId: string) {
  return projectedTransitSystems.filter((system) => system.countryId === regionId);
}

function transitIcon(kind: TransitSystemKind) {
  if (kind === "metro" || kind === "subway") return "🚇";
  if (kind === "high-speed-rail") return "🚄";
  if (kind === "light-rail") return "🚈";
  return "🚆";
}

function mapPositionForRegion(region: Region) {
  return projectedCapitalPositions[region.id] ?? projectedRegionPositions[region.id] ?? region.position;
}

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  return code
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function flagImageSrc(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return `/flag-pack/country-flags-main/svg/${code.toLowerCase()}.svg`;
}

const regionalFlagByCode: Record<string, string> = {
  "CA-AB": "/images/region-flags/regional/canada-alberta.png",
  "CA-BC": "/images/region-flags/regional/canada-british-columbia.png",
  "CA-MB": "/images/region-flags/regional/canada-manitoba.png",
  "CA-NB": "/images/region-flags/regional/canada-new-brunswick.png",
  "CA-NL": "/images/region-flags/regional/canada-newfoundland-and-labrador.png",
  "CA-NS": "/images/region-flags/regional/canada-nova-scotia.png",
  "CA-NT": "/images/region-flags/regional/canada-northwest-territories.png",
  "CA-NU": "/images/region-flags/regional/canada-nunavut.png",
  "CA-ON": "/images/region-flags/regional/canada-ontario.png",
  "CA-PE": "/images/region-flags/regional/canada-prince-edward-island.png",
  "CA-QC": "/images/region-flags/regional/canada-quebec.png",
  "CA-SK": "/images/region-flags/regional/canada-saskatchewan.png",
  "CA-YT": "/images/region-flags/regional/canada-yukon.png",
  "ZA-EC": "/images/region-flags/regional/south-africa-eastern-cape.png",
  "ZA-FS": "/images/region-flags/regional/south-africa-free-state.png",
  "ZA-GP": "/images/region-flags/regional/south-africa-gauteng.png",
  "ZA-KZN": "/images/region-flags/regional/south-africa-kwazulu-natal.png",
  "ZA-LP": "/images/region-flags/regional/south-africa-limpopo.png",
  "ZA-MP": "/images/region-flags/regional/south-africa-mpumalanga.png",
  "ZA-NC": "/images/region-flags/regional/south-africa-northern-cape.png",
  "ZA-NW": "/images/region-flags/regional/south-africa-north-west.png",
  "ZA-WC": "/images/region-flags/regional/south-africa-western-cape.png",
  "ZA.EC": "/images/region-flags/regional/south-africa-eastern-cape.png",
  "ZA.FS": "/images/region-flags/regional/south-africa-free-state.png",
  "ZA.GT": "/images/region-flags/regional/south-africa-gauteng.png",
  "ZA.NL": "/images/region-flags/regional/south-africa-kwazulu-natal.png",
  "ZA.NP": "/images/region-flags/regional/south-africa-limpopo.png",
  "ZA.MP": "/images/region-flags/regional/south-africa-mpumalanga.png",
  "ZA.NC": "/images/region-flags/regional/south-africa-northern-cape.png",
  "ZA.NW": "/images/region-flags/regional/south-africa-north-west.png",
  "ZA.WC": "/images/region-flags/regional/south-africa-western-cape.png",
  "PH-ALB": "/images/region-flags/regional/philippines-albay.png",
  "PH-BTG": "/images/region-flags/regional/philippines-batangas.jpg",
  "PH-QUE": "/images/region-flags/regional/philippines-quezon.png",
  "PH-SLU": "/images/region-flags/regional/philippines-sulu.png",
};

const regionalFlagByName: Record<string, string> = {
  alberta: "/images/region-flags/regional/canada-alberta.png",
  "british-columbia": "/images/region-flags/regional/canada-british-columbia.png",
  manitoba: "/images/region-flags/regional/canada-manitoba.png",
  "new-brunswick": "/images/region-flags/regional/canada-new-brunswick.png",
  "newfoundland-and-labrador": "/images/region-flags/regional/canada-newfoundland-and-labrador.png",
  "nova-scotia": "/images/region-flags/regional/canada-nova-scotia.png",
  nunavut: "/images/region-flags/regional/canada-nunavut.png",
  ontario: "/images/region-flags/regional/canada-ontario.png",
  quebec: "/images/region-flags/regional/canada-quebec.png",
  "prince-edward-island": "/images/region-flags/regional/canada-prince-edward-island.png",
  "northwest-territories": "/images/region-flags/regional/canada-northwest-territories.png",
  yukon: "/images/region-flags/regional/canada-yukon.png",
  saskatchewan: "/images/region-flags/regional/canada-saskatchewan.png",
  "eastern-cape": "/images/region-flags/regional/south-africa-eastern-cape.png",
  "free-state": "/images/region-flags/regional/south-africa-free-state.png",
  gauteng: "/images/region-flags/regional/south-africa-gauteng.png",
  "kwazulu-natal": "/images/region-flags/regional/south-africa-kwazulu-natal.png",
  limpopo: "/images/region-flags/regional/south-africa-limpopo.png",
  mpumalanga: "/images/region-flags/regional/south-africa-mpumalanga.png",
  "northern-cape": "/images/region-flags/regional/south-africa-northern-cape.png",
  "north-west": "/images/region-flags/regional/south-africa-north-west.png",
  "western-cape": "/images/region-flags/regional/south-africa-western-cape.png",
  albay: "/images/region-flags/regional/philippines-albay.png",
  batangas: "/images/region-flags/regional/philippines-batangas.jpg",
  quezon: "/images/region-flags/regional/philippines-quezon.png",
  sulu: "/images/region-flags/regional/philippines-sulu.png",
  rome: "/images/region-flags/regional/italy-rome-province.png",
  roma: "/images/region-flags/regional/italy-rome-province.png",
  milan: "/images/region-flags/regional/italy-milan-province.png",
  naples: "/images/region-flags/regional/italy-naples-metropolitan-city.jpg",
  latina: "/images/region-flags/regional/italy-latina-province.png",
  pisa: "/images/region-flags/regional/italy-pisa-province.png",
  siena: "/images/region-flags/regional/italy-siena-province.png",
  lucca: "/images/region-flags/regional/italy-lucca-province.png",
  gorizia: "/images/region-flags/regional/italy-gorizia-province.png",
  udine: "/images/region-flags/regional/italy-udine-province.gif",
  treviso: "/images/region-flags/regional/italy-treviso-province.gif",
  trapani: "/images/region-flags/regional/italy-trapani-province.gif",
  asti: "/images/region-flags/regional/italy-asti-province.gif",
  "barletta-andria-trani": "/images/region-flags/regional/italy-barletta-andria-trani-province.png",
  caltanissetta: "/images/region-flags/regional/italy-caltanissetta-province.png",
};

function regionalFlagImageSrc(feature: GadmSubdivisionFeature) {
  const code = subdivisionCode(feature);
  const normalizedCode = code.replace(".", "-");
  if (code === "US-DC") return "/images/region-flags/us/dc.svg";
  if (/^US[-.][A-Z]{2}$/.test(code)) return `/images/region-flags/us/${code.slice(3).toLowerCase()}.png`;
  const direct = regionalFlagByCode[code]
    ?? regionalFlagByCode[normalizedCode]
    ?? (feature.properties?.HASC_1 ? regionalFlagByCode[feature.properties.HASC_1] ?? regionalFlagByCode[feature.properties.HASC_1.replace(".", "-")] : undefined);
  if (direct) return direct;
  const normalizedRegionSlug = slugifyCountryName(subdivisionName(feature));
  const countryFlagRows = regionFlagFiles[subdivisionCountryKey(feature)];
  const fuzzyCountryFlagFile = countryFlagRows
    ? Object.entries(countryFlagRows).find(([key]) => key === normalizedRegionSlug || key.startsWith(`${normalizedRegionSlug}-`) || normalizedRegionSlug.startsWith(`${key}-`))?.[1]
    : undefined;
  const countryFlagFile = countryFlagRows?.[normalizedRegionSlug]
    ?? countryFlagRows?.[normalizedRegionSlug.replace("-y-la-", "-y-")]
    ?? (normalizedRegionSlug.includes("magallanes") ? countryFlagRows?.["magallanes-y-la-ant-rtica-chilena-chile"] : undefined)
    ?? (normalizedRegionSlug.includes("magallanes") ? countryFlagRows?.["magallanes-y-antartica-chilena"] : undefined)
    ?? fuzzyCountryFlagFile;
  if (countryFlagFile) return `/images/region-flags/imported/${encodeURIComponent(countryFlagFile).replace(/%2F/g, "/")}`;
  return regionalFlagByName[normalizedRegionSlug]
    ?? (feature.properties?.NAME_1 ? regionalFlagByName[slugifyCountryName(feature.properties.NAME_1)] : undefined)
    ?? "";
}

function regionalFlagImagePathForName(countryId: string, name: string) {
  const slug = slugifyCountryName(name);
  const rows = regionFlagFiles[countryId];
  const fuzzyFileName = rows
    ? Object.entries(rows).find(([key]) => key === slug || key.startsWith(`${slug}-`) || slug.startsWith(`${key}-`))?.[1]
    : undefined;
  const fileName = rows?.[slug]
    ?? rows?.[slug.replace("-y-la-", "-y-")]
    ?? (slug.includes("magallanes") ? rows?.["magallanes-y-la-ant-rtica-chilena-chile"] : undefined)
    ?? (slug.includes("magallanes") ? rows?.["magallanes-y-antartica-chilena"] : undefined)
    ?? fuzzyFileName;
  if (fileName) return `/images/region-flags/imported/${encodeURIComponent(fileName).replace(/%2F/g, "/")}`;
  return regionalFlagByName[slug] ?? "";
}

const dailyLessonCountryImageFiles: Record<string, string> = {
  "United States": "USA.jpg",
  "United Kingdom": "UnitedKingdom.jpg",
  "United Arab Emirates": "United Arab Emirates.jpg",
  "New Zealand": "NewZeland.JPG",
  "South Africa": "South Africa.jpg",
  "South Korea": "South Korea.jpg",
  Colombia: "Colombia.jpg",
  Brazil: "Brazil.jpg",
  France: "France.jpg",
  Japan: "Japan.jpg",
  Mexico: "Mexico.jpg",
  China: "China.JPG",
  Russia: "Russia.jpg",
  Australia: "Australia.jpg",
  Romania: "Romania.jpg",
  Estonia: "Estonia.jpg",
  Ethiopia: "Ethiopia.jpg",
  Kenya: "Kenya.jpg",
  Ghana: "Ghana.jpg",
  Nepal: "Nepal.jpg",
  Nigeria: "Nigeria.jpg",
  Ukraine: "Ukraine.jpg",
  Zimbabwe: "Zimbabwe.png",
};

const countryImageFiles = countryImageManifest as Record<string, string>;
const regionFlagFiles = regionFlagManifest as Record<string, Record<string, string>>;
const regionImageFiles = regionImageManifest as Record<string, Record<string, string>>;
const usStateImageFiles = usStateImageManifest as Record<string, string>;
const localRegionalImageFallbacks: Record<string, Record<string, string>> = {
  canada: {
    quebec: "canada/quebec-city-panorama.png",
  },
  france: {
    "auvergne-rhone-alpes": "france/auvergne-rhone-alpes.jpg",
    "bourgogne-franche-comte": "france/bourgogne-franche-comte.jpg",
    brittany: "france/brittany.jpg",
    "centre-val-de-loire": "france/centre-val-de-loire.jpg",
    corsica: "france/corsica.jpg",
    "grand-est": "france/grand-est.jpg",
    "hauts-de-france": "france/hauts-de-france.jpg",
    "ile-de-france": "france/ile-de-france.webp",
    normandy: "france/normandy.jpg",
    "nouvelle-aquitaine": "france/nouvelle-aquitaine.jpg",
    occitanie: "france/occitanie.jpg",
    "pays-de-la-loire": "france/pays-de-la-loire.jpg",
    "provence-alpes-cote-d-azur": "france/provence-alpes-cote-d-azur.jpg",
  },
  portugal: {
    azores: "portugal/azores.png",
  },
  spain: {
    "canary-islands": "spain/canary-islands.png",
  },
  australia: {
    "australian-capital-territory": "australia/australian-capital-territory.jpg",
    "new-south-wales": "australia/new-south-wales.jpg",
    "northern-territory": "australia/northern-territory.jpg",
    queensland: "australia/queensland.jpg",
    "south-australia": "australia/south-australia.webp",
    tasmania: "australia/tasmania.jpg",
    victoria: "australia/victoria.jpeg",
    "western-australia": "australia/western-australia.jpg",
  },
  japan: {
    chugoku: "japan/chugoku.jpg",
    honshu: "japan/honshu.jpg",
    hokkaido: "japan/hokkaido.jpg",
    kansai: "japan/kansai.jpg",
    kanto: "japan/kanto.jpg",
    kyushu: "japan/kyushu.jpg",
    okinawa: "japan/okinawa.webp",
    shikoku: "japan/shikoku.jpg",
  },
  "united-states": {
    "puerto-rico": "united-states/puerto-rico.jpg",
  },
  greenland: {
    greenland: "greenland/nuuk.png",
    nuuk: "greenland/nuuk.png",
  },
};
const MAP_PAN_LIMIT_X = 12000;
const MAP_PAN_LIMIT_Y = 900;
const WORLD_WRAP_OFFSETS = [-200, -100, 0, 100, 200];
const countryImageAliases: Record<string, string> = {
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  uae: "unitedarabemirates",
  hongkong: "hongkong",
  southkorea: "southkorea",
  northkorea: "northkorea",
  newzealand: "newzeland",
  azerbaijan: "azerbaian",
  belarus: "belurus",
  caboverde: "capeverde",
  coteivoire: "cotedivoire",
  cotedivoire: "cotedivoire",
  ivorycoast: "cotedivoire",
  democraticrepublicofthecongo: "drc",
  republicofthecongo: "congo",
  greenland: "greenland",
};

function imageLookupKey(name: string) {
  return name.replace(/\([^)]*\)/g, "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
}

function prettifySubdivisionCountryName(name?: string) {
  if (!name) return "";
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bUnitedStates\b/g, "United States")
    .replace(/\bUnitedArabEmirates\b/g, "United Arab Emirates")
    .replace(/\bSouthAfrica\b/g, "South Africa")
    .replace(/\bUnitedKingdom\b/g, "United Kingdom")
    .trim();
}

function subdivisionCountryKey(feature: GadmSubdivisionFeature) {
  const pretty = prettifySubdivisionCountryName(feature.properties?.COUNTRY);
  return regionIdForCountryName(pretty) || slugifyCountryName(pretty);
}

function countryImagePathForName(name: string) {
  const fileName = countryImageFileNameForName(name) ?? "GeoTransitPlaceholder.svg";
  return `/images/country-images/${encodeURIComponent(fileName).replace(/%2F/g, "/")}`;
}

const airportReferenceImagesByRegion: Record<string, PlaceImage[]> = {
  "united-states": [
    makeLocalImage("JFK airport map", "airport", "United States", "/images/airport-references/jfk-terminal-map.png"),
    makeLocalImage("LaGuardia airport map", "airport", "United States", "/images/airport-references/lga-terminal-map.png"),
    makeLocalImage("Atlanta airport map", "airport", "United States", "/images/airport-references/atl-terminal-map.png"),
    makeLocalImage("Dallas-Fort Worth airport map", "airport", "United States", "/images/airport-references/dfw-terminal-map.png"),
    makeLocalImage("Orlando airport map", "airport", "United States", "/images/airport-references/mco-terminal-map.png"),
    makeLocalImage("San Francisco AirTrain terminal map", "airport", "United States", "/images/airport-references/sfo-airtrain-terminal-map.png"),
  ],
  "united-kingdom": [
    makeLocalImage("London Heathrow airport map", "airport", "United Kingdom", "/images/airport-references/lhr-terminal-map.png"),
  ],
  taiwan: [
    makeLocalImage("Taipei airport map", "airport", "Taiwan", "/images/airport-references/tpe-terminal-map.png"),
  ],
  france: [
    makeLocalImage("Paris Charles de Gaulle airport map", "airport", "France", "/images/airport-references/cdg-terminal-map.png"),
  ],
  spain: [
    makeLocalImage("Madrid-Barajas airport overview", "airport", "Spain", "/images/airport-references/madrid-barajas-overview.jpg"),
  ],
  "south-korea": [
    makeLocalImage("Incheon Terminal 1 departure map", "airport", "South Korea", "/images/airport-references/incheon-terminal-1.jpg"),
  ],
  israel: [
    makeLocalImage("Ben Gurion airport overview", "airport", "Israel", "/images/airport-references/ben-gurion-overview.jpg"),
  ],
  "south-africa": [
    makeLocalImage("O. R. Tambo Level 1 map", "airport", "South Africa", "/images/airport-references/or-tambo-level-1.png"),
  ],
  "new-zealand": [
    makeLocalImage("Auckland airport overview", "airport", "New Zealand", "/images/airport-references/auckland-overview.png"),
  ],
  netherlands: [
    makeLocalImage("Amsterdam Schiphol airport map", "airport", "Netherlands", "/images/airport-references/schiphol-terminal-map.png"),
  ],
  singapore: [
    makeLocalImage("Jewel Changi airport garden", "airport", "Singapore", "/images/airport-references/changi-jewel.png"),
    makeLocalImage("Singapore Changi terminal map", "airport", "Singapore", "/images/airport-references/changi-terminal-map.png"),
  ],
  japan: [
    makeLocalImage("Tokyo airport rail map", "airport", "Japan", "/images/airport-references/tokyo-airport-map.png"),
    makeLocalImage("Tokyo terminal map", "airport", "Japan", "/images/airport-references/tokyo-terminal-map.png"),
  ],
  china: [
    makeLocalImage("Shanghai airport map", "airport", "China", "/images/airport-references/shanghai-airport-map.png"),
  ],
  ethiopia: [
    makeLocalImage("Addis Ababa terminal map", "airport", "Ethiopia", "/images/airport-references/addis-ababa-terminal-map.png"),
  ],
  brazil: [
    makeLocalImage("Sao Paulo airport terminal map", "airport", "Brazil", "/images/airport-references/sao-paulo-terminal-map.png"),
  ],
  australia: [
    makeLocalImage("Sydney airport map", "airport", "Australia", "/images/airport-references/sydney-airport-map.png"),
  ],
};

function makeLocalImage(name: string, type: string, region: string, imagePath: string): PlaceImage {
  return {
    name,
    type,
    region,
    imagePath,
    attribution: {
      title: name,
      author: "GeoTransit local asset",
      license: "Local app asset",
      sourceUrl: "#",
    },
  };
}

function countryImageFileNameForName(name: string) {
  const key = imageLookupKey(name);
  const alias = countryImageAliases[key] ?? key;
  return dailyLessonCountryImageFiles[name] ?? countryImageFiles[key] ?? countryImageFiles[alias] ?? countryImageFiles[slugifyCountryName(name).replace(/-/g, "")];
}

function profileCompletionFor(region: Region) {
  const hasCapital = Boolean(region.capital && !region.capital.toLowerCase().includes(" capital"));
  const hasPopulation = Boolean(region.population && !region.population.toLowerCase().includes("available in the country profile"));
  const hasFlag = Boolean(region.flag && (flagImageSrc(region.flag) || /^[A-Z]{2}$/.test(region.flag)));
  const hasImage = Boolean(countryImageFileNameForName(region.name));
  return {
    complete: hasCapital && hasPopulation && hasFlag && hasImage,
    hasCapital,
    hasPopulation,
    hasFlag,
    hasImage,
  };
}

const completedProfileRegions = regions.filter((region) => profileCompletionFor(region).complete);

type RegionCompletionRow = {
  code: string;
  name: string;
  complete: boolean;
  hasPopulation: boolean;
  hasFlag: boolean;
  hasCapital: boolean;
  hasImage: boolean;
  hasTransit: boolean;
};

function completionForSubdivision(feature: GadmSubdivisionFeature, countryId: string): RegionCompletionRow {
  const name = subdivisionName(feature);
  const note = subdivisionStudyNote(feature);
  const localSystems = transitSystemsForSubdivision(feature, countryId);
  const hasPopulation = Boolean(subdivisionPopulation(feature) ?? note?.population);
  const hasFlag = Boolean(regionalFlagImageSrc(feature));
  const hasCapital = Boolean(note?.capital);
  const hasImage = Boolean(subdivisionImagePathForRegion(countryId, name));
  const hasTransit = Boolean(note?.transit || localSystems.length > 0);
  return {
    code: subdivisionCode(feature) || `${countryId}-${slugifyCountryName(name)}`,
    name,
    complete: hasPopulation && hasFlag && hasCapital && hasImage,
    hasPopulation,
    hasFlag,
    hasCapital,
    hasImage,
    hasTransit,
  };
}

function usStateImagePathForName(name: string) {
  const key = imageLookupKey(name);
  const fileName = usStateImageFiles[key] ?? (key === "districtofcolumbia" ? usStateImageFiles.dc : undefined);
  return fileName ? `/images/us-state-images/${encodeURIComponent(fileName).replace(/%2F/g, "/")}` : "";
}

function regionImagePathForName(countryId: string, name: string) {
  const slug = slugifyCountryName(name);
  const rows = regionImageFiles[countryId];
  const fuzzyFileName = rows
    ? Object.entries(rows).find(([key]) => key === slug || key.startsWith(`${slug}-`) || slug.startsWith(`${key}-`))?.[1]
    : undefined;
  const localFileName = localRegionalImageFallbacks[countryId]?.[slug];
  const fileName = rows?.[slug]
    ?? rows?.[slug.replace("-y-la-", "-y-")]
    ?? localFileName
    ?? (slug.includes("magallanes") ? rows?.["magallenes"] : undefined)
    ?? (slug.includes("magallanes") ? rows?.["magallanes-y-antartica-chilena"] : undefined)
    ?? fuzzyFileName;
  return fileName ? `/images/region-images/${encodeURIComponent(fileName).replace(/%2F/g, "/")}` : "";
}

function subdivisionImagePathForRegion(countryId: string, name: string) {
  return regionImagePathForName(countryId, name)
    || (countryId === "united-states" || countryId === "canada" ? usStateImagePathForName(name) : "");
}

function loadPlaceImages() {
  if (placeImagesCache) return Promise.resolve(placeImagesCache);
  if (!placeImagesPromise) {
    placeImagesPromise = fetch("/images/places/places.json")
      .then((response) => response.ok ? response.json() : [])
      .then((items: PlaceImage[]) => {
        placeImagesCache = Object.fromEntries(
          items
            .filter((item) => item.imagePath)
            .map((item) => [slugifyCountryName(item.name), item]),
        );
        return placeImagesCache;
      })
      .catch(() => {
        placeImagesCache = {};
        return placeImagesCache;
      });
  }
  return placeImagesPromise;
}

function loadWriBoundaries() {
  if (wriBoundaryCache) return Promise.resolve(wriBoundaryCache);
  if (!wriBoundaryPromise) {
    wriBoundaryPromise = fetch("/data/wri/all_countries.min.geojson")
      .then((response) => response.ok ? response.json() : { features: [] })
      .then((collection: GeoJSON.FeatureCollection<GeoJSON.Geometry, WriBoundaryFeature["properties"]>) => {
        wriBoundaryCache = collection.features ?? [];
        return wriBoundaryCache;
      })
      .catch(() => {
        wriBoundaryCache = [];
        return wriBoundaryCache;
      });
  }
  return wriBoundaryPromise;
}

function loadGadmSubdivisions(regionId: string) {
  const filePath = gadmLevelOneFiles[regionId];
  if (!filePath) return Promise.resolve([]);
  if (gadmSubdivisionCache[regionId]) return Promise.resolve(gadmSubdivisionCache[regionId]);
  if (!gadmSubdivisionPromises[regionId]) {
    gadmSubdivisionPromises[regionId] = fetch(filePath)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load subdivisions for ${regionId}`);
        return response.json();
      })
      .then((collection: GeoJSON.FeatureCollection<GeoJSON.Geometry, GadmSubdivisionProperties>) => {
        gadmSubdivisionCache[regionId] = collection.features ?? [];
        return gadmSubdivisionCache[regionId];
      })
      .catch(() => {
        gadmSubdivisionCache[regionId] = [];
        return [];
      });
  }
  return gadmSubdivisionPromises[regionId];
}

function subdivisionName(feature: GadmSubdivisionFeature) {
  const name = feature.properties?.shapeName ?? feature.properties?.NAME_2 ?? feature.properties?.NAME_1 ?? "Regional subdivision";
  const displayNames: Record<string, string> = {
    AbuDhabi: "Abu Dhabi",
    AddisAbeba: "Addis Ababa",
    AndamanandNicobar: "Andaman and Nicobar Islands",
    AndhraPradesh: "Andhra Pradesh",
    "Andalucía": "Andalusia",
    "Aragón": "Aragon",
    ArunachalPradesh: "Arunachal Pradesh",
    AustralianCapitalTerritory: "Australian Capital Territory",
    BenshangulGumaz: "Benshangul-Gumaz",
    CastillayLeón: "Castile and Leon",
    CastillaLaMancha: "Castilla-La Mancha",
    "Castilla-LaMancha": "Castilla-La Mancha",
    Cataluña: "Catalonia",
    CeutayMelilla: "Ceuta and Melilla",
    CoralSeaIslandsTerritory: "Coral Sea Islands Territory",
    ComunidaddeMadrid: "Community of Madrid",
    ComunidadForaldeNavarra: "Navarra",
    ComunidadValenciana: "Valencian Community",
    DadraandNagarHaveli: "Dadra and Nagar Haveli",
    DamanandDiu: "Daman and Diu",
    DireDawa: "Dire Dawa",
    Fujairah: "Fujairah",
    GambelaPeoples: "Gambela Peoples",
    HarariPeople: "Harari People",
    HimachalPradesh: "Himachal Pradesh",
    IslasBaleares: "Balearic Islands",
    IslasCanarias: "Canary Islands",
    JammuandKashmir: "Jammu and Kashmir",
    JervisBayTerritory: "Jervis Bay Territory",
    LaRioja: "La Rioja",
    MadhyaPradesh: "Madhya Pradesh",
    Naoasaki: "Nagasaki",
    NCTofDelhi: "NCT of Delhi",
    NewSouthWales: "New South Wales",
    NorthernTerritory: "Northern Territory",
    PaísVasco: "Basque Country",
    PrincipadodeAsturias: "Asturias",
    RasAlKhaimah: "Ras Al Khaimah",
    "RasAl-Khaimah": "Ras Al Khaimah",
    RegióndeMurcia: "Region of Murcia",
    SouthAustralia: "South Australia",
    SouthernNationsNationalities: "Southern Nations, Nationalities",
    "SouthernNations,Nationalities": "Southern Nations, Nationalities",
    TamilNadu: "Tamil Nadu",
    UmmalQaywayn: "Umm Al Quwain",
    "Ummal-Qaywayn": "Umm Al Quwain",
    UttarPradesh: "Uttar Pradesh",
    ValledAosta: "Valle d'Aosta",
    "Valled'Aosta": "Valle d'Aosta",
    WesternAustralia: "Western Australia",
    WestBengal: "West Bengal",
  };
  return displayNames[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function subdivisionType(feature: GadmSubdivisionFeature) {
  return feature.properties?.shapeType ?? feature.properties?.ENGTYPE_2 ?? feature.properties?.TYPE_2 ?? feature.properties?.ENGTYPE_1 ?? feature.properties?.TYPE_1 ?? "Region";
}

function subdivisionCode(feature: GadmSubdivisionFeature) {
  return feature.properties?.ISO_1 && feature.properties.ISO_1 !== "NA"
    ? feature.properties.ISO_1
    : feature.properties?.shapeISO && feature.properties.shapeISO !== "NA"
      ? feature.properties.shapeISO
    : feature.properties?.HASC_2 && feature.properties.HASC_2 !== "NA"
      ? feature.properties.HASC_2
      : feature.properties?.HASC_1 && feature.properties.HASC_1 !== "NA"
        ? feature.properties.HASC_1
        : feature.properties?.shapeID ?? feature.properties?.GID_2 ?? feature.properties?.GID_1 ?? "";
}

function subdivisionStudyNote(feature: GadmSubdivisionFeature) {
  const key = subdivisionCode(feature);
  const label = subdivisionName(feature);
  const normalizedLabel = slugifyCountryName(label);
  const gadmName = feature.properties?.NAME_1;
  const normalizedGadmName = gadmName ? slugifyCountryName(gadmName) : "";
  return subdivisionStudyNotes[key]
    ?? (feature.properties?.HASC_1 ? subdivisionStudyNotes[feature.properties.HASC_1] : undefined)
    ?? subdivisionStudyNotes[label]
    ?? subdivisionStudyNotes[normalizedLabel]
    ?? (gadmName ? subdivisionStudyNotes[gadmName] : undefined)
    ?? (normalizedGadmName ? subdivisionStudyNotes[normalizedGadmName] : undefined);
}

function subdivisionPopulation(feature: GadmSubdivisionFeature) {
  const code = subdivisionCode(feature);
  const compactName = subdivisionName(feature);
  const plainName = compactName.replace(/\([^)]*\)/g, "").trim();
  const parentName = feature.properties?.NAME_1 ? feature.properties.NAME_1.replace(/([a-z])([A-Z])/g, "$1 $2") : "";
  const countryName = feature.properties?.COUNTRY ?? (feature.properties?.shapeGroup === "NPL" ? "Nepal" : "");
  const countryRows = countryName ? importedRegionalPopulations[countryName] : undefined;
  return regionalPopulationByCode[code]
    ?? (feature.properties?.HASC_1 ? regionalPopulationByCode[feature.properties.HASC_1] : undefined)
    ?? regionalPopulationByName[compactName]
    ?? regionalPopulationByName[parentName]
    ?? countryRows?.[plainName]
    ?? countryRows?.[plainName.replace(/\s+/g, "")]
    ?? countryRows?.[plainName.replace(/\s+/g, "") + "Parish"]
    ?? countryRows?.[compactName]
    ?? countryRows?.[compactName.replace(/\s+/g, "")]
    ?? countryRows?.[compactName.replace(/\s+/g, "") + "Parish"]
    ?? countryRows?.[parentName]
    ?? countryRows?.[parentName.replace(/\s+/g, "")];
}

function airportsForSubdivision(feature: GadmSubdivisionFeature, countryId: string) {
  const name = subdivisionName(feature).toLowerCase();
  const note = subdivisionStudyNote(feature);
  const transitText = note?.transit?.toLowerCase() ?? "";
  const region = regions.find((item) => item.id === countryId);
  if (!region) return [];
  return region.airports.filter((airport) => {
    const text = airport.toLowerCase();
    return transitText.includes(text) || text.includes(name) || (
      name === "florida" && /\b(MIA|MCO|FLL|TPA|JAX)\b/i.test(airport)
    ) || (
      name === "new york" && /\b(JFK|LGA|EWR)\b/i.test(airport)
    ) || (
      name === "california" && /\b(LAX|SFO|SAN|SJC)\b/i.test(airport)
    ) || (
      name === "georgia" && /\bATL\b/i.test(airport)
    ) || (
      name === "ontario" && /\bYYZ|YOW\b/i.test(airport)
    ) || (
      name === "new south wales" && /\bSYD\b/i.test(airport)
    ) || (
      name === "veneto" && /\bVCE\b/i.test(airport)
    ) || (
      name === "sicily" && /\bPMO|CTA\b/i.test(airport)
    ) || (
      name === "sardinia" && /\bCAG\b/i.test(airport)
    ) || (
      name === "valencian community" && /\bVLC\b/i.test(airport)
    ) || (
      name === "basque country" && /\bBIO\b/i.test(airport)
    ) || (
      name === "norte" && /\bOPO\b/i.test(airport)
    ) || (
      name === "algarve" && /\bFAO\b/i.test(airport)
    ) || (
      name === "provence-alpes-cote d'azur" && /\bNCE|MRS\b/i.test(airport)
    ) || (
      name === "nouvelle-aquitaine" && /\bBOD\b/i.test(airport)
    ) || (
      name === "oslo" && /\bOSL\b/i.test(airport)
    ) || (
      name === "trondelag" && /\bTRD\b/i.test(airport)
    ) || (
      name === "troms" && /\bTOS\b/i.test(airport)
    ) || (
      name === "moscow" && /\bSVO|DME|VKO\b/i.test(airport)
    ) || (
      name === "saint petersburg" && /\bLED\b/i.test(airport)
    ) || (
      name === "western cape" && /\bCPT\b/i.test(airport)
    ) || (
      name === "gauteng" && /\bJNB\b/i.test(airport)
    );
  }).slice(0, 6);
}

function transitSystemsForSubdivision(feature: GadmSubdivisionFeature, countryId: string) {
  const name = subdivisionName(feature).toLowerCase();
  const normalizedName = slugifyCountryName(subdivisionName(feature));
  const note = subdivisionStudyNote(feature)?.transit?.toLowerCase() ?? "";
  const aliases = subdivisionTransitAliases[normalizedName] ?? [];
  return transitSystemsRepository.filter((system) => (
    system.countryId === countryId
    && (
      system.region.toLowerCase().includes(name)
      || system.city.toLowerCase().includes(name)
      || aliases.includes(system.id)
      || note.includes(system.city.toLowerCase())
      || note.includes(system.name.toLowerCase())
    )
  )).slice(0, 5);
}

const subdivisionTransitAliases: Record<string, string[]> = {
  georgia: ["marta"],
  utah: ["uta-trax"],
  ohio: ["cleveland-rta-rapid"],
  arizona: ["phoenix-valley-metro", "tucson-sun-link"],
  florida: ["brightline", "miami-metrorail", "jacksonville-skyway", "tampa-teco-line"],
  washington: ["sound-transit"],
  hawaii: ["honolulu-skyline"],
  texas: ["houston-metrorail", "austin-capmetro-rail"],
  "north-carolina": ["charlotte-lynx"],
  pennsylvania: ["pittsburgh-light-rail"],
  michigan: ["detroit-people-mover-qline"],
  minnesota: ["minneapolis-metro"],
  "british-columbia": ["vancouver-skytrain"],
  alberta: ["calgary-ctrain"],
  quebec: ["montreal-metro"],
  ontario: ["toronto-ttc"],
  norte: ["porto-metro"],
  "valencian-community": ["valencia-metro"],
  "masovian-voivodeship": ["warsaw-metro"],
  moscow: ["moscow-metro"],
  "saint-petersburg": ["saint-petersburg-metro"],
  "western-cape": ["cape-town-myciti"],
  gauteng: ["gautrain"],
};

function usePlaceImage(region: Region) {
  const [image, setImage] = useState<PlaceImage | null>(null);
  useEffect(() => {
    let cancelled = false;
    setImage(null);
    loadPlaceImages().then((items) => {
      if (!cancelled) setImage(items[region.id] ?? items[slugifyCountryName(region.name)] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [region.id, region.name]);
  return image;
}

function answerForQuestion(run: QuizRun, index: number) {
  const question = run.questions[index];
  return question ? run.answers.find((answer) => answer.question.id === question.id) : undefined;
}

function shuffleByClock<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function choicesFrom(answer: string, candidates: string[]) {
  const distractors = shuffleByClock(candidates.filter((item) => item && item !== answer)).slice(0, 3);
  return shuffleByClock([answer, ...distractors]);
}

function questionMatchesPracticeTopics(question: Question, topics: PracticeTopic[]) {
  if (topics.includes("transport") && ["airports", "airport-codes", "metro", "rail", "highways", "maritime"].includes(question.category)) return true;
  if (topics.includes("capitals") && question.category === "capitals") return true;
  if (topics.includes("flags") && question.category === "flags") return true;
  if (topics.includes("geography") && ["rivers-mountains", "former-countries"].includes(question.category)) return true;
  if (topics.includes("landmarks") && question.category === "landmarks") return true;
  if (topics.includes("tourist") && question.category === "landmarks" && (question.visualType || question.image)) return true;
  return false;
}

function buildRegionPracticeQuestions(region: Region, count: number, startDifficulty: DifficultyLevel, topics: PracticeTopic[]): Question[] {
  const countryPool = regions.map((item) => item.name);
  const airportPool = regions.flatMap((item) => item.airports.slice(0, 3));
  const railPool = regions.flatMap((item) => item.rail.slice(0, 3));
  const metroPool = regions.flatMap((item) => item.metro.slice(0, 3));
  const highwayPool = regions.flatMap((item) => item.highways.slice(0, 3));
  const maritimePool = regions.flatMap((item) => item.maritime.slice(0, 3));
  const landmarkPool = regions.flatMap((item) => item.landmarks.slice(0, 3));
  const geographyPool = regions.flatMap((item) => item.riversMountains.slice(0, 3));
  const placePool = regions.flatMap((item) => item.placesOfInterest.slice(0, 3));
  const capitalPool = regions.map((item) => item.capital);
  const primaryAirport = region.airports[0] ?? `No major commercial airport listed for ${region.name}`;
  const airportCity = region.majorCities[0] ?? region.capital.split(",")[0] ?? region.name;
  const levelIndex = difficultyLevels.indexOf(startDifficulty);
  const shouldUseCodeQuestions = levelIndex >= difficultyLevels.indexOf("interchange");
  const practiceTemplates: Question[] = [
    {
      id: `practice-${region.id}-capital`,
      category: "capitals",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `What is the capital of ${region.name}?`,
      answer: region.capital,
      choices: choicesFrom(region.capital, capitalPool),
      explanation: `${region.capital} is the capital anchor for ${region.name}.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-airport`,
      category: shouldUseCodeQuestions && primaryAirport.length === 3 && primaryAirport.toUpperCase() === primaryAirport ? "airport-codes" : "airports",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: primaryAirport.length === 3 && primaryAirport.toUpperCase() === primaryAirport
        ? `Which airport code matches ${airportCity}'s main gateway?`
        : `Which aviation clue is tied to ${airportCity} and ${region.name}?`,
      answer: primaryAirport,
      choices: choicesFrom(primaryAirport, airportPool),
      explanation: `${primaryAirport} is the aviation clue connected to ${airportCity} in ${region.name}.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-rail`,
      category: "rail",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which rail or intercity corridor is associated with ${region.name}?`,
      answer: region.rail[0],
      choices: choicesFrom(region.rail[0], railPool),
      explanation: `${region.rail[0]} is listed in ${region.name}'s rail profile.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-metro`,
      category: "metro",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which metro or urban transit clue belongs to ${region.name}?`,
      answer: region.metro[0],
      choices: choicesFrom(region.metro[0], metroPool),
      explanation: `${region.metro[0]} is part of ${region.name}'s urban transit profile.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-highway`,
      category: "highways",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which road corridor helps explain movement across ${region.name}?`,
      answer: region.highways[0],
      choices: choicesFrom(region.highways[0], highwayPool),
      explanation: `${region.highways[0]} is one of the road clues in ${region.name}'s profile.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-maritime`,
      category: "maritime",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which port, ferry, river, or maritime clue fits ${region.name}?`,
      answer: region.maritime[0],
      choices: choicesFrom(region.maritime[0], maritimePool),
      explanation: `${region.maritime[0]} is part of ${region.name}'s water-access profile.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-landmark`,
      category: "landmarks",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which landmark belongs to ${region.name}?`,
      answer: region.landmarks[0],
      choices: choicesFrom(region.landmarks[0], landmarkPool),
      explanation: `${region.landmarks[0]} appears in ${region.name}'s landmark list.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-geography`,
      category: "rivers-mountains",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which river, mountain, coast, or landform belongs to ${region.name}?`,
      answer: region.riversMountains[0],
      choices: choicesFrom(region.riversMountains[0], geographyPool),
      explanation: `${region.riversMountains[0]} appears in ${region.name}'s geography profile.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-place`,
      category: "landmarks",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which place of interest is listed for ${region.name}?`,
      answer: region.placesOfInterest[0],
      choices: choicesFrom(region.placesOfInterest[0], placePool),
      explanation: `${region.placesOfInterest[0]} is listed in ${region.name}'s places of interest.`,
      relatedRegionIds: [region.id],
    },
    {
      id: `practice-${region.id}-country-pair`,
      category: "rail",
      difficulty: startDifficulty,
      inputType: "multiple-choice",
      prompt: `Which country connects ${region.rail[0]} with ${region.metro[0]} in one profile?`,
      answer: region.name,
      choices: choicesFrom(region.name, countryPool),
      explanation: `${region.rail[0]} and ${region.metro[0]} are both transportation clues for ${region.name}.`,
      relatedRegionIds: [region.id],
    },
  ];
  const topicFilteredTemplates = practiceTemplates.filter((question) => questionMatchesPracticeTopics(question, topics));
  const readableTemplates = topicFilteredTemplates.filter((question) => {
    if (levelIndex < difficultyLevels.indexOf("interchange") && question.category === "airport-codes") return false;
    if (levelIndex < difficultyLevels.indexOf("express") && question.category === "highways") return false;
    return Boolean(question.answer && !question.answer.toLowerCase().includes("no major commercial airport"));
  });
  const templates = readableTemplates.length > 0 ? readableTemplates : topicFilteredTemplates.length > 0 ? topicFilteredTemplates : practiceTemplates;
  return shuffleByClock(templates).slice(0, count);
}

function practiceDepthForRegion(region: Region, transitCount: number, attractionCount: number) {
  const highFocusIds = new Set([
    "united-states", "canada", "mexico", "brazil", "argentina", "united-kingdom", "france", "germany", "italy",
    "spain", "russia", "china", "japan", "india", "australia", "new-zealand", "south-africa", "uae", "israel",
    "uzbekistan", "thailand", "colombia", "taiwan", "poland", "austria", "norway",
  ]);
  if (highFocusIds.has(region.id) || transitCount >= 2 || attractionCount >= 2) return "deep";
  if (region.majorCities.length >= 4 || region.landmarks.length >= 4) return "standard";
  return "basic";
}

function practiceTopicOptionsForRegion(region: Region, transitCount: number, attractionCount: number): Array<{ id: PracticeTopic; label: string }> {
  const depth = practiceDepthForRegion(region, transitCount, attractionCount);
  const options: Array<{ id: PracticeTopic; label: string }> = [
    { id: "capitals", label: "Capital basics" },
    { id: "geography", label: "Geography facts" },
  ];
  if (depth !== "basic") options.push({ id: "landmarks", label: "Landmarks" });
  if (attractionCount > 0) options.push({ id: "tourist", label: "Tourist attractions" });
  if (depth === "deep" && transitCount > 0) options.unshift({ id: "transport", label: "Transportation" });
  return options;
}

function nextUnansweredIndex(run: QuizRun, fromIndex: number) {
  for (let index = fromIndex + 1; index < run.questions.length; index += 1) {
    if (!answerForQuestion(run, index)) return index;
  }
  for (let index = 0; index <= fromIndex; index += 1) {
    if (!answerForQuestion(run, index)) return index;
  }
  return -1;
}

function FlagAsset({ code, label = "Country flag" }: { code: string; label?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [code]);
  const src = flagImageSrc(code);
  if (!src || failed) return <span>{flagEmoji(code)}</span>;
  return <img src={src} alt={label} onError={() => setFailed(true)} />;
}

function hydrateSavedRun(savedRun: QuizRun | null) {
  if (!savedRun) return null;
  const questionById = new Map(questions.map((question) => [question.id, question]));
  return {
    ...savedRun,
    questions: savedRun.questions.map((question) => questionById.get(question.id) ?? question),
    answers: savedRun.answers.map((answer) => {
      const refreshedQuestion = questionById.get(answer.question.id) ?? answer.question;
      return { ...answer, question: refreshedQuestion };
    }),
  };
}

function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing-screen" aria-label="GEOTRANSIT landing page">
      <img className="landing-hero-image" src="/images/brand/geotransit-hero.png" alt="" />
      <div className="landing-overlay" />
      <section className="landing-content">
        <img className="landing-logo" src="/images/brand/geontransit-wide-logo.png" alt="GEONTRANSIT" />
        <button type="button" className="landing-start-button" onClick={onStart}>
          Start Here
        </button>
      </section>
    </main>
  );
}

function App() {
  const [hasStarted, setHasStarted] = useState(() => localStorage.getItem("geontransit.started.v2") === "yes");
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [profiles, setProfiles] = useState<PlayerProfile[]>(() => loadProfiles());
  const [friends, setFriends] = useState<LocalFriend[]>(() => loadFriends());
  const [run, setRun] = useState<QuizRun | null>(() => hydrateSavedRun(loadRun()));
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>("united-states");
  const [mapStyle, setMapStyle] = useState<MapStyle>("default");
  const [operationalOverlay, setOperationalOverlay] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [countryLayer, setCountryLayer] = useState(true);
  const [regionalBoundaryLayer, setRegionalBoundaryLayer] = useState(false);
  const [touristAttractionsLayer, setTouristAttractionsLayer] = useState(false);
  const [selectedAttractionId, setSelectedAttractionId] = useState<string | null>(null);
  const [transitSystemsLayer, setTransitSystemsLayer] = useState(false);
  const [selectedTransitSystemId, setSelectedTransitSystemId] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<10 | 15 | 20 | 150>(10);
  const [selectedStartLevel, setSelectedStartLevel] = useState<DifficultyLevel>("gateway");
  const [showReviewAnswers, setShowReviewAnswers] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [showDailyLesson, setShowDailyLesson] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("geontransit.sound.v1") !== "off");

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => {
    setProfiles((items) => items.some((item) => item.id === profile.id)
      ? items.map((item) => item.id === profile.id ? profile : item)
      : [profile, ...items]);
  }, [profile]);
  useEffect(() => saveProfiles(profiles), [profiles]);
  useEffect(() => saveFriends(friends), [friends]);
  useEffect(() => saveRun(run), [run]);
  useEffect(() => localStorage.setItem("geontransit.sound.v1", soundEnabled ? "on" : "off"), [soundEnabled]);

  const selectedRegion = selectedRegionId ? regions.find((region) => region.id === selectedRegionId) ?? null : null;
  const accuracy = profile.totalAnswered ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100) : 100;

  function startRun(seedQuestion?: Question) {
    const nextRun = createRun(profile, questionCount, selectedStartLevel);
    if (seedQuestion) {
      nextRun.questions = [seedQuestion, ...nextRun.questions.filter((question) => question.id !== seedQuestion.id)].slice(0, questionCount);
      nextRun.questionCount = nextRun.questions.length;
    }
    setRun(nextRun);
    setActiveTab("play");
  }

  function startCountryRun(region: Region, seedQuestion?: Question, topics: PracticeTopic[] = ["transport", "capitals", "geography", "landmarks", "tourist"]) {
    const nextRun = createRun(profile, questionCount, selectedStartLevel);
    const explicitQuestions = questions
      .filter((question) => question.relatedRegionIds?.includes(region.id))
      .filter((question) => questionMatchesPracticeTopics(question, topics));
    const generatedQuestions = buildRegionPracticeQuestions(region, Math.max(questionCount, 20), selectedStartLevel, topics);
    const pool = shuffleByClock([
      ...(seedQuestion ? [seedQuestion] : []),
      ...explicitQuestions,
      ...generatedQuestions,
    ]);
    const seen = new Set<string>();
    nextRun.questions = pool.filter((question) => {
      if (seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    }).slice(0, questionCount);
    nextRun.questionCount = nextRun.questions.length;
    nextRun.difficulty = selectedStartLevel;
    setRun(nextRun);
    setActiveTab("play");
  }

  function answerQuestion(userAnswer: string) {
    if (!run || !run.active) return;
    const question = run.questions[run.index];
    if (!question) return;
    if (answerForQuestion(run, run.index)) {
      const nextIndex = nextUnansweredIndex(run, run.index);
      setRun({ ...run, index: nextIndex >= 0 ? nextIndex : Math.min(run.index + 1, run.questions.length - 1) });
      return;
    }
    const correct = isCorrect(question, userAnswer);
    if (soundEnabled) playAnswerTone(correct);
    const points = correct ? difficultyScore[question.difficulty] + run.correctStreak * 15 : 0;
    const correctStreak = correct ? run.correctStreak + 1 : 0;
    const missStreak = correct ? 0 : run.missStreak + 1;
    const difficulty = nextDifficulty(run.difficulty, correct, correctStreak, missStreak);
    const nextScore = run.score + points;
    const answered = [...run.answers, { question, userAnswer, correct, points }];
    const finished = answered.length >= run.questions.length;
    const nextQuestions = [...run.questions];

    if (!finished && correct && difficultyRank(difficulty) > difficultyRank(run.difficulty)) {
      const usedIds = new Set(answered.map((answer) => answer.question.id));
      nextQuestions.slice(run.index + 1).forEach((upcoming) => usedIds.add(upcoming.id));
      const allowOuterLimits = correctStreak >= 8 || run.index > run.questions.length * 0.6;
      const recentlySeenIds = new Set(profile.answeredQuestionIds?.slice(-800) ?? []);
      const harderCandidate = questions
        .filter((candidate) => !usedIds.has(candidate.id))
        .filter((candidate) => !recentlySeenIds.has(candidate.id))
        .filter((candidate) => candidate.difficulty !== "outer-limits" || allowOuterLimits)
        .filter((candidate) => difficultyRank(candidate.difficulty) >= difficultyRank(difficulty))
        .sort((a, b) => {
          const aSeen = profile.questionHistory?.[a.id]?.seen ?? 0;
          const bSeen = profile.questionHistory?.[b.id]?.seen ?? 0;
          return aSeen - bSeen || difficultyRank(b.difficulty) - difficultyRank(a.difficulty) || Math.random() - 0.5;
        })[0];
      if (harderCandidate) {
        const replaceIndex = nextQuestions.findIndex((candidate, index) => index > run.index && !answered.some((answer) => answer.question.id === candidate.id));
        if (replaceIndex > run.index) nextQuestions[replaceIndex] = harderCandidate;
      }
    }

    const categoryStats = { ...profile.categoryStats };
    const stat = categoryStats[question.category] ?? { answered: 0, correct: 0 };
    categoryStats[question.category] = {
      answered: stat.answered + 1,
      correct: stat.correct + (correct ? 1 : 0),
    };
    const previousQuestionHistory = profile.questionHistory?.[question.id] ?? { seen: 0, correct: 0, lastSeen: "" };
    const questionHistory = {
      ...(profile.questionHistory ?? {}),
      [question.id]: {
        seen: previousQuestionHistory.seen + 1,
        correct: previousQuestionHistory.correct + (correct ? 1 : 0),
        lastSeen: new Date().toISOString(),
      },
    };

    const incorrectAnswers = correct
      ? profile.incorrectAnswers
      : [
          {
            id: crypto.randomUUID(),
            question,
            userAnswer: userAnswer || "No answer",
            dateMissed: new Date().toISOString(),
          },
          ...profile.incorrectAnswers,
        ].slice(0, 60);

    const highScore = finished ? Math.max(profile.highScore, nextScore) : profile.highScore;
    setProfile({
      ...profile,
      highScore,
      totalAnswered: profile.totalAnswered + 1,
      totalCorrect: profile.totalCorrect + (correct ? 1 : 0),
      currentDifficulty: difficulty,
      categoryStats,
      answeredQuestionIds: [...(profile.answeredQuestionIds ?? []), question.id].slice(-800),
      questionHistory,
      incorrectAnswers,
    });

    setRun({
      ...run,
      active: !finished,
      index: finished ? run.index : nextUnansweredIndex({ ...run, questions: nextQuestions, answers: answered }, run.index),
      score: nextScore,
      correctStreak,
      missStreak,
      difficulty,
      questions: nextQuestions,
      answers: answered,
      newRecord: finished && nextScore > run.previousHighScore,
    });
  }

  function updateProfileName(name: string) {
    setProfile({ ...profile, name });
  }

  function createLocalProfile() {
    if (profiles.length > 0) return;
    const nextProfile = createDefaultProfile();
    setProfiles((items) => [nextProfile, ...items]);
    setProfile(nextProfile);
    setRun(null);
  }

  function switchLocalProfile(profileId: string) {
    const nextProfile = profiles.find((item) => item.id === profileId);
    if (!nextProfile) return;
    setProfile(nextProfile);
    setRun(null);
  }

  function deleteLocalProfile(profileId: string) {
    const remainingProfiles = profiles.filter((item) => item.id !== profileId);
    const nextProfiles = remainingProfiles.length > 0 ? remainingProfiles : [createDefaultProfile()];
    setProfiles(nextProfiles);
    if (profile.id === profileId) {
      setProfile(nextProfiles[0]);
      setRun(null);
    }
  }

  function addFriend(friend: Omit<LocalFriend, "id">) {
    setFriends((items) => [{ id: crypto.randomUUID(), ...friend }, ...items].slice(0, 40));
  }

  function removeFriend(friendId: string) {
    setFriends((items) => items.filter((friend) => friend.id !== friendId));
  }

  function setGuestMode(isGuest: boolean) {
    setProfile({
      ...profile,
      isGuest,
    });
  }

function resetProfile() {
    const nextProfile = createDefaultProfile();
    setProfile(nextProfile);
    setProfiles([nextProfile]);
    setRun(null);
  }

  function exitRun() {
    setRun(null);
  }

  function navigateRun(delta: number) {
    if (!run) return;
    setRun({
      ...run,
      index: Math.max(0, Math.min(run.questions.length - 1, run.index + delta)),
    });
  }

  function skipQuestion() {
    if (!run) return;
    const nextIndex = nextUnansweredIndex(run, run.index);
    setRun({
      ...run,
      index: nextIndex >= 0 ? nextIndex : Math.min(run.index + 1, run.questions.length - 1),
    });
  }

  function closeGuide() {
    localStorage.setItem("geontransit.guide.seen.v3", "yes");
    setShowGuide(false);
  }

  if (!hasStarted) {
    return <LandingScreen onStart={() => {
      localStorage.setItem("geontransit.started.v2", "yes");
      setHasStarted(true);
      setActiveTab("map");
    }} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <button type="button" className="brand-home-button" onClick={() => setActiveTab("map")} aria-label="Return to map home">
            <img className="brand-logo-image" src="/images/brand/geontransit-logo.svg" alt="GEONTRANSIT" />
          </button>
          <div className="brand-copy">
            <p className="eyebrow">Welcome to GeoTransit</p>
            <h1>Explore the world's transit systems, airports, regions, and geography.</h1>
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <StartHereMenu
        open={showStartMenu}
        onToggle={() => setShowStartMenu((open) => !open)}
        onAbout={() => {
          setShowAbout((open) => !open);
          setShowStartMenu(false);
        }}
        onGuide={() => {
          setShowGuide(true);
          setShowStartMenu(false);
        }}
        onSettings={() => {
          setShowSettings((open) => !open);
          setShowStartMenu(false);
        }}
        onLesson={() => {
          setShowDailyLesson((open) => !open);
          setShowStartMenu(false);
        }}
      />
      {showGuide && <GuideOverlay onClose={closeGuide} />}
      {showAbout && <AboutPanel onClose={() => setShowAbout(false)} />}
      {showDailyLesson && <DailyLessonPanel onClose={() => setShowDailyLesson(false)} />}
      {showSettings && (
        <SettingsPanel
          profile={profile}
          profiles={profiles}
          friends={friends}
          soundEnabled={soundEnabled}
          onSoundChange={setSoundEnabled}
          onClose={() => setShowSettings(false)}
          onOpenProfile={() => {
            setActiveTab("profile");
            setShowSettings(false);
          }}
          onResetProfile={resetProfile}
          onBuildMode={(mode) => {
            if (mode === "classic") {
              setMapStyle("dark");
              setOperationalOverlay(true);
            } else {
              setMapStyle("default");
              setOperationalOverlay(false);
            }
          }}
        />
      )}

      {activeTab === "play" && (
        <PlayTab
          run={run}
          profile={profile}
          questionCount={questionCount}
          onQuestionCountChange={setQuestionCount}
          selectedStartLevel={selectedStartLevel}
          onStartLevelChange={setSelectedStartLevel}
          onStart={() => startRun()}
          onAnswer={answerQuestion}
          onSkip={skipQuestion}
          onExit={exitRun}
          onNavigate={navigateRun}
          onPreviewRegionSelect={(id) => {
            setSelectedRegionId(id);
            setMapZoom(2.2);
            setMapPan({ x: 0, y: 0 });
            setActiveTab("map");
          }}
          onPreviewMapOpen={() => {
            setMapZoom(2.2);
            setMapPan({ x: 0, y: 0 });
            setActiveTab("map");
          }}
          profiles={profiles}
          friends={friends}
        />
      )}
      {activeTab === "map" && (
        <MapTab
          selectedRegion={selectedRegion}
          onSelectRegion={setSelectedRegionId}
          onReplay={startRun}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
          operationalOverlay={operationalOverlay}
          onOperationalOverlayChange={setOperationalOverlay}
          mapZoom={mapZoom}
          onMapZoomChange={setMapZoom}
          mapPan={mapPan}
          onMapPanChange={setMapPan}
          countryLayer={countryLayer}
          onCountryLayerChange={setCountryLayer}
          regionalBoundaryLayer={regionalBoundaryLayer}
          onRegionalBoundaryLayerChange={setRegionalBoundaryLayer}
          touristAttractionsLayer={touristAttractionsLayer}
          onTouristAttractionsLayerChange={setTouristAttractionsLayer}
          transitSystemsLayer={transitSystemsLayer}
          onTransitSystemsLayerChange={setTransitSystemsLayer}
          onClearLayerSelection={() => {
            setSelectedRegionId(null);
            setSelectedAttractionId(null);
            setSelectedTransitSystemId(null);
            setTouristAttractionsLayer(false);
            setTransitSystemsLayer(false);
          }}
          selectedAttractionId={selectedAttractionId}
          selectedTransitSystemId={selectedTransitSystemId}
          onAttractionSelect={(attraction) => {
            setSelectedAttractionId(attraction.id);
            setSelectedRegionId(attraction.countryId);
            setTouristAttractionsLayer(true);
          }}
          onTransitSystemSelect={(system) => {
            setSelectedTransitSystemId(system.id);
            setSelectedRegionId(system.countryId);
            setTransitSystemsLayer(true);
            setMapZoom((zoom) => Math.max(zoom, 2.1));
          }}
          onPracticeRegion={(region, question, topics) => startCountryRun(region, question, topics)}
        />
      )}
      {activeTab === "review" && (
        <ReviewTab
          profile={profile}
          showAnswers={showReviewAnswers}
          onToggleAnswers={() => setShowReviewAnswers((value) => !value)}
          onReplay={startRun}
          onClear={() => setProfile({ ...profile, incorrectAnswers: [] })}
        />
      )}
      {activeTab === "profile" && (
        <ProfileTab
          profile={profile}
          profiles={profiles}
          friends={friends}
          accuracy={accuracy}
          onNameChange={updateProfileName}
          onEmojiChange={(emoji) => setProfile({ ...profile, emoji })}
          onGuestChange={setGuestMode}
          onReset={resetProfile}
          onCreateProfile={createLocalProfile}
          onSwitchProfile={switchLocalProfile}
          onDeleteProfile={deleteLocalProfile}
          onAddFriend={addFriend}
          onRemoveFriend={removeFriend}
        />
      )}
    </main>
  );
}

function playAnswerTone(correct: boolean) {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = correct ? "sine" : "triangle";
  oscillator.frequency.value = correct ? 740 : 220;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SettingsPanel({
  profile,
  profiles,
  friends,
  soundEnabled,
  onSoundChange,
  onClose,
  onOpenProfile,
  onResetProfile,
  onBuildMode,
}: {
  profile: PlayerProfile;
  profiles: PlayerProfile[];
  friends: LocalFriend[];
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onResetProfile: () => void;
  onBuildMode: (mode: "current" | "classic") => void;
}) {
  return (
    <aside className="settings-panel" aria-label="Settings">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h3>{profile.emoji} {profile.name || "Create username"}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close settings">×</button>
      </div>
      <label className="settings-toggle">
        <input type="checkbox" checked={soundEnabled} onChange={(event) => onSoundChange(event.target.checked)} />
        Sound effects
      </label>
      <div className="settings-actions">
        <button type="button" onClick={() => onBuildMode("current")}>Current Build</button>
        <button type="button" onClick={() => onBuildMode("classic")}>Classic Dashboard</button>
        <button type="button" onClick={onOpenProfile}>Change Profile</button>
        <button type="button" onClick={onResetProfile}>Log Out / Reset Local Profile</button>
      </div>
      <LocalLeaderboard profile={profile} profiles={profiles} friends={friends} />
    </aside>
  );
}

function leaderboardRows(profile: PlayerProfile, profiles: PlayerProfile[], friends: LocalFriend[]) {
  const sourceProfiles = profiles.length > 0 ? profiles : [profile];
  return [
    ...sourceProfiles.map((item) => ({
      id: item.id,
      name: item.name || "Unnamed operator",
      emoji: item.emoji ?? "🚇",
      score: item.highScore,
      accuracy: item.totalAnswered ? Math.round((item.totalCorrect / item.totalAnswered) * 100) : 100,
    })),
    ...friends.map((item) => ({
      id: item.id,
      name: item.name,
      emoji: item.emoji,
      score: item.highScore,
      accuracy: item.accuracy,
    })),
  ].sort((a, b) => b.score - a.score || b.accuracy - a.accuracy).slice(0, 5);
}

function LocalLeaderboard({ profile, profiles, friends }: { profile: PlayerProfile; profiles: PlayerProfile[]; friends: LocalFriend[] }) {
  const rows = leaderboardRows(profile, profiles, friends);
  return (
    <div className="settings-leaderboard local-leaderboard-widget">
      <h3>Local Leaderboard</h3>
      {rows.map((item, index) => (
        <div key={item.id} className="leaderboard-row">
          <span>{index + 1}</span>
          <strong>{item.emoji} {item.name}</strong>
          <em>{item.score} pts · {item.accuracy}%</em>
        </div>
      ))}
    </div>
  );
}

function StartHereMenu({
  open,
  onToggle,
  onAbout,
  onGuide,
  onSettings,
  onLesson,
}: {
  open: boolean;
  onToggle: () => void;
  onAbout: () => void;
  onGuide: () => void;
  onSettings: () => void;
  onLesson: () => void;
}) {
  return (
    <div className={`start-here-menu ${open ? "open" : ""}`}>
      <button className="start-here-launch" type="button" onClick={onToggle} aria-expanded={open} aria-label="Open start menu">
        <strong aria-hidden="true">🗺️</strong>
        <span>Start Here</span>
      </button>
      {open && (
        <div className="start-here-popover" role="menu" aria-label="Start here options">
          <button type="button" onClick={onAbout} role="menuitem">
            <strong>ℹ️ About This App</strong>
            <span>What GeoInTransit does and how profiles work</span>
          </button>
          <button type="button" onClick={onGuide} role="menuitem">
            <strong>❓ How to Use</strong>
            <span>Map, profiles, layers, and clean links</span>
          </button>
          <button type="button" onClick={onLesson} role="menuitem">
            <strong>💡 Daily Lesson</strong>
            <span>Transit topic, map clue, and memory hook</span>
          </button>
          <button type="button" onClick={onSettings} role="menuitem">
            <strong>⚙️ Settings</strong>
            <span>Settings, sound, profile, and practice options</span>
          </button>
        </div>
      )}
    </div>
  );
}

type DailyLesson = {
  title: string;
  summary: string;
  facts: string[];
  prompt: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dailyLessonQuestions(lesson: DailyLesson) {
  const region = regions.find((item) => item.name === lesson.title);
  if (!region) return [];
  return buildRegionPracticeQuestions(region, 12, "gateway", ["transport", "capitals", "geography", "landmarks", "tourist"]);
}

function downloadDailyLessonCsv(lesson: DailyLesson) {
  const rows = dailyLessonQuestions(lesson).map((question) => [
    question.prompt,
    question.answer,
    categoryLabels[question.category],
    difficultyLabels[question.difficulty],
    question.explanation,
  ]);
  const csv = [
    ["prompt", "answer", "category", "level", "explanation"],
    ...rows,
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${slugifyCountryName(lesson.title)}-daily-lesson-questions.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadDailyLessonReviewPage(lesson: DailyLesson) {
  const cards = dailyLessonQuestions(lesson);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(lesson.title)} GeoInTransit Daily Lesson</title><style>body{font-family:Arial,sans-serif;margin:28px;color:#111}h1{margin-bottom:6px}.facts{display:grid;gap:8px;margin:18px 0}.facts div,.card{border:1px solid #999;border-radius:10px;padding:12px;break-inside:avoid}.label{font-size:12px;text-transform:uppercase;color:#555;font-weight:700}.prompt{font-size:17px;font-weight:700}.answer{margin-top:8px}</style></head><body><h1>${escapeHtml(lesson.title)} Daily Lesson</h1><p>${escapeHtml(lesson.summary)}</p><div class="facts">${lesson.facts.map((fact, index) => `<div><span class="label">Fact ${index + 1}</span><p>${escapeHtml(fact)}</p></div>`).join("")}</div><h2>Review Questions</h2>${cards.map((question) => `<section class="card"><div class="label">${escapeHtml(categoryLabels[question.category])}</div><div class="prompt">${escapeHtml(question.prompt)}</div><div class="answer"><strong>Answer:</strong> ${escapeHtml(question.answer)}</div><p>${escapeHtml(question.explanation)}</p></section>`).join("")}</body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${slugifyCountryName(lesson.title)}-daily-lesson-review.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function DailyLessonPanel({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const localMidnightDay = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  const lessonIndex = localMidnightDay % dailyLessons.length;
  const lesson = dailyLessons[lessonIndex];
  const lessonImage = countryImagePathForName(lesson.title);
  const lessonRegion = regions.find((region) => region.name === lesson.title);
  return (
    <aside className="daily-lesson-panel" aria-label="Daily transit lesson">
      <div className="daily-lesson-heading">
        <div>
          <p className="eyebrow">Daily lesson</p>
          <h3>{lesson.title}</h3>
        </div>
        <button type="button" className="daily-lesson-close" onClick={onClose} aria-label="Close daily lesson">×</button>
      </div>
      <figure className="daily-lesson-hero">
        <img className="daily-lesson-image" src={lessonImage} alt={`${lesson.title} profile view`} />
        <figcaption>
          <span>{lessonRegion ? <FlagAsset code={lessonRegion.flag} label={`${lesson.title} flag`} /> : null} Today</span>
          <strong>{lesson.title}</strong>
        </figcaption>
      </figure>
      <p>{lesson.summary}</p>
      <div className="daily-lesson-actions" aria-label="Download daily lesson review files">
        <button type="button" onClick={() => downloadDailyLessonReviewPage(lesson)}>Download Review Page</button>
        <button type="button" onClick={() => downloadDailyLessonCsv(lesson)}>Download CSV</button>
      </div>
      <div className="lesson-card-grid">
        {lesson.facts.map((fact, index) => (
          <article key={fact}>
            <span>Fact {index + 1}</span>
            <strong>{fact}</strong>
          </article>
        ))}
        <article className="lesson-action-card">
          <span>Try this today</span>
          <strong>{lesson.prompt}</strong>
        </article>
      </div>
    </aside>
  );
}

const dailyLessons = [
  {
    title: "United States",
    summary: "A huge federal country where state geography and transit clues matter as much as national geography.",
    facts: ["50 states plus D.C.", "Grand Canyon and Yosemite are major landmark anchors", "New York's MTA subway is one of the world's busiest urban rail systems", "Brightline is a modern intercity rail clue in Florida", "Chicago, Washington, Atlanta, Boston, and Los Angeles all have strong metro map clues"],
    prompt: "Today, click the U.S., zoom into regions, and compare Florida, New York, California, Georgia, and D.C.",
  },
  {
    title: "Brazil",
    summary: "Brazil combines Amazon geography, Atlantic megacities, and major metro systems in Sao Paulo and Rio de Janeiro.",
    facts: ["Brasilia is the capital", "The Amazon is the dominant geography clue", "Sao Paulo has a major metro network", "Rio de Janeiro pairs coastal geography with urban rail", "Large airports and ports make Brazil a strong multimodal country"],
    prompt: "Look for Amazon, Atlantic coast, Sao Paulo, Rio, and Brasilia clues.",
  },
  {
    title: "United Kingdom",
    summary: "The UK is a rail-heavy country where London, regional rail, and historic regions create strong map clues.",
    facts: ["London is the capital", "The London Underground is a signature transit system", "The Elizabeth line links across Greater London", "Scotland, Wales, England, and Northern Ireland shape regional geography", "Yorkshire rail clues often point to northern England"],
    prompt: "Find the Tube clue, then compare London with northern rail regions.",
  },
  {
    title: "France",
    summary: "France is a classic rail geography lesson: Paris, regions, the TGV, and dense urban transit clues.",
    facts: ["Paris is the capital", "The Paris Metro and RER are key map clues", "TGV corridors link Paris with Lyon, Marseille, and beyond", "Ile-de-France is the core capital region", "CDG and Orly are major airport clues"],
    prompt: "Use Paris, TGV, RER, and Ile-de-France as today's anchors.",
  },
  {
    title: "Japan",
    summary: "Japan is perfect for station-order thinking: Shinkansen corridors, dense metros, and island regions.",
    facts: ["Tokyo is the capital", "Shinkansen means bullet train network", "Honshu carries the busiest high-speed rail spine", "Tokyo and Osaka have major metro systems", "Hokkaido, Kyushu, and Shikoku add island-region clues"],
    prompt: "Read the rail corridor order before answering the map question.",
  },
  {
    title: "Colombia",
    summary: "Colombia is a great example of transit adapting to terrain, especially Medellin's cable transit.",
    facts: ["Bogota is the capital", "Medellin MetroCable connects hillside comunas with the city", "The route toward Parque Arvi is a famous cable-car geography clue", "TransMilenio is Bogota's BRT system", "Andean terrain shapes transport corridors"],
    prompt: "Use terrain: valley, hillsides, cable cars, and BRT corridors.",
  },
  {
    title: "Peru",
    summary: "Peru combines Andes geography with one of the world's most memorable rail travel experiences.",
    facts: ["Lima is the capital", "Machu Picchu is reached through the Sacred Valley", "Aguas Calientes to Ollantaytambo is a famous scenic rail segment", "The Andes shape nearly every overland route", "Lima has metro and BRT-style urban transit clues"],
    prompt: "Think mountain rail: Aguas Calientes, Ollantaytambo, and Machu Picchu.",
  },
  {
    title: "Vietnam",
    summary: "Vietnam's north-south shape makes rail and street-level geography very memorable.",
    facts: ["Hanoi is the capital", "Ho Chi Minh City is the largest city", "Hanoi has famous train-street cafe imagery", "The north-south railway follows the long coastal country shape", "Hanoi Metro and urban rail clues are growing"],
    prompt: "Use the long coastline and train-street image as your memory hook.",
  },
  {
    title: "Mexico",
    summary: "Mexico mixes high-altitude capital geography, major metro systems, and strong regional identity.",
    facts: ["Mexico City is the capital", "The Mexico City Metro is one of the largest in the Americas", "Jalisco points to Guadalajara and SITEUR light rail", "The Yucatan and Baja peninsulas are strong map-shape clues", "MEX and CUN are major aviation clues"],
    prompt: "Zoom into regions and compare Mexico City, Jalisco, Baja California, and Yucatan.",
  },
  {
    title: "China",
    summary: "China is a high-speed rail and metro geography powerhouse with many huge urban systems.",
    facts: ["Beijing is the capital", "Shanghai, Guangzhou, Shenzhen, Chongqing, and Zhengzhou have major metro clues", "High-speed rail links many megacity corridors", "Airport and railway-station labels help decode dense maps", "Chinese labels are easier when paired with romanized station names and route icons"],
    prompt: "Use airport icons, high-speed railway stations, and city hubs before guessing.",
  },
  {
    title: "Australia",
    summary: "Australia is a continent-scale geography lesson with state capitals, coasts, and urban rail clues.",
    facts: ["Canberra is the capital", "Sydney has heavy rail, metro, light rail, and ferries", "Melbourne is famous for trams", "Western Australia points to Perth and Transperth", "The Outback and Great Barrier Reef are major geography anchors"],
    prompt: "Compare Sydney/New South Wales, Melbourne/Victoria, and Perth/Western Australia.",
  },
  {
    title: "Singapore",
    summary: "Singapore is compact, but its transit geography is exceptionally rich.",
    facts: ["Singapore is both city and country", "The MRT is the main rapid transit clue", "Changi Airport is a global aviation hub", "Jurong East, City Hall, and Dhoby Ghaut are useful interchange clues", "Its island shape makes map identification quick"],
    prompt: "Use Changi Airport and MRT interchanges as your anchor points.",
  },
  {
    title: "Thailand",
    summary: "Thailand combines Bangkok transit clues with strong tourism and coastal geography.",
    facts: ["Bangkok is the capital", "BTS and MRT are the main rapid transit clues", "Siam and Asok are useful interchange clues", "Phuket and Krabi are strong coastal tourism anchors", "Long-distance rail links Bangkok with northern and southern corridors"],
    prompt: "Read the Bangkok rail map by interchange first, then airport and river clues.",
  },
];

function GuideOverlay({ onClose }: { onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0);
  const guideSteps = [
    {
      title: "Read the Map",
      text: "Search or click a country. The map centers it, keeps borders crisp, and lets you zoom, drag, and cross the dateline smoothly.",
      visual: "map",
    },
    {
      title: "Toggle Layers",
      text: "Open or hide Map tools from the control panel. Switch on flags, transit networks, landmarks, and regional boundaries only when you need them so the map stays readable.",
      visual: "layers",
    },
    {
      title: "Open a Profile",
      text: "Profiles show the country image, flag, airports, transit, landmarks, nearby countries, regional assets, and reference links. Countries with region files reveal clickable subdivisions when zoomed in.",
      visual: "profile",
    },
    {
      title: "Explore GEONTRANSIT",
      text: "Use the expandable discovery cards by category: Countries, Regions, Rail, Airports, Islands, Mountains, Borders, Mega Cities, and Hidden Gems. Each card gives a visual hook, country chips, and profile jumps.",
      visual: "discover",
    },
    {
      title: "Use the Links",
      text: "Example: Hong Kong links open HKG Airport in Google Maps, MTR and Airport Express references, Star Ferry context, and Transitland network maps.",
      visual: "sidebar",
    },
    {
      title: "Play Questions",
      text: "Answer station, image, landmark, airport, capital, and regional-flag prompts across 15 levels.",
      visual: "start",
    },
    {
      title: "Answer Images",
      text: "Some questions use real transit maps, landmarks, and regional flags. Easier rounds may show Florida or Texas; harder rounds may show Eastern Cape, Italy, or Philippines province flags.",
      visual: "questions",
    },
    {
      title: "Daily Lesson",
      text: "Open Start Here for one daily country or region lesson with a profile image, five facts, and downloads.",
      visual: "lesson",
    },
    {
      title: "Review and Export",
      text: "Review misses, print flashcards, then export CSVs. Use Current, Selected, or All Countries; deselect the map when you do not want one-country context.",
      visual: "export",
    },
  ];

  const currentStep = guideSteps[activeStep];
  const nextStep = () => {
    if (activeStep >= guideSteps.length - 1) {
      onClose();
      return;
    }
    setActiveStep((step) => step + 1);
  };

  return (
    <div className="guide-backdrop" role="dialog" aria-modal="false" aria-label="GeoInTransit quick start">
      <section className="guide-panel">
        <div className="guide-heading">
          <div>
            <p className="eyebrow">Quick start</p>
            <h2>Quick Start</h2>
          </div>
          <div className="guide-close-actions">
            <button type="button" onClick={onClose}>Skip</button>
            <button type="button" className="guide-x" onClick={onClose} aria-label="Close instructions guide">×</button>
          </div>
        </div>
        <div className="guide-spotlight" key={currentStep.title}>
          <span>Step {activeStep + 1} of {guideSteps.length}</span>
          <h3>{currentStep.title}</h3>
          <p>{currentStep.text}</p>
          <GuideVisual type={currentStep.visual} />
          <div className="guide-step-actions">
            <button type="button" onClick={() => setActiveStep((step) => Math.max(0, step - 1))} disabled={activeStep === 0}>
              Previous
            </button>
            <button type="button" className="primary-action" onClick={nextStep}>
              {activeStep === guideSteps.length - 1 ? "Start Using App" : "Play Next"}
            </button>
          </div>
        </div>
        <div className="guide-card-grid" aria-label="Guide slide selector">
          {guideSteps.map((step, index) => (
            <article
              key={step.title}
              className={`guide-card ${index === activeStep ? "active" : ""}`}
              style={{ animationDelay: `${index * 90}ms` }}
              onClick={() => setActiveStep(index)}
            >
              <h3>{step.title}</h3>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function GuideVisual({ type }: { type: string }) {
  return (
    <div className={`guide-visual guide-visual-${type}`} aria-hidden="true">
      {type === "start" && (
        <>
          <div className="guide-browser-bar"><span /><span /><span /></div>
          <div className="guide-run-screen">
            <strong>Play: Start Run</strong>
            <span>15 levels</span>
            <span>Stations</span>
            <span>Images</span>
            <span>Landmarks</span>
            <em>Image prompts appear lightly</em>
          </div>
        </>
      )}
      {type === "map" && (
        <>
          <div className="guide-actual-map">
            <OperationsMap
              selectedId="hong-kong"
              onSelect={() => undefined}
              compact
              mapStyle="default"
              countryLayer
              regionalBoundaryLayer={false}
              operationalOverlay={false}
              touristAttractionsLayer={false}
              transitSystemsLayer={false}
              zoom={1.35}
              pan={{ x: 0, y: 0 }}
            />
          </div>
          <div className="guide-map-tools">
            <span>Centered country</span>
            <span>Crisp borders</span>
            <span>Smooth zoom</span>
          </div>
        </>
      )}
      {type === "layers" && (
        <>
          <div className="guide-layer-board">
            <div className="guide-basemaps">
              <strong>Base map</strong>
              <span>Default</span>
              <span>Aerial</span>
              <span>Topo</span>
            </div>
            <div className="guide-layer-switches">
              <span>Flags</span>
              <span>Transit</span>
              <span>Landmarks</span>
              <span>Regions</span>
            </div>
            <div className="guide-zoom-stack">
              <span>+</span>
              <span>Zoom</span>
              <span>-</span>
            </div>
          </div>
        </>
      )}
      {type === "regions" && (
        <div className="guide-region-demo">
          <div>
            <strong>Regional Boundaries</strong>
            <span>Florida</span>
            <span>Jalisco</span>
            <span>Western Cape</span>
            <span>Île-de-France</span>
          </div>
          <div>
            <strong>Click Panel</strong>
            <span>Region name</span>
            <span>Capital or hub</span>
            <span>Transit systems</span>
            <em>Boundaries only, no color clutter</em>
          </div>
        </div>
      )}
      {type === "discover" && (
        <div className="guide-discovery-demo">
          <div>
            <strong>Explore GEONTRANSIT</strong>
            <span>Countries</span>
            <span>Regions</span>
            <span>Rail</span>
            <span>Airports</span>
            <span>Islands</span>
            <span>Mountains</span>
            <span>Borders</span>
            <span>Mega Cities</span>
            <span>Hidden Gems</span>
          </div>
          <article>
            <img src="/images/ask/dubai-airport.png" alt="" />
            <em>Airports</em>
            <strong>Which countries became global transfer hubs?</strong>
            <p>Expand the card, compare country chips, then open the profile.</p>
          </article>
          <article>
            <img src="/images/ask/mountain-railway-reference.png" alt="" />
            <em>Mountains</em>
            <strong>Where does terrain shape rail?</strong>
            <p>Use the image first, then connect it to the geography facts.</p>
          </article>
          <article>
            <img src="/images/ask/cairo-megacity.png" alt="" />
            <em>Mega Cities</em>
            <strong>How do huge cities move?</strong>
            <p>Look for metros, airports, rivers, ring roads, and station hubs.</p>
          </article>
        </div>
      )}
      {type === "profile" && (
        <div className="guide-profile-screen">
          <div className="guide-hk-photo">
            <img src="/images/country-images/HongKong.png" alt="" />
          </div>
          <div className="guide-hk-panel">
            <span className="guide-flag"><FlagAsset code="HK" label="Hong Kong flag" /></span>
            <strong>Hong Kong</strong>
            <p>Airport, metro, ferries, landmarks, and map links in one tidy profile.</p>
            <div>
              <span>HKG Airport</span>
              <span>MTR</span>
              <span>Victoria Harbour</span>
              <span>Google Maps</span>
              <span>Wikipedia</span>
              <span>Transitland</span>
            </div>
          </div>
        </div>
      )}
      {type === "questions" && (
        <div className="guide-question-demo">
          <div className="guide-question-card">
            <span>Question 4/10</span>
            <strong>Which place, station, or landmark is shown?</strong>
            <div className="guide-photo-prompt">
              <span />
            </div>
          </div>
          <div className="guide-practice-card">
            <strong>Practice Deck</strong>
            <span>Country-specific questions</span>
            <span>Transit photos and maps</span>
            <span>Short hints after you answer</span>
          </div>
        </div>
      )}
      {type === "lesson" && (
        <div className="guide-lesson-demo">
          <div className="guide-lesson-photo">
            <img src="/images/country-images/Colombia.jpg" alt="" />
            <strong>Colombia</strong>
          </div>
          <span>Five quick facts</span>
          <span>One country or region per day</span>
          <span>Geography + transit + landmarks</span>
          <span>Download CSV or review page</span>
          <em>Refreshes after midnight.</em>
        </div>
      )}
      {type === "sidebar" && (
        <div className="guide-sidebar-demo">
          <div className="guide-mini-sidebar">
            <strong>Hong Kong</strong>
            <span><FlagAsset code="HK" label="Hong Kong flag" /> Flag profile</span>
            <span>HKG Airport → Google Maps</span>
            <span>MTR / Airport Express → Transitland</span>
            <span>Star Ferry → Wikipedia</span>
          </div>
          <div className="guide-link-detail">
            <span>Click an icon, country, or flag</span>
            <strong>Open the exact reference</strong>
            <p>Profiles keep airport, transit, ferry, landmark, and map references together.</p>
          </div>
        </div>
      )}
      {type === "review" && (
        <div className="guide-review-screen">
          <div>
            <strong>Review Tab</strong>
            <span>Missed question</span>
            <span>Memory trick expanded</span>
            <span>Replay prompt</span>
          </div>
          <div>
            <strong>Flashcards</strong>
            <span>Front: HKG</span>
            <span>Back: Hong Kong gateway</span>
            <em>Practice what matters</em>
          </div>
        </div>
      )}
      {type === "export" && (
        <div className="guide-export-screen">
          <div className="guide-profile-picker">
            <strong>Profile</strong>
            <span>Map</span>
            <span>Metro</span>
            <span>Air</span>
            <em>Save username</em>
          </div>
          <div className="guide-csv-card">
            <strong>CSV Export</strong>
            <span>Current, Selected, or All</span>
            <span>Airports + transit</span>
            <span>Selected countries combine</span>
            <em>Open in Sheets or Excel</em>
          </div>
        </div>
      )}
    </div>
  );
}

function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="about-panel" aria-label="About GeoInTransit">
      <div>
        <p className="eyebrow">About</p>
        <button type="button" onClick={onClose} aria-label="Close about panel">×</button>
      </div>
      <h2>GeoInTransit</h2>
      <p>
        GEONTRANSIT is an interactive, map-first platform for exploring the world through geography and transportation. Click a country, region, airport, landmark, or transit system to see images, flags, nearby places, and short learning prompts.
      </p>
    </aside>
  );
}

function buildQuestionHint(question: Question) {
  const regionNames = question.relatedRegionIds
    ?.map((id) => regions.find((region) => region.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const typeHint = question.category === "airports" || question.category === "airport-codes"
    ? "Think airport code, gateway city, or terminal geography."
    : question.category === "highways"
      ? "Think roads, bridges, tunnels, and regional traffic corridors."
      : question.category === "metro" || question.category === "rail"
        ? "Think stations, lines, interchanges, and passenger corridors."
        : question.category === "maritime"
        ? "Think ports, canals, straits, ferries, and river access."
        : question.category === "capitals" || question.category === "flags"
          ? "Use the visual design, capital context, and the answer choices together."
          : "Use the named place, country panel, and map location clues.";
  return `${typeHint}${regionNames ? " Narrow it by region, not by a giveaway label." : ""}`;
}

function PlayTab({
  run,
  profile,
  questionCount,
  onQuestionCountChange,
  selectedStartLevel,
  onStartLevelChange,
  onStart,
  onAnswer,
  onSkip,
  onExit,
  onNavigate,
  onPreviewRegionSelect,
  onPreviewMapOpen,
  profiles,
  friends,
}: {
  run: QuizRun | null;
  profile: PlayerProfile;
  questionCount: 10 | 15 | 20 | 150;
  onQuestionCountChange: (count: 10 | 15 | 20 | 150) => void;
  selectedStartLevel: DifficultyLevel;
  onStartLevelChange: (level: DifficultyLevel) => void;
  onStart: () => void;
  onAnswer: (answer: string) => void;
  onSkip: () => void;
  onExit: () => void;
  onNavigate: (delta: number) => void;
  onPreviewRegionSelect: (id: string) => void;
  onPreviewMapOpen: () => void;
  profiles: PlayerProfile[];
  friends: LocalFriend[];
}) {
  const [typedAnswer, setTypedAnswer] = useState("");
  const [lastQuestionId, setLastQuestionId] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });

  const question = run?.questions[run.index];

  useEffect(() => {
    if (question?.id !== lastQuestionId) {
      setTypedAnswer("");
      setShowHint(false);
      setLastQuestionId(question?.id ?? "");
    }
  }, [lastQuestionId, question?.id]);

  if (!run) {
    return (
      <section className="dashboard-grid">
        <div className="hero-panel">
          <p className="eyebrow">Run format</p>
          <h2>{questionCount === 150 ? "Level ladder" : `${questionCount} questions`}. Transit-first geography by level.</h2>
          <p>
            Start at {difficultyLabels[selectedStartLevel]}. Level ladder mode is split into 10-question blocks by difficulty,
            so Gateway stays approachable and each conquered level unlocks the next step toward the nearly impossible Outer Limits.
          </p>
          <div className="run-length-picker" aria-label="Question count">
            {[10, 15, 20, 150].map((count) => (
              <button
                key={count}
                className={questionCount === count ? "selected" : ""}
                onClick={() => onQuestionCountChange(count as 10 | 15 | 20 | 150)}
              >
                {count === 150 ? "Level Ladder" : count}
              </button>
            ))}
          </div>
          <div className="level-picker" aria-label="Starting level">
            {difficultyLevels.map((level, index) => (
              <button
                key={level}
                className={selectedStartLevel === level ? "selected" : ""}
                onClick={() => onStartLevelChange(level)}
              >
                <span>Level {index + 1}</span>
                {difficultyLabels[level]}
              </button>
            ))}
          </div>
          <button className="primary-action" onClick={onStart}>Start Arena Run</button>
        </div>
        <OperationsMap
          selectedId="united-states"
          onSelect={onPreviewRegionSelect}
          compact
          mapStyle="aerial"
          zoom={previewZoom}
          pan={previewPan}
          onPanChange={setPreviewPan}
          onZoomChange={setPreviewZoom}
          onBackgroundSelect={onPreviewMapOpen}
        />
      </section>
    );
  }

  if (!run.active) {
    return (
      <section className="dashboard-grid">
        <div className="hero-panel">
          <p className="eyebrow">Run complete</p>
          <h2>{run.score} points logged</h2>
          {run.newRecord && (
            <div className="record-banner">
              New record: previous {run.previousHighScore}, new {run.score}
            </div>
          )}
          <div className="answer-log">
            {run.answers.map((answer, index) => (
              <div key={answer.question.id} className={answer.correct ? "log-row correct" : "log-row missed"}>
                <span>{index + 1}</span>
                <strong>{answer.question.answer}</strong>
                <em>{answer.correct ? `+${answer.points}` : "saved to review"}</em>
              </div>
            ))}
          </div>
          <div className="run-length-picker" aria-label="Question count">
            {[10, 15, 20, 150].map((count) => (
              <button
                key={count}
                className={questionCount === count ? "selected" : ""}
                onClick={() => onQuestionCountChange(count as 10 | 15 | 20 | 150)}
              >
                {count === 150 ? "Level Ladder" : count}
              </button>
            ))}
          </div>
          <div className="completion-actions">
            <button className="primary-action" onClick={onStart}>Start New Run</button>
            <button type="button" onClick={onExit}>Exit Quiz</button>
          </div>
        </div>
        <RunTelemetry run={run} profile={profile} profiles={profiles} friends={friends} />
      </section>
    );
  }

  if (!question) return null;
  const currentAnswer = answerForQuestion(run, run.index);
  const previousAnswer = run.index > 0 ? answerForQuestion(run, run.index - 1) : undefined;
  const completedLevel = run.index > 0 && run.index % 10 === 0 ? run.questions[run.index - 1]?.difficulty : undefined;

  return (
    <section className="play-layout">
      <div className="question-panel">
        <div className="quiz-actions">
          <button type="button" onClick={() => onNavigate(-1)} disabled={run.index === 0}>Previous</button>
          <button type="button" onClick={() => onNavigate(1)} disabled={run.index >= run.questions.length - 1}>Next</button>
          <button type="button" onClick={onSkip} disabled={Boolean(currentAnswer)}>Skip For Now</button>
          <button type="button" onClick={onExit}>Exit Quiz</button>
        </div>
        {previousAnswer && !currentAnswer && (
          <div className={`feedback-banner ${previousAnswer.correct ? "correct" : "missed"}`}>
            {previousAnswer.correct ? "Correct." : "Not quite."} {previousAnswer.question.explanation}
          </div>
        )}
        {!currentAnswer && run.answers.length < run.index && (
          <div className="level-banner">
            This question is still open. Answer it now, skip for later, or use Previous/Next to move around the run.
          </div>
        )}
        {completedLevel && !currentAnswer && (
          <div className="level-banner">
            Congratulations. You conquered {difficultyLabels[completedLevel]}; the next 10-question block is queued.
          </div>
        )}
        <div className="question-topline">
          <span>Question {run.index + 1}/{run.questionCount ?? run.questions.length}</span>
          <span className={`difficulty-pill ${levelTone[question.difficulty]}`}>{difficultyLabels[question.difficulty]}</span>
          <span>{categoryLabels[question.category]}</span>
        </div>
        <h2>{question.prompt}</h2>
        {question.image && <QuestionVisual question={question} onAnswer={currentAnswer ? undefined : onAnswer} />}
        <div className="hint-row">
          <button type="button" onClick={() => setShowHint((value) => !value)}>{showHint ? "Hide Hint" : "Show Hint"}</button>
          {showHint && <p>{buildQuestionHint(question)}</p>}
        </div>
        {currentAnswer && (
          <div className={`feedback-banner ${currentAnswer.correct ? "correct" : "missed"}`}>
            <strong>{currentAnswer.correct ? "Correct" : currentAnswer.userAnswer ? "Missed" : "Skipped"}</strong>
            <span>Answer: {question.answer}</span>
            <p>{question.explanation}</p>
          </div>
        )}
        {!currentAnswer && question.inputType === "multiple-choice" && (
          <div className="choice-grid">
            {(question.choices ?? []).map((choice) => (
              <button key={choice} onClick={() => onAnswer(choice)}>{choice}</button>
            ))}
          </div>
        )}
        {!currentAnswer && question.inputType === "typed" && (
          <form
            className="typed-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAnswer(typedAnswer);
            }}
          >
            <input value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Enter answer or code" />
            <button className="primary-action" type="submit">Submit</button>
          </form>
        )}
        {!currentAnswer && question.inputType === "map-click" && !["station-map", "wmata-map"].includes(question.visualType ?? "") && <QuizMap onAnswer={onAnswer} />}
      </div>
      <RunTelemetry run={run} profile={profile} profiles={profiles} friends={friends} />
    </section>
  );
}

function RunTelemetry({ run, profile, profiles, friends }: { run: QuizRun; profile: PlayerProfile; profiles: PlayerProfile[]; friends: LocalFriend[] }) {
  return (
    <aside className="telemetry">
      <Metric label="Score" value={run.score.toString()} />
      <Metric label="Run Difficulty" value={difficultyLabels[run.difficulty]} />
      <Metric label="Correct Streak" value={run.correctStreak.toString()} />
      <Metric label="Miss Streak" value={run.missStreak.toString()} />
      <LocalLeaderboard profile={profile} profiles={profiles} friends={friends} />
      <div className="route-strip">
        {run.questions.map((question, index) => {
          const answer = answerForQuestion(run, index);
          return (
            <span
              key={question.id}
              className={answer ? (answer.correct ? "done" : "missed") : index === run.index ? "current" : ""}
              title={question.prompt}
            />
          );
        })}
      </div>
    </aside>
  );
}

function MapTab({
  selectedRegion,
  onSelectRegion,
  onReplay,
  mapStyle,
  onMapStyleChange,
  operationalOverlay,
  onOperationalOverlayChange,
  mapZoom,
  onMapZoomChange,
  mapPan,
  onMapPanChange,
  countryLayer,
  onCountryLayerChange,
  regionalBoundaryLayer,
  onRegionalBoundaryLayerChange,
  touristAttractionsLayer,
  onTouristAttractionsLayerChange,
  transitSystemsLayer,
  onTransitSystemsLayerChange,
  onClearLayerSelection,
  selectedAttractionId,
  selectedTransitSystemId,
  onAttractionSelect,
  onTransitSystemSelect,
  onPracticeRegion,
}: {
  selectedRegion: Region | null;
  onSelectRegion: (id: string | null) => void;
  onReplay: (question?: Question) => void;
  mapStyle: MapStyle;
  onMapStyleChange: (style: MapStyle) => void;
  operationalOverlay: boolean;
  onOperationalOverlayChange: (enabled: boolean) => void;
  mapZoom: number;
  onMapZoomChange: (zoom: number) => void;
  mapPan: { x: number; y: number };
  onMapPanChange: (pan: { x: number; y: number }) => void;
  countryLayer: boolean;
  onCountryLayerChange: (enabled: boolean) => void;
  regionalBoundaryLayer: boolean;
  onRegionalBoundaryLayerChange: (enabled: boolean) => void;
  touristAttractionsLayer: boolean;
  onTouristAttractionsLayerChange: (enabled: boolean) => void;
  transitSystemsLayer: boolean;
  onTransitSystemsLayerChange: (enabled: boolean) => void;
  onClearLayerSelection: () => void;
  selectedAttractionId: string | null;
  selectedTransitSystemId: string | null;
  onAttractionSelect: (attraction: (typeof projectedTouristAttractions)[number]) => void;
  onTransitSystemSelect: (system: (typeof projectedTransitSystems)[number]) => void;
  onPracticeRegion: (region: Region, question?: Question, topics?: PracticeTopic[]) => void;
}) {
  const sortedRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name));
  const [exportRegionIds, setExportRegionIds] = useState<string[]>([]);
  const [lastCsvExport, setLastCsvExport] = useState<CsvExport | null>(null);
  const [countrySearch, setCountrySearch] = useState(selectedRegion?.name ?? "");
  const [countrySearchFocused, setCountrySearchFocused] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mapControlsHidden, setMapControlsHidden] = useState(false);
  const [trackerExpanded, setTrackerExpanded] = useState(false);
  const [missingDataFilter, setMissingDataFilter] = useState<"all" | "population" | "capital" | "flag" | "image" | "transit">("all");
  const [regionCompletionRows, setRegionCompletionRows] = useState<RegionCompletionRow[]>([]);
  const selectedExportRegions = exportRegionIds
    .map((id) => regions.find((region) => region.id === id))
    .filter((region): region is Region => Boolean(region));
  useEffect(() => {
    return () => {
      if (lastCsvExport) URL.revokeObjectURL(lastCsvExport.objectUrl);
    };
  }, [lastCsvExport]);
  const zoomOut = () => onMapZoomChange(Math.max(1, Number((mapZoom - 0.4).toFixed(1))));
  const zoomIn = () => onMapZoomChange(Math.min(10, Number((mapZoom + 0.4).toFixed(1))));
  const panMap = (x: number, y: number) => {
    onMapPanChange({
      x: Math.max(-MAP_PAN_LIMIT_X, Math.min(MAP_PAN_LIMIT_X, mapPan.x + x)),
      y: Math.max(-MAP_PAN_LIMIT_Y, Math.min(MAP_PAN_LIMIT_Y, mapPan.y + y)),
    });
  };
  const selectRegionAndZoom = (id: string) => {
    const hasDetailedRegions = Boolean(gadmLevelOneFiles[id]);
    const nextZoom = Math.max(mapZoom, hasDetailedRegions ? 6 : 5.2);
    onSelectRegion(id);
    if (hasDetailedRegions) onRegionalBoundaryLayerChange(true);
    onMapZoomChange(nextZoom);
    onMapPanChange({ x: 0, y: 0 });
  };
  const selectedRegionId = selectedRegion?.id ?? "";
  const toggleExportRegion = (id: string) => {
    setExportRegionIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };
  const exportRegionsCsv = (exportRegions: Region[], fileName: string) => {
    const csvExport = createRegionsCsvExport(exportRegions, fileName);
    if (!csvExport) return;
    setLastCsvExport((previousExport) => {
      if (previousExport) URL.revokeObjectURL(previousExport.objectUrl);
      return csvExport;
    });
    window.setTimeout(() => triggerCsvDownload(csvExport), 0);
  };
  const activateCsvExport = (csvExport: CsvExport | null) => {
    if (!csvExport) return;
    setLastCsvExport((previousExport) => {
      if (previousExport) URL.revokeObjectURL(previousExport.objectUrl);
      return csvExport;
    });
    window.setTimeout(() => triggerCsvDownload(csvExport), 0);
  };
  const exportScopeIds = selectedExportRegions.length > 0
    ? selectedExportRegions.map((region) => region.id)
    : selectedRegion ? [selectedRegion.id] : [];
  const countrySearchQuery = countrySearch.trim().toLowerCase();
  const matchingCountries = countrySearchQuery
    ? sortedRegions
      .filter((region) => region.name.toLowerCase().startsWith(countrySearchQuery) || region.name.toLowerCase().includes(countrySearchQuery))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(countrySearchQuery) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(countrySearchQuery) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 5)
    : [];
  const matchingTransit = countrySearchQuery
    ? projectedTransitSystems
      .filter((system) => [system.name, system.city, system.region, system.type].some((value) => value.toLowerCase().includes(countrySearchQuery)))
      .slice(0, 4)
    : [];
  const matchingAttractions = countrySearchQuery
    ? projectedTouristAttractions
      .filter((attraction) => [attraction.name, attraction.country, attraction.kind].some((value) => value.toLowerCase().includes(countrySearchQuery)))
      .slice(0, 4)
    : [];
  const matchingCities = countrySearchQuery
    ? projectedCityLabels
      .filter((city) => city.name.toLowerCase().includes(countrySearchQuery))
      .slice(0, 4)
    : [];
  const matchingAirports = countrySearchQuery
    ? projectedAirportLabels
      .filter((airport) => [airport.code, airport.name, airport.city].some((value) => value.toLowerCase().includes(countrySearchQuery)))
      .slice(0, 5)
    : [];
  const matchingSubregions = countrySearchQuery
    ? regions
      .flatMap((region) => subregionsFor(region.id).map((name) => ({ name, region })))
      .filter((item) => item.name.toLowerCase().includes(countrySearchQuery))
      .slice(0, 6)
    : [];
  const searchResultCount = matchingCountries.length + matchingTransit.length + matchingAttractions.length + matchingCities.length + matchingAirports.length + matchingSubregions.length;
  const selectedRegionFileSlug = selectedRegion?.id ?? "country";
  const regionalLayerRegions = Object.keys(gadmLevelOneFiles)
    .map((regionId) => regions.find((region) => region.id === regionId))
    .filter((region): region is Region => Boolean(region))
    .sort((a, b) => a.name.localeCompare(b.name));
  const completedProfileCount = completedProfileRegions.length;
  const partialProfileCount = regions.filter((region) => {
    const completion = profileCompletionFor(region);
    return !completion.complete && [completion.hasCapital, completion.hasPopulation, completion.hasFlag, completion.hasImage].filter(Boolean).length >= 2;
  }).length;
  const minimalProfileCount = regions.length - completedProfileCount - partialProfileCount;
  const regionCompleteCount = regionCompletionRows.filter((row) => row.complete).length;
  const missingRegionRows = regionCompletionRows.filter((row) => !row.complete);
  const filteredRegionCompletionRows = regionCompletionRows.filter((row) => {
    if (missingDataFilter === "all") return !row.complete;
    if (missingDataFilter === "population") return !row.hasPopulation;
    if (missingDataFilter === "capital") return !row.hasCapital;
    if (missingDataFilter === "flag") return !row.hasFlag;
    if (missingDataFilter === "image") return !row.hasImage;
    return !row.hasTransit;
  });
  const visibleRegionCompletionRows = trackerExpanded ? filteredRegionCompletionRows : filteredRegionCompletionRows.slice(0, 12);

  useEffect(() => {
    setCountrySearch(selectedRegion?.name ?? "");
  }, [selectedRegion?.id, selectedRegion?.name]);

  useEffect(() => {
    setTrackerExpanded(false);
    setMissingDataFilter("all");
    if (!selectedRegion || !gadmLevelOneFiles[selectedRegion.id]) {
      setRegionCompletionRows([]);
      return;
    }
    let cancelled = false;
    loadGadmSubdivisions(selectedRegion.id).then((features) => {
      if (!cancelled) {
        setRegionCompletionRows(features.map((feature) => completionForSubdivision(feature, selectedRegion.id)));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRegion?.id]);

  const selectCountrySearchResult = (region: Region) => {
    setCountrySearch(region.name);
    setCountrySearchFocused(false);
    selectRegionAndZoom(region.id);
  };

  const selectTransitSearchResult = (system: (typeof projectedTransitSystems)[number]) => {
    const region = regions.find((item) => item.id === system.countryId);
    setCountrySearch(system.name);
    setCountrySearchFocused(false);
    onTransitSystemsLayerChange(true);
    onTransitSystemSelect(system);
    if (region) onSelectRegion(region.id);
    onMapZoomChange(Math.max(mapZoom, 5.4));
    onMapPanChange({ x: 0, y: 0 });
  };

  const selectAttractionSearchResult = (attraction: (typeof projectedTouristAttractions)[number]) => {
    setCountrySearch(attraction.name);
    setCountrySearchFocused(false);
    onTouristAttractionsLayerChange(true);
    onAttractionSelect(attraction);
    onSelectRegion(attraction.countryId);
    onMapZoomChange(Math.max(mapZoom, 5.4));
    onMapPanChange({ x: 0, y: 0 });
  };

  const selectCitySearchResult = (city: (typeof projectedCityLabels)[number]) => {
    const region = regions.find((item) => (
      item.capital.toLowerCase() === city.name.toLowerCase()
      || item.majorCities.some((place) => place.toLowerCase() === city.name.toLowerCase())
      || item.placesOfInterest.some((place) => place.toLowerCase().includes(city.name.toLowerCase()))
    ));
    setCountrySearch(city.name);
    setCountrySearchFocused(false);
    if (region) onSelectRegion(region.id);
    onMapZoomChange(Math.max(mapZoom, 5.6));
    onMapPanChange({ x: 0, y: 0 });
  };

  const selectAirportSearchResult = (airport: (typeof projectedAirportLabels)[number]) => {
    const region = regions.find((item) => item.id === airport.countryId);
    setCountrySearch(`${airport.code} · ${airport.city}`);
    setCountrySearchFocused(false);
    onTransitSystemsLayerChange(true);
    if (region) onSelectRegion(region.id);
    onMapZoomChange(Math.max(mapZoom, 5.6));
    onMapPanChange({ x: 0, y: 0 });
  };

  const selectSubregionSearchResult = (item: { name: string; region: Region }) => {
    setCountrySearch(item.name);
    setCountrySearchFocused(false);
    onRegionalBoundaryLayerChange(true);
    selectRegionAndZoom(item.region.id);
  };

  const updateCountrySearch = (value: string) => {
    setCountrySearch(value);
    if (!value.trim()) {
      onSelectRegion(null);
      return;
    }
    const exactMatch = sortedRegions.find((region) => region.name.toLowerCase() === value.trim().toLowerCase());
    if (exactMatch) {
      selectRegionAndZoom(exactMatch.id);
      setCountrySearchFocused(false);
    }
  };

  return (
    <section className={`map-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="map-column">
        <details className="map-toolbar compact-tool-panel">
          <summary>
            <span>Map tools</span>
            <em>layers</em>
          </summary>
          <div>
            <p className="eyebrow">Map</p>
            <strong>Search or click any place.</strong>
            <span>Profiles open beside the map with images, regions, transit, and nearby places.</span>
          </div>
          <label className="country-select country-combobox" htmlFor="country-search">
            Country
            <input
              id="country-search"
              type="search"
              value={countrySearch}
              placeholder="Search countries: ca, cam, au..."
              autoComplete="off"
              role="combobox"
              aria-expanded={countrySearchFocused && searchResultCount > 0}
              aria-controls="country-search-options"
              onFocus={() => setCountrySearchFocused(true)}
              onChange={(event) => updateCountrySearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matchingCountries[0]) {
                  event.preventDefault();
                  selectCountrySearchResult(matchingCountries[0]);
                }
                if (event.key === "Escape") setCountrySearchFocused(false);
              }}
            />
            {countrySearchFocused && searchResultCount > 0 ? (
              <div className="country-search-options" id="country-search-options" role="listbox">
                {matchingCountries.map((region) => (
                  <button
                    key={region.id}
                    type="button"
                    role="option"
                    aria-selected={region.id === selectedRegionId}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountrySearchResult(region)}
                  >
                    <FlagAsset code={region.flag} label={`${region.name} flag`} />
                    <span>{region.name}</span>
                  </button>
                ))}
                {matchingTransit.map((system) => (
                  <button key={system.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectTransitSearchResult(system)}>
                    <span className="search-result-icon">{transitIcon(system.kind)}</span>
                    <span>{system.name}<em>{system.city}</em></span>
                  </button>
                ))}
                {matchingAttractions.map((attraction) => (
                  <button key={attraction.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectAttractionSearchResult(attraction)}>
                    <span className="search-result-icon">{attractionIcon(attraction.kind)}</span>
                    <span>{attraction.name}<em>{attraction.country}</em></span>
                  </button>
                ))}
                {matchingCities.map((city) => (
                  <button key={city.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCitySearchResult(city)}>
                    <span className="search-result-icon">◎</span>
                    <span>{city.name}<em>city</em></span>
                  </button>
                ))}
                {matchingAirports.map((airport) => (
                  <button key={airport.code} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectAirportSearchResult(airport)}>
                    <span className="search-result-icon">✈</span>
                    <span>{airport.code}<em>{airport.city} · {airport.name}</em></span>
                  </button>
                ))}
                {matchingSubregions.map((item) => (
                  <button key={`${item.region.id}-${item.name}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => selectSubregionSearchResult(item)}>
                    <span className="search-result-icon">▧</span>
                    <span>{item.name}<em>{item.region.name} region</em></span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>
          <button type="button" onClick={() => onSelectRegion(null)} disabled={!selectedRegion}>
            Deselect Region
          </button>
          <label className={`overlay-toggle ${countryLayer ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={countryLayer}
              onChange={(event) => onCountryLayerChange(event.target.checked)}
            />
            Country flags
          </label>
          <label className={`overlay-toggle boundary-toggle ${regionalBoundaryLayer ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={regionalBoundaryLayer}
              onChange={(event) => onRegionalBoundaryLayerChange(event.target.checked)}
            />
            Regional boundaries
          </label>
          <details className="region-availability-note">
            <summary>
              <span>Advanced</span>
              <em>{completedProfileCount}/{regions.length} complete profiles</em>
            </summary>
            <p>Choose a regional layer and check which profiles have capitals, population, flags, and images.</p>
            <div className="country-completeness-dashboard">
              <span><strong>Countries</strong>{regions.length}</span>
              <span><strong>Fully complete</strong>{completedProfileCount}</span>
              <span><strong>Partially complete</strong>{partialProfileCount}</span>
              <span><strong>Minimal data</strong>{minimalProfileCount}</span>
            </div>
            <select
              id="regional-layer-country"
              value={selectedRegionId}
              onChange={(event) => event.target.value && selectRegionAndZoom(event.target.value)}
              aria-label="Select a country with regional boundaries"
            >
              <option value="">Choose a country...</option>
              {regionalLayerRegions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}</option>
              ))}
            </select>
            {selectedRegion && regionCompletionRows.length > 0 ? (
              <div className="regional-completion-tracker" aria-live="polite">
                <div className="tracker-head">
                  <div>
                    <strong>{selectedRegion.name}</strong>
                    <span>{regionCompleteCount}/{regionCompletionRows.length} regions complete</span>
                  </div>
                  <em>{missingRegionRows.length ? `${missingRegionRows.length} missing` : "All complete"}</em>
                </div>
                {missingRegionRows.length > 0 ? (
                  <p className="tracker-missing">Missing: {missingRegionRows.slice(0, 7).map((row) => row.name).join(", ")}{missingRegionRows.length > 7 ? "..." : ""}</p>
                ) : null}
                <div className="missing-data-filters" aria-label="Filter regions by missing field">
                  {([
                    ["all", "All missing"],
                    ["population", "Population"],
                    ["capital", "Capital"],
                    ["flag", "Flag"],
                    ["image", "Image"],
                    ["transit", "Transit"],
                  ] as const).map(([value, label]) => {
                    const count = regionCompletionRows.filter((row) => value === "all" ? !row.complete : !row[`has${value[0].toUpperCase()}${value.slice(1)}` as keyof RegionCompletionRow]).length;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={missingDataFilter === value ? "selected" : ""}
                        aria-pressed={missingDataFilter === value}
                        onClick={() => { setMissingDataFilter(value); setTrackerExpanded(false); }}
                      >
                        {label} <span>{count}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="tracker-filter-summary">
                  Showing {filteredRegionCompletionRows.length} region{filteredRegionCompletionRows.length === 1 ? "" : "s"} missing {missingDataFilter === "all" ? "one or more required fields" : missingDataFilter}.
                </p>
                <div className="tracker-region-list">
                  {visibleRegionCompletionRows.map((row) => (
                    <div key={row.code} className={row.complete ? "complete" : "partial"}>
                      <strong>{row.complete ? "✓" : "✗"} {row.name}</strong>
                      <span title="Population">{row.hasPopulation ? "Population ✓" : "Population ✗"}</span>
                      <span title="Flag or coat of arms">{row.hasFlag ? "Flag ✓" : "Flag ✗"}</span>
                      <span title="Capital">{row.hasCapital ? "Capital ✓" : "Capital ✗"}</span>
                      <span title="Image">{row.hasImage ? "Image ✓" : "Image ✗"}</span>
                      <span title="Transit where applicable">{row.hasTransit ? "Transit ✓" : "Transit - optional"}</span>
                    </div>
                  ))}
                </div>
                {filteredRegionCompletionRows.length > visibleRegionCompletionRows.length ? (
                  <button type="button" className="tracker-toggle" onClick={() => setTrackerExpanded(true)}>
                    Show all regions
                  </button>
                ) : trackerExpanded && filteredRegionCompletionRows.length > 12 ? (
                  <button type="button" className="tracker-toggle" onClick={() => setTrackerExpanded(false)}>
                    Show fewer
                  </button>
                ) : null}
              </div>
            ) : selectedRegion && gadmLevelOneFiles[selectedRegion.id] ? (
              <div className="regional-completion-tracker loading">Loading regions...</div>
            ) : null}
          </details>
          <label className={`overlay-toggle ${operationalOverlay ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={operationalOverlay}
              onChange={(event) => onOperationalOverlayChange(event.target.checked)}
            />
            Operational overlay
          </label>
          <label className={`overlay-toggle attractions-toggle ${touristAttractionsLayer ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={touristAttractionsLayer}
              onChange={(event) => onTouristAttractionsLayerChange(event.target.checked)}
            />
            Tourist attractions
          </label>
          <label className={`overlay-toggle transit-toggle ${transitSystemsLayer ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={transitSystemsLayer}
              onChange={(event) => onTransitSystemsLayerChange(event.target.checked)}
            />
            Transit networks
          </label>
          <button type="button" className="clear-layer-button" onClick={onClearLayerSelection}>
            Clear Selection
          </button>
          <div className="style-switcher" aria-label="Map style">
            {([
              ["default", "Default"],
              ["aerial", "Aerial"],
              ["light", "Light Grey"],
              ["dark", "Dark Grey"],
              ["topographic", "Topo"],
            ] as Array<[MapStyle, string]>).map(([style, label]) => (
              <button key={style} className={mapStyle === style ? "selected" : ""} onClick={() => onMapStyleChange(style)}>
                {label}
              </button>
            ))}
          </div>
        </details>
        <div className={`map-frame ${mapControlsHidden ? "map-controls-hidden" : ""}`}>
          <button
            type="button"
            className="map-control-visibility"
            aria-pressed={mapControlsHidden}
            onClick={() => setMapControlsHidden((hidden) => !hidden)}
          >
            {mapControlsHidden ? "Show controls" : "Hide controls"}
          </button>
          <OperationsMap
            selectedId={selectedRegionId}
            onSelect={selectRegionAndZoom}
            mapStyle={mapStyle}
            countryLayer={countryLayer}
            regionalBoundaryLayer={regionalBoundaryLayer}
            operationalOverlay={operationalOverlay}
            touristAttractionsLayer={touristAttractionsLayer}
            selectedAttractionId={selectedAttractionId}
            onAttractionSelect={onAttractionSelect}
            transitSystemsLayer={transitSystemsLayer}
            selectedTransitSystemId={selectedTransitSystemId}
            onTransitSystemSelect={onTransitSystemSelect}
            zoom={mapZoom}
            pan={mapPan}
            onPanChange={onMapPanChange}
            onZoomChange={onMapZoomChange}
          />
          <div className="map-zoom-overlay" aria-label="Map zoom controls">
            <button onClick={zoomIn} aria-label="Zoom in">+</button>
            <button onClick={zoomOut} aria-label="Zoom out">-</button>
          </div>
          <div className="map-pan-overlay" aria-label="Map pan controls">
            <button type="button" className="pan-up-button" onClick={() => panMap(0, 90)} aria-label="Move map north">↑</button>
            <button type="button" className="pan-left-button" onClick={() => panMap(120, 0)} aria-label="Move map west">←</button>
            <button type="button" className="pan-center-button" onClick={() => onMapPanChange({ x: 0, y: 0 })} aria-label="Center selected country">⌖</button>
            <button type="button" className="pan-right-button" onClick={() => panMap(-120, 0)} aria-label="Move map east">→</button>
            <button type="button" className="pan-down-button" onClick={() => panMap(0, -90)} aria-label="Move map south">↓</button>
          </div>
        </div>
        <p className={`map-drag-hint ${mapControlsHidden ? "visually-muted" : ""}`}>Drag the map to move across regions.</p>
        <div className={`map-movement-legend ${mapControlsHidden ? "visually-muted" : ""}`} aria-label="Map movement and layer legend">
          <span><strong>Pan</strong> drag the map</span>
          <span><strong>Zoom</strong> wheel, pinch, or +/- to 1000%</span>
          <span><strong>Labels</strong> city names appear at deep zoom</span>
          <span><strong>Regions</strong> detailed subdivisions appear at 480%+</span>
          <span><strong>Transit</strong> toggle network pins in Map tools</span>
        </div>
        <AskGeoInTransitPanel currentRegion={selectedRegion} onSelectRegion={selectRegionAndZoom} />
        <details className="export-panel compact-tool-panel">
          <summary>
            <span>Export data</span>
            <em>country, transit, attractions</em>
          </summary>
          <div>
            <p className="eyebrow">Excel export</p>
            <strong>Download clean CSV layers</strong>
            <span>Use current country, selected countries, or all countries. Transit exports include Transitland/Wikipedia links; attraction exports include Wikipedia links.</span>
          </div>
          <div className="export-actions">
            <button type="button" onClick={() => selectedRegion && exportRegionsCsv([selectedRegion], `${selectedRegionFileSlug}.csv`)} disabled={!selectedRegion}>
              Current Country
            </button>
            <button type="button" onClick={() => exportRegionsCsv(selectedExportRegions, "geontransit-countries.csv")} disabled={selectedExportRegions.length === 0}>
              Selected ({selectedExportRegions.length})
            </button>
            <button type="button" onClick={() => exportRegionsCsv(sortedRegions, "geontransit-all-countries.csv")}>
              All Countries
            </button>
            <button type="button" onClick={() => activateCsvExport(createTransitCsvExport(exportScopeIds, exportScopeIds.length ? "geontransit-transit-selected.csv" : "geontransit-transit-all.csv"))}>
              Transit CSV
            </button>
            <button type="button" onClick={() => activateCsvExport(createAttractionsCsvExport(exportScopeIds, exportScopeIds.length ? "geontransit-attractions-selected.csv" : "geontransit-attractions-all.csv"))}>
              Attractions CSV
            </button>
            <button type="button" onClick={() => setExportRegionIds([])} disabled={exportRegionIds.length === 0}>
              Clear
            </button>
          </div>
          <div className="export-selector" aria-label="Select countries to export">
            {sortedRegions.slice(0, 18).map((region) => (
              <button
                key={region.id}
                type="button"
                className={exportRegionIds.includes(region.id) ? "selected" : ""}
                onClick={() => toggleExportRegion(region.id)}
              >
                {flagEmoji(region.flag)} {region.name}
              </button>
            ))}
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) toggleExportRegion(event.target.value);
                event.currentTarget.value = "";
              }}
              aria-label="Add another country to export"
            >
              <option value="">Add another country...</option>
              {sortedRegions.map((region) => (
                <option key={region.id} value={region.id}>
                  {flagEmoji(region.flag)} {region.name}
                </option>
              ))}
            </select>
          </div>
          {lastCsvExport ? (
            <div className="csv-ready" role="status" aria-live="polite">
              <div>
                <strong>{lastCsvExport.fileName}</strong>
                <span>{lastCsvExport.rowCount} rows ready. If your browser blocks downloads, use the fallback below.</span>
              </div>
              <div className="csv-ready-actions">
                <a href={lastCsvExport.objectUrl} download={lastCsvExport.fileName}>
                  Download CSV
                </a>
                <button type="button" onClick={() => navigator.clipboard?.writeText(lastCsvExport.csv)}>
                  Copy CSV
                </button>
              </div>
              <textarea readOnly value={lastCsvExport.csv} aria-label="Generated CSV export" />
            </div>
          ) : null}
        </details>
      </div>
      <div className="map-sidebar-shell">
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          aria-expanded={!sidebarCollapsed}
        >
          {sidebarCollapsed ? "Open profile" : "×"}
        </button>
        {!sidebarCollapsed && (selectedRegion ? (
          <RegionPanel
            region={selectedRegion}
            selectedAttractionId={selectedAttractionId}
            onAttractionSelect={(attractionId) => {
              const attraction = projectedTouristAttractions.find((item) => item.id === attractionId);
              if (attraction) onAttractionSelect(attraction);
            }}
            selectedTransitSystemId={selectedTransitSystemId}
            onTransitSystemSelect={(systemId) => {
              const system = projectedTransitSystems.find((item) => item.id === systemId);
              if (system) onTransitSystemSelect(system);
            }}
            onSelectNearby={selectRegionAndZoom}
            onPracticeRegion={onPracticeRegion}
            onReplay={onReplay}
          />
        ) : <EmptyRegionPanel />)}
      </div>
    </section>
  );
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function listCell(items: string[]) {
  return items.filter(Boolean).join("; ");
}

function createRegionsCsvExport(exportRegions: Region[], fileName: string): CsvExport | null {
  if (exportRegions.length === 0) return null;
  const headers = [
    "id",
    "country_or_region",
    "flag_code",
    "flag_emoji",
    "flag_svg_path",
    "capital",
    "population",
    "major_cities",
    "airports",
    "rail",
    "metro",
    "highways",
    "maritime",
    "landmarks",
    "rivers_and_mountains",
    "places_of_interest",
    "fun_facts",
    "states_provinces_regions",
    "transit_references",
    "sample_question_ids",
  ];
  const rows = exportRegions.map((region) => [
    region.id,
    region.name,
    region.flag,
    flagEmoji(region.flag),
    flagImageSrc(region.flag),
    region.capital,
    region.population,
    listCell(region.majorCities),
    listCell(region.airports),
    listCell(region.rail),
    listCell(region.metro),
    listCell(region.highways),
    listCell(region.maritime),
    listCell(region.landmarks),
    listCell(region.riversMountains),
    listCell(region.placesOfInterest),
    listCell(region.funFacts),
    listCell(subregionsFor(region.id)),
    listCell(region.transitReferences.map((reference) => `${reference.title}: ${reference.summary}`)),
    listCell(region.sampleQuestionIds),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  return {
    csv,
    fileName,
    objectUrl: URL.createObjectURL(blob),
    rowCount: exportRegions.length,
  };
}

function createRowsCsvExport(headers: string[], rows: Array<Array<string | number>>, fileName: string): CsvExport | null {
  if (rows.length === 0) return null;
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  return {
    csv,
    fileName,
    objectUrl: URL.createObjectURL(blob),
    rowCount: rows.length,
  };
}

function createTransitCsvExport(regionIds: string[], fileName: string) {
  const selectedIds = new Set(regionIds);
  const systems = projectedTransitSystems.filter((system) => selectedIds.size === 0 || selectedIds.has(system.countryId));
  return createRowsCsvExport(
    ["id", "country", "country_id", "name", "city", "region", "type", "kind", "longitude", "latitude", "transitland_map", "wikipedia_reference", "key_nodes", "quiz_focus"],
    systems.map((system) => [
      system.id,
      regions.find((region) => region.id === system.countryId)?.name ?? system.countryId,
      system.countryId,
      system.name,
      system.city,
      system.region,
      system.type,
      system.kind,
      system.coordinate[0],
      system.coordinate[1],
      system.mapUrl,
      system.sourceUrl,
      listCell(system.keyNodes),
      system.quizFocus,
    ]),
    fileName,
  );
}

function createAttractionsCsvExport(regionIds: string[], fileName: string) {
  const selectedIds = new Set(regionIds);
  const attractions = projectedTouristAttractions.filter((attraction) => selectedIds.size === 0 || selectedIds.has(attraction.countryId));
  return createRowsCsvExport(
    ["id", "country", "country_id", "name", "kind", "longitude", "latitude", "wikipedia_reference"],
    attractions.map((attraction) => [
      attraction.id,
      attraction.country,
      attraction.countryId,
      attraction.name,
      attraction.kind,
      attraction.coordinate[0],
      attraction.coordinate[1],
      attraction.url,
    ]),
    fileName,
  );
}

function practiceFlashcardsForRegion(region: Region, topics: PracticeTopic[], difficulty: DifficultyLevel) {
  return buildRegionPracticeQuestions(region, 12, difficulty, topics).map((question) => ({
    front: question.prompt,
    back: `${question.answer}. ${question.explanation}`,
    category: categoryLabels[question.category],
  }));
}

function flashcardReviewHtml(title: string, subtitle: string, cards: Array<{ front: string; back: string; category: string }>) {
  const renderedCards = cards.map((card, index) => `
    <button class="flip-card${index === 0 ? " active" : ""}" type="button" aria-label="Flip card ${index + 1}">
      <span class="flip-card-inner">
        <span class="face front-face">
          <span class="label">${escapeHtml(card.category)}</span>
          <strong>${escapeHtml(card.front)}</strong>
          <small>Click to reveal</small>
        </span>
        <span class="face back-face">
          <span class="label">Answer</span>
          <strong>${escapeHtml(card.back)}</strong>
          <small>Click to return</small>
        </span>
      </span>
    </button>
  `).join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; font-family: Inter, Arial, sans-serif; background: #061118; color: #e9f3f5; }
    header { max-width: 980px; margin: 0 auto 22px; }
    h1 { margin: 0 0 6px; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1; }
    p { margin: 0; color: #b7c9ce; max-width: 760px; line-height: 1.5; }
    .toolbar { max-width: 680px; margin: 0 auto 18px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .toolbar button { border: 1px solid rgba(122, 241, 214, 0.35); border-radius: 999px; padding: 0.65rem 0.9rem; background: #10262d; color: #e9f3f5; font-weight: 800; cursor: pointer; }
    .progress { margin-left: auto; color: #b7c9ce; font-weight: 900; }
    .deck { max-width: 680px; margin: 0 auto; }
    .flip-card { display: none; width: 100%; height: min(58vh, 360px); min-height: 260px; padding: 0; border: 0; background: transparent; perspective: 1100px; cursor: pointer; text-align: left; color: inherit; }
    .flip-card.active { display: block; }
    .flip-card-inner { position: relative; display: block; width: 100%; height: 100%; transition: transform 0.45s ease; transform-style: preserve-3d; }
    .flip-card.flipped .flip-card-inner { transform: rotateY(180deg); }
    .face { position: absolute; inset: 0; display: grid; align-content: center; gap: 12px; padding: 18px; border: 1px solid rgba(122, 241, 214, 0.22); border-radius: 18px; backface-visibility: hidden; box-shadow: 0 18px 38px rgba(0, 0, 0, 0.32); }
    .front-face { background: linear-gradient(145deg, #0b1e25, #153039); }
    .back-face { transform: rotateY(180deg); background: linear-gradient(145deg, #163427, #2f3518); }
    .label { color: #7af1d6; font-size: 0.72rem; font-weight: 950; letter-spacing: 0.08em; text-transform: uppercase; }
    strong { font-size: 1.08rem; line-height: 1.28; }
    small { color: #a9bec4; font-weight: 800; }
    @media (max-width: 620px) { body { padding: 18px; } .flip-card { height: 320px; } .progress { width: 100%; margin-left: 0; } }
    @media print { body { background: white; color: black; } .toolbar { display: none; } .deck { display: block; } .flip-card { height: auto; margin: 12px 0; page-break-inside: avoid; } .flip-card-inner, .flip-card.flipped .flip-card-inner { transform: none; } .face { position: static; box-shadow: none; background: white; color: black; border-color: #999; } .back-face { transform: none; margin-top: 8px; } small { display: none; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(subtitle)}</p>
  </header>
  <nav class="toolbar" aria-label="Flashcard controls">
    <button type="button" onclick="previousCard()">Previous</button>
    <button type="button" onclick="nextCard()">Next</button>
    <button type="button" onclick="setAnswer(true)">Show answer</button>
    <button type="button" onclick="setAnswer(false)">Show prompt</button>
    <span class="progress" id="card-progress"></span>
  </nav>
  <main class="deck">${renderedCards}</main>
  <script>
    const cards = Array.from(document.querySelectorAll('.flip-card'));
    let activeIndex = 0;
    function updateCard() {
      cards.forEach((card, index) => card.classList.toggle('active', index === activeIndex));
      const progress = document.getElementById('card-progress');
      if (progress) progress.textContent = cards.length ? (activeIndex + 1) + ' / ' + cards.length : '0 / 0';
    }
    function nextCard() {
      if (!cards.length) return;
      activeIndex = (activeIndex + 1) % cards.length;
      updateCard();
    }
    function previousCard() {
      if (!cards.length) return;
      activeIndex = (activeIndex - 1 + cards.length) % cards.length;
      updateCard();
    }
    function setAnswer(showAnswer) {
      cards[activeIndex]?.classList.toggle('flipped', showAnswer);
    }
    cards.forEach((card) => {
      card.addEventListener('click', () => card.classList.toggle('flipped'));
    });
    updateCard();
  </script>
</body>
</html>`;
}

function downloadPracticeFlashcards(region: Region, topics: PracticeTopic[], difficulty: DifficultyLevel) {
  const cards = practiceFlashcardsForRegion(region, topics, difficulty);
  const html = flashcardReviewHtml(`${region.name} Practice Flashcards`, "Click each card to flip between the prompt and answer. Use these as quick review cards or print them when needed.", cards);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${region.id}-practice-flashcards.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadReviewFlashcards(profile: PlayerProfile) {
  if (profile.incorrectAnswers.length === 0) return;
  const cards = profile.incorrectAnswers.map((item) => ({
    front: item.question.prompt,
    back: `${item.question.answer}. ${item.question.explanation}`,
    category: categoryLabels[item.question.category],
  }));
  const html = flashcardReviewHtml("Review Flashcards", "Made from saved missed questions. Click each card to flip between the prompt and answer.", cards);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "geontransit-review-flashcards.html";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function triggerCsvDownload(csvExport: CsvExport) {
  const anchor = document.createElement("a");
  anchor.href = csvExport.objectUrl;
  anchor.download = csvExport.fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
  }
}

function OperationsMap({
  selectedId,
  onSelect,
  compact = false,
  mapStyle = "default",
  countryLayer = true,
  regionalBoundaryLayer = false,
  operationalOverlay = false,
  touristAttractionsLayer = false,
  selectedAttractionId = null,
  onAttractionSelect,
  transitSystemsLayer = false,
  selectedTransitSystemId = null,
  onTransitSystemSelect,
  onBackgroundSelect,
  zoom = 1,
  pan = { x: 0, y: 0 },
  onPanChange,
  onZoomChange,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  mapStyle?: MapStyle;
  countryLayer?: boolean;
  regionalBoundaryLayer?: boolean;
  operationalOverlay?: boolean;
  touristAttractionsLayer?: boolean;
  selectedAttractionId?: string | null;
  onAttractionSelect?: (attraction: (typeof projectedTouristAttractions)[number]) => void;
  transitSystemsLayer?: boolean;
  selectedTransitSystemId?: string | null;
  onTransitSystemSelect?: (system: (typeof projectedTransitSystems)[number]) => void;
  onBackgroundSelect?: () => void;
  zoom?: number;
  pan?: { x: number; y: number };
  onPanChange?: (pan: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
}) {
  const [dragStart, setDragStart] = useState<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [activePointers, setActivePointers] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [pinchStart, setPinchStart] = useState<{ distance: number; zoom: number } | null>(null);
  const [gadmSubdivisions, setGadmSubdivisions] = useState<GadmSubdivisionFeature[]>([]);
  const [selectedSubdivision, setSelectedSubdivision] = useState<GadmSubdivisionFeature | null>(null);
  const selectedRegion = selectedId ? regions.find((region) => region.id === selectedId) : undefined;
  const selectedPosition = selectedRegion ? mapPositionForRegion(selectedRegion) : { x: 50, y: 50 };
  const originX = selectedPosition.x;
  const originY = selectedPosition.y;
  const supportsGadmRegions = Boolean(selectedId && gadmLevelOneFiles[selectedId]);
  const showRegionalBoundaries = regionalBoundaryLayer && supportsGadmRegions && zoom >= 4.8;
  const dcSubdivision = selectedId === "united-states"
    ? gadmSubdivisions.find((feature) => subdivisionCode(feature) === "US-DC")
    : undefined;
  const dcProjected = worldProjection([-77.0369, 38.9072]);
  const subdivisionJumpOptions = gadmSubdivisions
    .map((feature) => ({ feature, name: subdivisionName(feature), code: subdivisionCode(feature) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    setSelectedSubdivision(null);
    setGadmSubdivisions([]);
  }, [selectedId]);

  useEffect(() => {
    if (!regionalBoundaryLayer || !selectedId || !supportsGadmRegions || zoom < 4.5) return;
    let cancelled = false;
    loadGadmSubdivisions(selectedId).then((features) => {
      if (!cancelled) setGadmSubdivisions(features);
    });
    return () => {
      cancelled = true;
    };
  }, [regionalBoundaryLayer, selectedId, supportsGadmRegions, zoom]);

  return (
    <div
      className={`map-stage ${compact ? "compact" : ""} map-style-${mapStyle} ${countryLayer ? "countries-on" : "countries-off"} ${touristAttractionsLayer && !countryLayer ? "attractions-solo" : ""} ${regionalBoundaryLayer ? "regional-boundaries-requested" : ""} ${showRegionalBoundaries ? "regional-boundaries-on" : "regional-boundaries-off"} ${operationalOverlay ? "ops-on" : "ops-off"} ${zoom >= 2.5 ? "attraction-labels-on" : "attraction-labels-off"} ${zoom >= 2.2 ? "transit-labels-on" : "transit-labels-off"} ${zoom >= 4 ? "city-labels-on" : "city-labels-off"} ${zoom >= 5 ? "deep-zoom" : ""} ${dragStart ? "dragging" : ""}`}
      onPointerDown={(event) => {
        if (!onPanChange) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button, select, input, a, .territory-cell")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setActivePointers((pointers) => {
          const nextPointers = [...pointers.filter((pointer) => pointer.id !== event.pointerId), { id: event.pointerId, x: event.clientX, y: event.clientY }].slice(-2);
          if (nextPointers.length === 2) {
            const [first, second] = nextPointers;
            setPinchStart({ distance: Math.hypot(second.x - first.x, second.y - first.y), zoom });
            setDragStart(null);
          } else {
            setDragStart({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
          }
          return nextPointers;
        });
      }}
      onPointerMove={(event) => {
        const nextPointers = activePointers.map((pointer) => (
          pointer.id === event.pointerId ? { ...pointer, x: event.clientX, y: event.clientY } : pointer
        ));
        if (nextPointers.length === 2 && pinchStart && onZoomChange) {
          const [first, second] = nextPointers;
          const distance = Math.hypot(second.x - first.x, second.y - first.y);
          const nextZoom = Math.max(1, Math.min(10, Number((pinchStart.zoom * (distance / pinchStart.distance)).toFixed(2))));
          setActivePointers(nextPointers);
          onZoomChange(nextZoom);
          return;
        }
        if (!dragStart || !onPanChange || dragStart.pointerId !== event.pointerId) return;
        const rawX = dragStart.panX + event.clientX - dragStart.x;
        const nextX = Math.max(-MAP_PAN_LIMIT_X, Math.min(MAP_PAN_LIMIT_X, rawX));
        const nextY = Math.max(-MAP_PAN_LIMIT_Y, Math.min(MAP_PAN_LIMIT_Y, dragStart.panY + event.clientY - dragStart.y));
        onPanChange({ x: nextX, y: nextY });
      }}
      onPointerUp={(event) => {
        if (dragStart?.pointerId === event.pointerId) setDragStart(null);
        setActivePointers((pointers) => pointers.filter((pointer) => pointer.id !== event.pointerId));
        setPinchStart(null);
      }}
      onPointerCancel={(event) => {
        if (dragStart?.pointerId === event.pointerId) setDragStart(null);
        setActivePointers((pointers) => pointers.filter((pointer) => pointer.id !== event.pointerId));
        setPinchStart(null);
      }}
      onWheel={(event) => {
        if (!onZoomChange) return;
        event.preventDefault();
        const step = event.deltaY > 0 ? -0.16 : 0.16;
        onZoomChange(Math.max(1, Math.min(10, Number((zoom + step).toFixed(2)))));
      }}
      onClick={(event) => {
        if (!onBackgroundSelect) return;
        const target = event.target;
        if (target instanceof Element && target.closest("button, a, path, select, input")) return;
        onBackgroundSelect();
      }}
    >
      <div className="map-ocean" />
      <div
        className="map-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) translate(${50 - originX}%, ${50 - originY}%)`,
          transformOrigin: "50% 50%",
        }}
      >
        {WORLD_WRAP_OFFSETS.filter((offset) => offset !== 0).map((offset) => (
          <svg
            key={`world-repeat-${offset}`}
            className="world-repeat-copy"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ transform: `translateX(${offset}%)` }}
          >
            <g className="country-boundaries">
              {worldFeatures.map((country, index) => {
                const regionId = regionIdForCountryName(country.properties.name);
                const pathData = worldPath(country);
                if (!pathData) return null;
                return (
                  <path
                    key={`${country.properties.name}-${index}-${offset}`}
                    className={`territory-cell territory-${index % 17} ${regionId ? `region-${regionId} country-${regionId}` : ""} ${regionId === selectedId ? "selected" : ""}`}
                    d={pathData}
                  />
                );
              })}
            </g>
          </svg>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Interactive operations world map">
          <g className="country-boundaries" aria-label="Country boundary layer">
            {worldFeatures.map((country, index) => {
              const regionId = regionIdForCountryName(country.properties.name);
              const region = regions.find((item) => item.id === regionId);
              const pathData = worldPath(country);
              if (!pathData) return null;
              return (
                <path
                  key={`${country.properties.name}-${index}`}
                  className={`territory-cell territory-${index % 17} ${regionId ? `region-${regionId} country-${regionId}` : ""} ${regionId === selectedId ? "selected" : ""} ${region ? "clickable" : "unmapped"}`}
                  d={pathData}
                  data-region-id={regionId}
                  onClick={() => regionId && onSelect(regionId)}
                  tabIndex={region ? 0 : -1}
                  role={region ? "button" : "img"}
                  aria-label={region ? `Select ${region.name}` : country.properties.name}
                >
                  <title>{region?.name ?? country.properties.name}</title>
                </path>
              );
            })}
          </g>
          {showRegionalBoundaries && (
            <g className="gadm-boundary-layer" aria-label="Regional subdivision layer">
              {gadmSubdivisions.map((subdivision, index) => {
                const pathData = worldPath(subdivision);
                if (!pathData) return null;
                const label = subdivisionName(subdivision);
                const type = subdivisionType(subdivision);
                return (
                  <path
                    key={`${subdivision.properties?.GID_1 ?? label}-${index}`}
                    className={selectedSubdivision && subdivisionCode(selectedSubdivision) === subdivisionCode(subdivision) ? "selected" : ""}
                    d={pathData}
                    tabIndex={0}
                    role="button"
                    aria-label={`${label} ${type}`}
                    onFocus={() => setSelectedSubdivision(subdivision)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedSubdivision(subdivision);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedSubdivision(subdivision);
                      }
                    }}
                  >
                    <title>{label} · {type}</title>
                  </path>
                );
              })}
            </g>
          )}
        </svg>
        {countryLayer && <div className="map-marker-layer" aria-label="Clickable map regions">
          {WORLD_WRAP_OFFSETS.flatMap((offset) => regions.map((region) => {
            const position = mapPositionForRegion(region);
            const primaryCopy = offset === 0;
            return (
              <button
                key={`${region.id}-${offset}`}
                className={`map-marker ${region.sampleQuestionIds.length > 0 ? "curated" : "catalog"} ${region.id === selectedId ? "selected" : ""} ${zoom > 1.5 || region.id === selectedId || region.sampleQuestionIds.length > 0 ? "visible" : "quiet"}`}
                style={{ left: `calc(${position.x}% + ${offset}%)`, top: `${position.y}%`, transform: `scale(${1 / zoom})` }}
                onClick={() => onSelect(region.id)}
                title={region.name}
                aria-label={`Select ${region.name}`}
                data-region-id={region.id}
                data-testid={primaryCopy ? `region-marker-${region.id}` : undefined}
              >
                <FlagAsset code={region.flag} label={`${region.name} flag`} />
              </button>
            );
          }))}
        </div>}
        <div className="city-label-layer" aria-hidden="true">
          {projectedCityLabels.map((city) => (
            <span
              key={city.id}
              className="city-label"
              style={{ left: `${city.x}%`, top: `${city.y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            >
              {city.name}
            </span>
          ))}
        </div>
        {(transitSystemsLayer || zoom > 2.2) ? (
          <div className="airport-marker-layer" aria-label="Airport code markers">
            {projectedAirportLabels.map((airport) => (
              <button
                key={airport.code}
                type="button"
                className="airport-marker"
                style={{ left: `${airport.x}%`, top: `${airport.y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
                onClick={() => onSelect(airport.countryId)}
                title={`${airport.code} · ${airport.name}: ${airport.fact}`}
                aria-label={`Select ${airport.name}`}
              >
                <span>{airport.code}</span>
              </button>
            ))}
          </div>
        ) : null}
        {showRegionalBoundaries && dcSubdivision && dcProjected ? (
          <button
            type="button"
            className="dc-subdivision-hotspot"
            style={{ left: `${dcProjected[0]}%`, top: `${dcProjected[1]}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            onClick={() => setSelectedSubdivision(dcSubdivision)}
            aria-label="Select Washington, D.C."
            title="Washington, D.C."
          >
            DC
          </button>
        ) : null}
        {touristAttractionsLayer && (
          <div className="attraction-marker-layer" aria-label="Tourist attractions layer">
            {projectedTouristAttractions.map((attraction) => (
              <a
                key={attraction.id}
                className={`attraction-marker attraction-${attraction.kind} ${selectedAttractionId === attraction.id ? "selected" : ""}`}
                href={attraction.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => onAttractionSelect?.(attraction)}
                style={{
                  left: `${attraction.x}%`,
                  top: `${attraction.y}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
                title={`${attraction.name}, ${attraction.country}`}
                aria-label={`Open Wikipedia page for ${attraction.name}`}
              >
                <span>{attractionIcon(attraction.kind)}</span>
                <strong>{attraction.name}</strong>
              </a>
            ))}
          </div>
        )}
        <div className="country-hit-layer" aria-label="Country click helper layer">
          {WORLD_WRAP_OFFSETS.flatMap((offset) => regions.map((region) => {
            const position = mapPositionForRegion(region);
            return (
              <button
                key={`hit-${region.id}-${offset}`}
                type="button"
                className="country-hit-target"
                style={{ left: `calc(${position.x}% + ${offset}%)`, top: `${position.y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
                onClick={() => onSelect(region.id)}
                aria-label={`Select ${region.name}`}
                title={region.name}
              />
            );
          }))}
        </div>
        {transitSystemsLayer && (
          <div className="transit-marker-layer" aria-label="Transit networks layer">
            {projectedTransitSystems.map((system) => (
              <a
                key={system.id}
                className={`transit-marker transit-${system.kind} ${selectedTransitSystemId === system.id ? "selected" : ""}`}
                href={system.mapUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => onTransitSystemSelect?.(system)}
                style={{
                  left: `${system.x}%`,
                  top: `${system.y}%`,
                  transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                }}
                title={`${system.name}, ${system.city}`}
                aria-label={`Open Transitland map for ${system.name}`}
              >
                <span>{transitIcon(system.kind)}</span>
                <strong>{system.name}</strong>
              </a>
            ))}
          </div>
        )}
      </div>
      {showRegionalBoundaries && subdivisionJumpOptions.length > 0 && !compact ? (
        <label className="subdivision-jump-control">
          <span>Region</span>
          <select
            value={selectedSubdivision ? subdivisionCode(selectedSubdivision) : ""}
            onChange={(event) => {
              const next = subdivisionJumpOptions.find((item) => item.code === event.target.value)?.feature;
              if (next) setSelectedSubdivision(next);
            }}
          >
            <option value="">Choose a region...</option>
            {subdivisionJumpOptions.map(({ code, name }, index) => (
              <option key={`${code || name}-${index}`} value={code}>{name}</option>
            ))}
          </select>
        </label>
      ) : null}
      {selectedSubdivision && !compact ? (() => {
        const note = subdivisionStudyNote(selectedSubdivision);
        const population = subdivisionPopulation(selectedSubdivision) ?? note?.population;
        const localSystems = selectedRegion ? transitSystemsForSubdivision(selectedSubdivision, selectedRegion.id) : [];
        const localAirports = selectedRegion ? airportsForSubdivision(selectedSubdivision, selectedRegion.id) : [];
        const regionFlagSrc = regionalFlagImageSrc(selectedSubdivision);
        const stateImageSrc = selectedRegion ? subdivisionImagePathForRegion(selectedRegion.id, subdivisionName(selectedSubdivision)) : "";
        return (
          <aside className="subdivision-popover" aria-live="polite">
            <button type="button" onClick={() => setSelectedSubdivision(null)} aria-label="Close regional details">×</button>
            <div className="subdivision-profile-heading">
              {regionFlagSrc ? (
                <img src={regionFlagSrc} alt={`${subdivisionName(selectedSubdivision)} flag`} loading="lazy" />
              ) : null}
              <div>
                <span>{subdivisionType(selectedSubdivision)}</span>
                <strong>{subdivisionName(selectedSubdivision)}</strong>
                <em>{selectedRegion?.name ?? prettifySubdivisionCountryName(selectedSubdivision.properties?.COUNTRY)}</em>
              </div>
            </div>
            {stateImageSrc ? (
              <img className="subdivision-place-photo" src={stateImageSrc} alt={`${subdivisionName(selectedSubdivision)} profile view`} loading="lazy" />
            ) : null}
            <p><b>Capital</b> {note?.capital ?? "Regional capital note not loaded yet"}</p>
            <p><b>Population</b> {population ?? "Population data not loaded yet"}</p>
            {localAirports.length ? <p><b>Airports</b> {localAirports.join(", ")}</p> : null}
            <p><b>Transit</b> {note?.transit ?? (localSystems.length ? "Mapped systems below" : "No local transit note loaded yet")}</p>
            {localSystems.length ? (
              <div className="subdivision-transit-list">
                {localSystems.map((system) => (
                  <a key={system.id} href={system.mapUrl} target="_blank" rel="noreferrer">
                    {transitIcon(system.kind)} {system.name}
                  </a>
                ))}
              </div>
            ) : null}
            <p><b>Region code</b> {subdivisionCode(selectedSubdivision)}</p>
          </aside>
        );
      })() : null}
    </div>
  );
}

function QuizMap({ onAnswer }: { onAnswer: (answer: string) => void }) {
  return (
    <div className="quiz-map-wrap">
      <OperationsMap selectedId="" mapStyle="topographic" onSelect={(id) => onAnswer(regions.find((region) => region.id === id)?.name ?? id)} />
    </div>
  );
}

function QuestionVisual({ question, onAnswer }: { question: Question; onAnswer?: (answer: string) => void }) {
  const metroImageSrc = question.image ? metroImageByPrompt[question.image] : "";
  if (metroImageSrc) {
    return (
      <figure className="question-image-card">
        <img src={metroImageSrc} alt={question.visualCaption ?? question.image ?? "Transit image prompt"} />
        <figcaption>
          <strong>Reference image</strong>
          <span>Use the visual clues, not the caption, to answer.</span>
        </figcaption>
      </figure>
    );
  }

  if (question.visualType === "marta-map") {
    const stations = [
      ["North Springs", "50%", "9%"],
      ["Buckhead", "48%", "30%"],
      ["Lindbergh Center", "50%", "40%"],
      ["Five Points", "50%", "55%"],
      ["Doraville", "84%", "18%"],
      ["College Park", "34%", "77%"],
      ["Airport", "31%", "86%"],
      ["Indian Creek", "94%", "55%"],
    ] as const;
    return (
      <div className="visual-card marta-visual" aria-label={question.visualCaption}>
        <svg viewBox="0 0 100 78" aria-hidden="true">
          <path className="marta-line red" d="M50 5 L50 24 L46 36 L39 49 L31 65" />
          <path className="marta-line gold" d="M84 16 L70 27 L58 40 L45 52 L31 65" />
          <path className="marta-line blue" d="M8 43 L30 43 L50 43 L72 43 L94 43" />
          <path className="marta-line green" d="M8 49 L29 49 L50 43 L71 48 L90 54" />
          <circle className="marta-core" cx="50" cy="43" r="5" />
          <circle className="marta-terminal" cx="31" cy="65" r="3.6" />
          <circle className="marta-terminal" cx="50" cy="5" r="3.6" />
          <circle className="marta-terminal" cx="84" cy="16" r="3.6" />
          <circle className="marta-terminal" cx="94" cy="43" r="3.6" />
        </svg>
        {stations.map(([station, left, top]) => (
          <button
            key={station}
            className="marta-station-target"
            style={{ left, top }}
            aria-label={`Select ${station}`}
            onClick={() => onAnswer?.(station)}
            title="Station"
          />
        ))}
        <strong>Blank rail diagram</strong>
      </div>
    );
  }

  if (question.visualType === "metro-diagram") {
    return (
      <div className="visual-card metro-visual" aria-label={question.visualCaption}>
        <span className="metro-line red" />
        <span className="metro-line blue" />
        <span className="metro-line orange" />
        <span className="station-dot center">Metro Center</span>
        <span className="station-dot union">Union</span>
        <span className="station-dot rosslyn">Rosslyn</span>
        <strong>{question.image}</strong>
        <em>{question.visualCaption}</em>
      </div>
    );
  }

  if (question.visualType === "wmata-map") {
    return <WmataStationMap question={question} onAnswer={onAnswer} />;
  }

  if (question.visualType === "flag") {
    const flagCode = (question.image ?? "").trim().toUpperCase();
    return (
      <div className="flag-image-visual">
        {flagCode ? <FlagAsset code={flagCode} label="Country flag prompt" /> : <span>?</span>}
      </div>
    );
  }

  if (question.visualType === "regional-flag") {
    return (
      <div className="flag-image-visual regional-flag-visual">
        {question.image ? <img src={question.image} alt="Regional flag prompt" /> : <span>?</span>}
      </div>
    );
  }

  if (question.visualType === "station-map") {
    return (
      <div className="visual-card station-visual" aria-label={question.visualCaption}>
        <svg className="japan-archipelago" viewBox="0 0 100 60" aria-hidden="true">
          <path className="island hokkaido" d="M70 4 C78 2 86 8 86 16 C85 23 75 25 69 20 C63 15 63 8 70 4Z" />
          <path className="island honshu" d="M55 18 C62 18 66 23 65 29 C64 35 56 35 51 39 C44 44 38 50 29 50 C24 50 22 46 26 42 C32 36 39 35 43 29 C47 23 49 19 55 18Z" />
          <path className="island shikoku" d="M36 45 C41 42 48 43 50 47 C47 51 39 52 34 49 C33 47 34 46 36 45Z" />
          <path className="island kyushu" d="M20 46 C26 44 31 49 30 55 C27 60 18 59 14 54 C12 50 15 47 20 46Z" />
          <path className="island okinawa" d="M6 55 C8 54 10 55 10 57 C9 59 6 59 5 57 C5 56 5 55 6 55Z" />
          <path className="shinkansen-corridor" d="M67 26 C58 30 51 35 43 40 C36 44 30 47 22 51" />
        </svg>
        <span className="island-label honshu-label">Honshu</span>
        <button className="station-pin tokyo" onClick={() => onAnswer?.("Tokyo")} aria-label="Select Tokyo">Tokyo</button>
        <button className="station-pin nagoya" onClick={() => onAnswer?.("Nagoya")} aria-label="Select Nagoya">Nagoya</button>
        <button className="station-pin osaka" onClick={() => onAnswer?.("Osaka")} aria-label="Select Osaka">Osaka</button>
        <button className="station-pin hiroshima" onClick={() => onAnswer?.("Hiroshima Station")} aria-label="Select Hiroshima Station">?</button>
        <button className="station-pin fukuoka" onClick={() => onAnswer?.("Fukuoka")} aria-label="Select Fukuoka">Fukuoka</button>
        <strong>{question.image}</strong>
        <em>{question.visualCaption}</em>
      </div>
    );
  }

  if (question.visualType === "transit-photo" || question.visualType === "landmark-photo") {
    return <PhotoPrompt question={question} />;
  }

  if (question.visualType === "aerial-map") {
    return <PhotoPrompt question={question} />;
  }

  if (question.visualType === "street-view" || question.visualType === "landmark") {
    if (question.image?.includes("Shinkansen") || question.image?.includes("Sydney") || question.image?.includes("Jewel Changi")) {
      return <PhotoPrompt question={question} />;
    }
    return (
      <div className="visual-card street-visual" aria-label={question.visualCaption}>
        <div className="platform-perspective">
          <span className="train-nose" />
          <span className="platform-line" />
          <span className="city-sign">Tokyo</span>
        </div>
        <strong>{question.image}</strong>
        <em>{question.visualCaption}</em>
      </div>
    );
  }

  return <div className="flag-visual">{question.image}</div>;
}

function WmataStationMap({ question, onAnswer }: { question: Question; onAnswer?: (answer: string) => void }) {
  const stations = [
    ["Ashburn", "81%", "68%"],
    ["Rosslyn", "48%", "56%"],
    ["Metro Center", "52%", "48%"],
    ["L'Enfant Plaza", "54%", "60%"],
    ["Fort Totten", "61%", "33%"],
    ["College Park", "66%", "23%"],
    ["Union Station", "58%", "41%"],
    ["Reagan National Airport", "50%", "74%"],
    ["New Carrollton", "76%", "43%"],
  ] as const;

  return (
    <div className="visual-card wmata-visual" aria-label={question.visualCaption}>
      <img className="wmata-reference-image" src="/images/metro-images/WMATA.png" alt="Unlabeled Washington Metro reference map" />
      {stations.map(([station, left, top]) => (
        <button
          key={station}
          className="wmata-station-target"
          style={{ left, top }}
          aria-label={`Select ${station}`}
          onClick={() => onAnswer?.(station)}
          title="Station"
        />
      ))}
      <strong>{question.image}</strong>
      <em>{question.visualCaption}</em>
    </div>
  );
}

function PhotoPrompt({ question }: { question: Question }) {
  const imageSet = [
    question.image ?? "Transit geography reference",
    question.visualCaption ?? question.explanation,
  ].filter((item, index, array) => item && array.indexOf(item) === index);
  const [activeImage, setActiveImage] = useState(0);
  const photoClass =
    question.image?.includes("MetroCable") ? "photo-metrocable"
    : question.image?.includes("Al Boraq") ? "photo-alboraq"
    : question.image?.includes("Taipei") ? "photo-taipei"
    : question.image?.includes("Table") ? "photo-table"
    : question.image?.includes("Sydney") ? "photo-sydney"
    : question.image?.includes("Jewel Changi") ? "photo-jewel"
    : question.image?.includes("Shinkansen") ? "photo-shinkansen"
    : question.image?.includes("Canal lock") ? "photo-canal"
    : question.image?.includes("Mont Blanc") ? "photo-montblanc"
    : question.image?.includes("Pontchartrain") ? "photo-pontchartrain"
    : question.image?.includes("Hudson") ? "photo-hudson"
    : question.image?.includes("Danyang") ? "photo-bridge"
    : question.image?.includes("Gotthard") ? "photo-tunnel"
    : question.image?.includes("Mariana") ? "photo-trench"
    : question.image?.includes("Taj Mahal") ? "photo-taj"
    : question.image?.includes("Uluru") || question.image?.includes("Ayers Rock") ? "photo-uluru"
    : question.image?.includes("Costa Rica") || question.image?.includes("Rainforest") ? "photo-rainforest"
    : question.image?.includes("Park Guell") || question.image?.includes("Park Guell") ? "photo-park-guell"
    : question.image?.includes("Chefchaouen") ? "photo-chefchaouen"
    : question.image?.includes("Great Wall") ? "photo-great-wall"
    : question.image?.includes("Niagara") || question.image?.includes("Victoria Falls") || question.image?.includes("Angel Falls") || question.image?.includes("Iguazu") ? "photo-waterfall"
    : question.image?.includes("Grand Canyon") ? "photo-canyon"
    : question.image?.includes("Machu Picchu") ? "photo-machu"
    : question.image?.includes("Kyoto") ? "photo-kyoto"
    : question.image?.includes("Komodo") ? "photo-komodo"
    : question.image?.includes("Everest") ? "photo-everest"
    : question.image?.includes("Persepolis") ? "photo-persepolis"
    : "photo-generic";

  return (
    <div className={`visual-card photo-visual ${photoClass}`} aria-label={question.visualCaption}>
      <div className="photo-nav">
        <button
          type="button"
          onClick={() => setActiveImage((index) => (index - 1 + imageSet.length) % imageSet.length)}
          disabled={imageSet.length < 2}
        >
          Previous
        </button>
        <span>{activeImage + 1}/{imageSet.length}</span>
        <button
          type="button"
          onClick={() => setActiveImage((index) => (index + 1) % imageSet.length)}
          disabled={imageSet.length < 2}
        >
          Next
        </button>
      </div>
      <div className="photo-scene">
        <span className="photo-subject" />
      </div>
    </div>
  );
}

function RegionPanel({
  region,
  selectedAttractionId,
  onAttractionSelect,
  selectedTransitSystemId,
  onTransitSystemSelect,
  onSelectNearby,
  onPracticeRegion,
  onReplay,
}: {
  region: Region;
  selectedAttractionId: string | null;
  onAttractionSelect: (attractionId: string) => void;
  selectedTransitSystemId: string | null;
  onTransitSystemSelect: (systemId: string) => void;
  onSelectNearby: (regionId: string) => void;
  onPracticeRegion: (region: Region, question?: Question, topics?: PracticeTopic[]) => void;
  onReplay: (question?: Question) => void;
}) {
  const sampleQuestions = region.sampleQuestionIds
    .map((id) => questions.find((question) => question.id === id))
    .filter((question): question is Question => Boolean(question));
  const subregions = subregionsFor(region.id);
  const regionAttractions = attractionsForRegion(region.id);
  const regionTransitSystems = transitSystemsForRegion(region.id);
  const placeImage = usePlaceImage(region);
  const countryImageFileName = countryImageFileNameForName(region.name);
  const countryImage = countryImageFileName
    ? {
        name: region.name,
        type: "country",
        region: region.name,
        imagePath: countryImagePathForName(region.name),
        attribution: {
          title: `${region.name} profile image`,
          author: "GeoTransit image library",
          license: "Local app asset",
          sourceUrl: "#",
        },
      } satisfies PlaceImage
    : null;
  const profileImage = countryImage ?? placeImage;
  const airportReferenceImages = airportReferenceImagesByRegion[region.id] ?? [];
  const nearbyRegions = nearbyRegionsFor(region.id);
  const practiceTopicOptions = practiceTopicOptionsForRegion(region, regionTransitSystems.length, regionAttractions.length);
  const [practiceTopics, setPracticeTopics] = useState<PracticeTopic[]>(practiceTopicOptions.map((topic) => topic.id));
  useEffect(() => {
    setPracticeTopics(practiceTopicOptions.map((topic) => topic.id));
  }, [region.id]);

  return (
    <aside className="region-panel">
      <div className="region-heading">
        <div className="flag-card">
          <FlagAsset code={region.flag} label={`${region.name} flag`} />
        </div>
        <div>
          <p className="eyebrow">Selected region</p>
          <h2>{region.name}</h2>
          <span>{region.capital}</span>
        </div>
      </div>
      <div className="fact-box compact-facts">
        <p><strong>Population:</strong> {region.population}</p>
      </div>
      {profileImage && <PlaceImageCard image={profileImage} />}
      {airportReferenceImages.length > 0 && <ProfileImageGallery title="Airport references" images={airportReferenceImages} />}
      {nearbyRegions.length > 0 && (
        <details className="nearby-panel" open>
          <summary>
            <span>Explore Nearby</span>
            <em>{nearbyRegions.length}</em>
          </summary>
          <p>{nearbyDescriptionFor(region)}</p>
          <div>
            {nearbyRegions.map((nearby) => (
              <button key={nearby.id} type="button" onClick={() => onSelectNearby(nearby.id)}>
                <FlagAsset code={nearby.flag} label={`${nearby.name} flag`} />
                {nearby.name}
              </button>
            ))}
          </div>
        </details>
      )}
      <InfoGroup title="Major Cities" items={region.majorCities} regionName={region.name} />
      <InfoGroup title="Airports" items={region.airports} regionName={region.name} badge />
      <InfoGroup title="Rail" items={region.rail} regionName={region.name} />
      <InfoGroup title="Metro" items={region.metro} regionName={region.name} />
      {regionTransitSystems.length > 0 && (
        <details className="transit-repository-panel">
          <summary>
            <span>Transit Systems</span>
            <em>{regionTransitSystems.length} mapped reference{regionTransitSystems.length === 1 ? "" : "s"}</em>
          </summary>
          <p>Curated metro and major rail systems for this country. Use these in-app notes first; Transitland and Wikipedia links are optional references when you want route context or system history.</p>
          {region.id === "united-states" && (
            <div className="transit-example-card">
              <strong>Example reference: Brightline Florida</strong>
              <span>The in-app brief gives the quiz focus; Transitland and Wikipedia are optional references for route context, stations, and service notes.</span>
            </div>
          )}
          {regionTransitSystems.map((system) => {
            const imageSrc = transitSystemImageById[system.id];
            return (
              <article key={system.id} className={selectedTransitSystemId === system.id ? "selected" : ""}>
                <button type="button" onClick={() => onTransitSystemSelect(system.id)}>
                  <span>{transitIcon(system.kind)}</span>
                  <strong>{system.name}</strong>
                </button>
                {imageSrc && (
                  <button
                    type="button"
                    className="transit-system-image-button"
                    onClick={() => onTransitSystemSelect(system.id)}
                    aria-label={`Focus ${system.name} on the map`}
                  >
                    <img src={imageSrc} alt={`${system.name} reference map`} loading="lazy" />
                  </button>
                )}
                <span>{system.city} · {system.region} · {system.type}</span>
                <p>{system.quizFocus}</p>
                <div className="transit-nodes">
                  {system.keyNodes.map((node) => <span key={node}>{node}</span>)}
                </div>
                <div>
                  <a href={system.mapUrl} target="_blank" rel="noreferrer">Transitland map</a>
                  <a href={system.sourceUrl} target="_blank" rel="noreferrer">Reference</a>
                </div>
              </article>
            );
          })}
        </details>
      )}
      <InfoGroup title="Highways" items={region.highways} regionName={region.name} badge />
      <InfoGroup title="Maritime" items={region.maritime} regionName={region.name} />
      <InfoGroup title="Landmarks" items={region.landmarks} regionName={region.name} />
      <InfoGroup title="Rivers & Mountains" items={region.riversMountains} regionName={region.name} />
      <InfoGroup title="Places of Interest" items={region.placesOfInterest} regionName={region.name} />
      {regionAttractions.length > 0 && (
        <div className="attractions-panel">
          <h3>Tourist Attractions Layer</h3>
          <p>These points also appear on the map when the Tourist attractions layer is switched on.</p>
          {regionAttractions.map((attraction) => (
            <a
              key={attraction.id}
              className={selectedAttractionId === attraction.id ? "selected" : ""}
              href={attraction.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => onAttractionSelect(attraction.id)}
            >
              <span>{attractionIcon(attraction.kind)}</span>
              <strong>{attraction.name}</strong>
              <em>Wikipedia</em>
            </a>
          ))}
        </div>
      )}
      {subregions.length > 0 && <RegionAssetGrid region={region} subregions={subregions} />}
      {subregions.length > 0 && <InfoGroup title="States, Provinces & Regions" items={subregions} regionName={region.name} />}
      <InfoGroup title="Fun Facts" items={region.funFacts} regionName={region.name} />
      <div className="fact-box">
        {region.facts.map((fact) => <p key={fact}>{fact}</p>)}
      </div>
      <details className="sample-questions">
        <summary>
          <span>Practice Questions</span>
          <em>{sampleQuestions.length || "new"}</em>
        </summary>
        <p>Short questions for this profile. Download flashcards when you want an offline review set.</p>
        {sampleQuestions.length === 0 && <p>No local samples yet; this region is ready for expansion.</p>}
        {sampleQuestions.map((question) => (
          <button key={question.id} onClick={() => onPracticeRegion(region, question, practiceTopics)}>{question.prompt}</button>
        ))}
        <button type="button" className="secondary-action" onClick={() => downloadPracticeFlashcards(region, practiceTopics, "gateway")}>
          Download Practice Flashcards
        </button>
      </details>
      <button className="primary-action" onClick={() => onPracticeRegion(region, sampleQuestions[0], practiceTopics)}>Start Practice</button>
    </aside>
  );
}

function EmptyRegionPanel() {
  return (
    <aside className="region-panel">
      <p className="eyebrow">No region selected</p>
      <h2>Choose a country or territory</h2>
      <div className="fact-box">
        <p>Click a country boundary, flag marker, or the country selector to open a transit and geography profile.</p>
        <p>You can deselect a region any time to return to the full-world map view.</p>
      </div>
    </aside>
  );
}

const askGeoTransitCards: AskCard[] = [
  {
    id: "hungary-neighbors",
    tab: "Borders",
    title: "Countries Bordering Hungary",
    category: "Nearby countries",
    summary: "Hungary sits in the heart of Central Europe. Explore how its rail and road connections link the Balkans, Central Europe, and Eastern Europe.",
    items: [
      { label: "Austria", regionId: "austria", flag: "AT", note: "Vienna and Budapest anchor a strong Danube rail corridor." },
      { label: "Slovakia", regionId: "slovakia", flag: "SK", note: "Bratislava is close enough to Vienna to shape cross-border commuting." },
      { label: "Ukraine", regionId: "ukraine", flag: "UA", note: "Eastern connections add broad-gauge and border-transfer context." },
      { label: "Romania", regionId: "romania", flag: "RO", note: "Transylvania links mountain geography with rail gateways." },
      { label: "Serbia", regionId: "serbia", flag: "RS", note: "The Budapest-Belgrade axis is a major Balkan rail story." },
      { label: "Croatia", regionId: "croatia", flag: "HR", note: "Drava and Sava corridors pull Hungary toward the Adriatic." },
      { label: "Slovenia", regionId: "slovenia", flag: "SI", note: "Alpine-Adriatic routes connect Central Europe to ports." },
    ],
    image: { src: "/images/country-images/Austria.jpg", alt: "Austria landscape and transport reference" },
  },
  {
    id: "morocco-transit",
    tab: "Rail",
    title: "Transit Systems in Morocco",
    category: "Transit systems",
    summary: "Morocco is a clean example of national rail, high-speed rail, and city tramways working at different scales.",
    items: [
      { label: "Al Boraq", regionId: "morocco", flag: "MA", note: "Tangier, Rabat, Casablanca high-speed rail." },
      { label: "ONCF", regionId: "morocco", flag: "MA", note: "National rail backbone and intercity network." },
      { label: "Casablanca Tramway", regionId: "morocco", flag: "MA", note: "Urban surface transit in Morocco's largest city." },
      { label: "Rabat-Sale Tramway", regionId: "morocco", flag: "MA", note: "Capital-region tram across the Bou Regreg." },
    ],
    image: { src: "/images/metro-images/Railways_Morocco.png", alt: "Morocco railways map" },
  },
  {
    id: "spain-portugal-hsr",
    tab: "Rail",
    title: "Compare Spain and Portugal High-Speed Rail",
    category: "Country comparison",
    summary: "Spain has one of the world's largest high-speed rail networks; Portugal is more corridor-focused, with Lisbon-Porto and cross-border links carrying the comparison.",
    items: [
      { label: "Spain", regionId: "spain", flag: "ES", note: "Large AVE network radiating from Madrid." },
      { label: "Portugal", regionId: "portugal", flag: "PT", note: "Lisbon-Porto and Iberian cross-border planning are the core story." },
    ],
    compareIds: ["spain", "portugal"],
    image: { src: "/images/region-images/imported/portugal/lisbon.jpg", alt: "Portugal and Lisbon corridor context for Iberian rail comparison" },
  },
  {
    id: "similar-japan",
    tab: "Countries",
    title: "Countries Similar to Japan",
    category: "Geography comparison",
    summary: "Use island geography, dense metropolitan corridors, and rail intensity as the comparison lens.",
    items: [
      { label: "Taiwan", regionId: "taiwan", flag: "TW", note: "Island spine with HSR and dense western cities." },
      { label: "South Korea", regionId: "south-korea", flag: "KR", note: "High-speed rail, major metro areas, and peninsula constraints." },
      { label: "Singapore", regionId: "singapore", flag: "SG", note: "Compact island city-state with highly legible MRT planning." },
    ],
    image: { src: "/images/metro-images/Singapore_MRT_Network.svg.png", alt: "Singapore MRT network map for island transit comparison" },
  },
  {
    id: "mountain-railways",
    tab: "Mountains",
    title: "Mountain Railways Around the World",
    category: "Mountain railways",
    summary: "These systems turn steep terrain into the lesson: tunnels, switchbacks, cableways, and tourist rail all become geography made visible.",
    items: [
      { label: "Switzerland", regionId: "switzerland", flag: "CH", note: "Alpine tunnels and mountain rail define national mobility." },
      { label: "Peru", regionId: "peru", flag: "PE", note: "Andean rail links pair altitude with heritage tourism." },
      { label: "Bolivia", regionId: "bolivia", flag: "BO", note: "La Paz cable cars solve extreme elevation differences." },
      { label: "Japan", regionId: "japan", flag: "JP", note: "Mountain corridors and urban rail meet in tight terrain." },
    ],
    image: { src: "/images/ask/mountain-railway-reference.png", alt: "Mountain railway climbing through alpine terrain" },
  },
  {
    id: "island-transit",
    tab: "Islands",
    title: "Island Countries With Major Transit Systems",
    category: "Island transit",
    summary: "Island systems are useful because limited land forces clear choices: rail spines, port access, airport links, and dense city networks.",
    items: [
      { label: "Japan", regionId: "japan", flag: "JP", note: "Shinkansen and metro networks knit multiple islands together." },
      { label: "Singapore", regionId: "singapore", flag: "SG", note: "MRT planning is the island's main urban mobility skeleton." },
      { label: "United Kingdom", regionId: "united-kingdom", flag: "GB", note: "National Rail and London transport dominate the island pattern." },
      { label: "Sri Lanka", regionId: "sri-lanka", flag: "LK", note: "Coastal and hill-country rail show terrain contrast." },
    ],
    image: { src: "/images/metro-images/Singapore_MRT_Network.svg.png", alt: "Singapore MRT network map" },
  },
  {
    id: "african-metros",
    tab: "Mega Cities",
    title: "Countries With Metro Systems in Africa",
    category: "African metro systems",
    summary: "A strong regional set for comparing legacy metros, new light rail, cable transit, and commuter-rail upgrades.",
    items: [
      { label: "Egypt", regionId: "egypt", flag: "EG", note: "Cairo Metro is Africa's largest rapid-transit anchor." },
      { label: "Algeria", regionId: "algeria", flag: "DZ", note: "Algiers Metro pairs with tramway networks." },
      { label: "Morocco", regionId: "morocco", flag: "MA", note: "Tramways and Al Boraq create a layered transit profile." },
      { label: "Ethiopia", regionId: "ethiopia", flag: "ET", note: "Addis Ababa light rail is a key urban example." },
      { label: "Nigeria", regionId: "nigeria", flag: "NG", note: "Lagos rail, ferries, and BRT show megacity mobility pressure." },
      { label: "South Africa", regionId: "south-africa", flag: "ZA", note: "Gautrain and urban commuter rail anchor a different African model." },
    ],
    image: { src: "/images/ask/cairo-megacity.png", alt: "Cairo skyline and Nile megacity context" },
  },
  {
    id: "geography-shaped-transport",
    tab: "Hidden Gems",
    title: "Best Examples of Geography Shaping Transportation",
    category: "Geography-shaped transportation",
    summary: "Use these when you want the app to explain why transport looks the way it does, not just where it is.",
    items: [
      { label: "Chile", regionId: "chile", flag: "CL", note: "Long, narrow geography concentrates routes between Andes and Pacific." },
      { label: "Norway", regionId: "norway", flag: "NO", note: "Fjords make ferries, tunnels, and coastal aviation central." },
      { label: "Switzerland", regionId: "switzerland", flag: "CH", note: "Alps create tunnel and mountain-rail engineering lessons." },
      { label: "Indonesia", regionId: "indonesia", flag: "ID", note: "Archipelago geography makes air and maritime networks essential." },
    ],
  },
  {
    id: "border-city-links",
    tab: "Borders",
    title: "Border Cities With Major Transit Links",
    category: "Border cities",
    summary: "Good for learning cross-border commuting, station geography, and how cities operate as pairs.",
    items: [
      { label: "Austria", regionId: "austria", flag: "AT", note: "Vienna-Bratislava is a compact cross-border rail example." },
      { label: "Slovakia", regionId: "slovakia", flag: "SK", note: "Bratislava's position makes borders part of daily mobility." },
      { label: "Singapore", regionId: "singapore", flag: "SG", note: "Johor Bahru links show metro, bus, and border pressure." },
      { label: "United States", regionId: "united-states", flag: "US", note: "San Diego-Tijuana shows border-region mobility at scale." },
    ],
  },
  {
    id: "unusual-capital-rail",
    tab: "Rail",
    title: "Capital Cities With Unusual Rail Systems",
    category: "Capital rail",
    summary: "Use capital cities where the rail story is not generic: cable cars, new metros, airport links, or unusual network geography.",
    items: [
      { label: "Bolivia", regionId: "bolivia", flag: "BO", note: "La Paz uses cable cars as mass transit across elevation." },
      { label: "Hungary", regionId: "hungary", flag: "HU", note: "Budapest mixes historic metro, trams, and Danube crossings." },
      { label: "Malaysia", regionId: "malaysia", flag: "MY", note: "Kuala Lumpur blends metro, commuter rail, and airport express." },
      { label: "United Arab Emirates", regionId: "uae", flag: "AE", note: "Abu Dhabi capital context contrasts with Dubai's metro." },
    ],
    image: { src: "/images/metro-images/Seilbahnnetz_La_PazBolivia.svg.png", alt: "La Paz cable car network map" },
  },
  {
    id: "global-airport-hubs",
    tab: "Airports",
    title: "Countries With Global Airport Hubs",
    category: "Airports",
    summary: "Use these to compare where geography, aviation, and long-haul transfer markets make airports globally important.",
    items: [
      { label: "United Arab Emirates", regionId: "uae", flag: "AE", note: "Dubai and Abu Dhabi connect Europe, Asia, Africa, and Oceania." },
      { label: "Singapore", regionId: "singapore", flag: "SG", note: "Changi is a compact island-state transfer hub." },
      { label: "Turkey", regionId: "turkey", flag: "TR", note: "Istanbul sits between Europe, Asia, and Middle East flows." },
      { label: "Netherlands", regionId: "netherlands", flag: "NL", note: "Schiphol links a small country to a huge global network." },
      { label: "United States", regionId: "united-states", flag: "US", note: "A huge airport network connects major metros and small communities." },
      { label: "United Kingdom", regionId: "united-kingdom", flag: "GB", note: "Heathrow, Gatwick, Manchester, and regional hubs make dense air links." },
      { label: "Qatar", regionId: "qatar", flag: "QA", note: "Doha is a Gulf transfer hub with a compact national geography." },
      { label: "Japan", regionId: "japan", flag: "JP", note: "Haneda, Narita, Kansai, and regional airports complement high-speed rail." },
      { label: "China", regionId: "china", flag: "CN", note: "Beijing, Shanghai, Guangzhou, Chengdu, and Shenzhen anchor major flows." },
    ],
    image: { src: "/images/ask/dubai-airport.png", alt: "Dubai airport and skyline as a global hub reference" },
  },
  {
    id: "island-rail-systems",
    tab: "Islands",
    title: "Island Countries With Rail Systems",
    category: "Island rail",
    summary: "A good GEONTRANSIT comparison: compact land, constrained corridors, and rail networks that have to work around coastlines.",
    items: [
      { label: "Japan", regionId: "japan", flag: "JP", note: "Dense intercity and urban rail across multiple islands." },
      { label: "Sri Lanka", regionId: "sri-lanka", flag: "LK", note: "Rail links coastal cities and hill-country terrain." },
      { label: "United Kingdom", regionId: "united-kingdom", flag: "GB", note: "National Rail, London, Glasgow, and regional rail corridors." },
      { label: "Taiwan", regionId: "taiwan", flag: "TW", note: "HSR and conventional rail follow the island's western urban spine." },
    ],
    image: { src: "/images/metro-images/Shinkansen_map_202405_en.png", alt: "Japan Shinkansen map" },
  },
  {
    id: "deserts-mountains-metros",
    tab: "Mountains",
    title: "Countries With Deserts, Mountains, and Metro Systems",
    category: "Geography plus metro",
    summary: "These profiles show how extreme terrain and urban transit can coexist inside one national geography story.",
    items: [
      { label: "Chile", regionId: "chile", flag: "CL", note: "Atacama, Andes, and Santiago Metro." },
      { label: "Algeria", regionId: "algeria", flag: "DZ", note: "Sahara, Atlas edges, and Algiers Metro." },
      { label: "Iran", regionId: "iran", flag: "IR", note: "Deserts, Alborz/Zagros, and Tehran Metro." },
      { label: "China", regionId: "china", flag: "CN", note: "Western deserts, Himalaya/Tibet edges, and massive metro systems." },
    ],
    image: { src: "/images/country-images/Chile.jpg", alt: "Chile geography reference" },
  },
  {
    id: "disconnected-regions",
    tab: "Regions",
    title: "Regions That Feel Far From the Capital",
    category: "Regional geography",
    summary: "Use these to explore countries where distance, islands, mountains, or colonial-era boundaries make regional identity especially important.",
    items: [
      { label: "Indonesia", regionId: "indonesia", flag: "ID", note: "Papua, Sumatra, Java, and island chains create large regional contrasts." },
      { label: "Russia", regionId: "russia", flag: "RU", note: "Siberia and the Far East are far from Moscow by rail and air." },
      { label: "Chile", regionId: "chile", flag: "CL", note: "Patagonia and Atacama sit at opposite ends of a long country." },
      { label: "France", regionId: "france", flag: "FR", note: "Corsica and overseas geography change the profile." },
    ],
    image: { src: "/images/region-images/imported/chile/magallanes-y-antartica-chilena.jpg", alt: "Southern Chile regional geography" },
  },
  {
    id: "capital-not-largest",
    tab: "Countries",
    title: "Capitals That Are Not the Largest City",
    category: "Country comparison",
    summary: "These countries are useful for separating political geography from economic and transportation geography.",
    items: [
      { label: "United Arab Emirates", regionId: "uae", flag: "AE", note: "Abu Dhabi is the capital; Dubai is the largest hub." },
      { label: "Australia", regionId: "australia", flag: "AU", note: "Canberra is the capital; Sydney and Melbourne dominate transport." },
      { label: "Turkey", regionId: "turkey", flag: "TR", note: "Ankara is capital; Istanbul is the largest global gateway." },
      { label: "Brazil", regionId: "brazil", flag: "BR", note: "Brasilia is capital; Sao Paulo is the largest metro economy." },
    ],
    image: { src: "/images/country-images/Brazil.jpg", alt: "Brazil profile image" },
  },
];

const askGeoTransitTabs = ["Countries", "Regions", "Rail", "Airports", "Islands", "Mountains", "Borders", "Mega Cities", "Hidden Gems"];

function countryTransitHook(region: Region) {
  const specificHooks: Record<string, string> = {
    brazil: "Brazil is strongest when you compare Sao Paulo's metro scale, Rio's coastal rail/airport geography, Brasilia's planned-capital layout, Amazon river corridors, and Atlantic ports.",
    chile: "Chile is a retention-friendly geography lesson: Atacama in the north, Santiago Metro in the center, Valparaiso port links, and Patagonia/Punta Arenas at the long southern edge.",
    turkey: "Turkey is more than Istanbul: compare Istanbul's metro and Bosporus crossings with Ankara rail, Izmir coastal transit, Adana and Antalya gateways, and Anatolian high-speed corridors.",
    japan: "Japan connects island geography through Shinkansen spines, Tokyo and Osaka metro regions, Hokkaido and Kyushu rail contrasts, ferries, airports, and mountain corridors.",
    morocco: "Morocco's profile should anchor on Al Boraq between Tangier, Rabat, and Casablanca, then add Casablanca tram, Rabat-Sale tram, Marrakech tourism flows, Fez, ports, and Atlas geography.",
    norway: "Norway is a fjord-and-distance lesson: ferries, tunnels, coastal aviation, Bergen light rail, Oslo rail, Svalbard air access, and mountain routes matter more than megacity scale.",
    egypt: "Egypt combines Nile geography, Cairo Metro, Alexandria coastal rail and port links, Suez Canal logistics, Red Sea airports, Luxor, and Aswan river tourism.",
    indonesia: "Indonesia is archipelago mobility: Jakarta MRT, Java rail, ferries, ports, airports, Bali tourism flows, Sumatra and Papua distance, and island-by-island regional identity.",
    mexico: "Mexico connects Mexico City Metro and high-altitude capital geography with Guadalajara, Monterrey, border corridors, Maya Train/Yucatan tourism, and major airports like MEX and CUN.",
    france: "France is Paris plus regions: TGV corridors, RER/Metro, Lyon and Marseille, Atlantic and Mediterranean ports, Corsica, and overseas geography.",
    haiti: "Haiti is best explored through Port-au-Prince, Cap-Haitien, mountain roads, Caribbean port access, shared-island geography with the Dominican Republic, and airport gateways.",
    jamaica: "Jamaica's transport memory hook is island corridors: Kingston, Montego Bay, ports, airports, mountain roads, tourism coastlines, and ferry/road constraints.",
    "united-states": "The United States is a regions-first profile: Northeast rail, Sun Belt airports, Great Lakes metros, West Coast transit, Alaska/Hawaii distance, and huge interstate corridors.",
  };
  if (specificHooks[region.id]) return specificHooks[region.id];
  const strongest = [
    region.metro[0],
    region.rail[0],
    region.airports[0],
    region.maritime[0],
    region.highways[0],
  ].filter(Boolean)[0];
  if (strongest) return `${region.name}'s profile starts with ${strongest}, then connects outward through regions, nearby countries, and geography.`;
  return `${region.name}'s profile is best explored through capital geography, nearby countries, and regional movement patterns.`;
}

function askPreviewImage(card: AskCard) {
  if (card.image?.src) return card.image.src;
  const firstRegion = card.items
    .map((item) => item.regionId ? regions.find((region) => region.id === item.regionId) : null)
    .find((region): region is Region => Boolean(region));
  return firstRegion ? countryImagePathForName(firstRegion.name) : "";
}

function AskGeoInTransitPanel({ currentRegion, onSelectRegion }: { currentRegion: Region | null; onSelectRegion: (regionId: string) => void }) {
  const contextualCard: AskCard | null = currentRegion ? {
    id: `context-${currentRegion.id}`,
    tab: "Countries",
    title: `Explore ${currentRegion.name} Through Geography and Transit`,
    category: "Current profile",
    summary: `${currentRegion.name} connects ${currentRegion.capital.includes("queued") ? "its capital region" : currentRegion.capital} with regional geography, airports, rail or road corridors, and nearby countries. Expand this card for a focused GEONTRANSIT route through the country you already opened.`,
    items: [
      { label: currentRegion.name, regionId: currentRegion.id, flag: currentRegion.flag, note: countryTransitHook(currentRegion) },
      ...nearbyRegionsFor(currentRegion.id).slice(0, 3).map((region) => ({
        label: region.name,
        regionId: region.id,
        flag: region.flag,
        note: `Nearby profile for border, corridor, airport, ferry, or regional comparison.`,
      })),
    ],
    image: { src: countryImagePathForName(currentRegion.name), alt: `${currentRegion.name} country profile image` },
  } : null;
  const cards = contextualCard ? [contextualCard, ...askGeoTransitCards] : askGeoTransitCards;
  const [activeTab, setActiveTab] = useState(contextualCard ? "Countries" : "Borders");
  const visibleCards = cards.filter((card) => card.tab === activeTab);
  const [openCardId, setOpenCardId] = useState(contextualCard?.id ?? "hungary-neighbors");
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  return (
    <section className="ask-geointransit-panel" aria-label="Explore GEONTRANSIT discovery prompts">
      <div className="ask-panel-heading">
        <div>
          <strong>Explore GEONTRANSIT</strong>
          <span>Expandable discovery cards for geography, regions, rail, airports, borders, islands, and unusual comparisons</span>
        </div>
      </div>
      <div className="ask-tabs" role="tablist" aria-label="GEONTRANSIT discovery categories">
        {askGeoTransitTabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab}>
            {tab}
          </button>
        ))}
      </div>
      <div className="ask-discovery-grid">
        {visibleCards.map((card) => {
          const open = openCardId === card.id;
          const previewImage = askPreviewImage(card);
          return (
            <article key={card.id} className={`ask-card ${open ? "open" : ""}`}>
              {previewImage ? (
                <button
                  type="button"
                  className="ask-card-thumb"
                  onClick={() => setLightboxImage({ src: previewImage, title: card.title, caption: card.image?.alt ?? card.category })}
                >
                  <img src={previewImage} alt={card.image?.alt ?? `${card.title} visual`} loading="lazy" />
                </button>
              ) : null}
              <div className="ask-card-intro">
                <em>{card.category}</em>
                <strong>{card.title}</strong>
                <p>{card.summary}</p>
                <div className="ask-chip-row">
                  {card.items.slice(0, 4).map((item) => (
                    <button key={`${card.id}-chip-${item.label}`} type="button" onClick={() => item.regionId && onSelectRegion(item.regionId)} disabled={!item.regionId}>
                      {item.flag ? <FlagAsset code={item.flag} label={`${item.label} flag`} /> : null}
                      {item.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="ask-action-button" onClick={() => setOpenCardId(open ? "" : card.id)} aria-expanded={open}>
                  {open ? "Collapse" : "Expand"}
                </button>
              </div>
              {open ? (
                <div className="ask-card-body">
                  <div className="ask-card-items">
                    {card.items.map((item) => (
                      <div key={`${card.id}-${item.label}`}>
                        <span>{item.flag ? <FlagAsset code={item.flag} label={`${item.label} flag`} /> : flagEmoji(item.flag ?? "")}</span>
                        <strong>{item.label}</strong>
                        {item.note ? <p>{item.note}</p> : null}
                        {item.regionId ? (
                          <button type="button" onClick={() => onSelectRegion(item.regionId!)}>
                            Open profile
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {card.compareIds ? (
                    <button type="button" className="compare-action" onClick={() => card.compareIds?.[0] && onSelectRegion(card.compareIds[0])}>
                      Compare
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {lightboxImage ? <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} /> : null}
    </section>
  );
}

function ImageLightbox({ image, onClose }: { image: LightboxImage; onClose: () => void }) {
  return (
    <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`${image.title} image preview`} onClick={onClose}>
      <div className="image-lightbox-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close image preview">×</button>
        <img src={image.src} alt={image.title} />
        <div>
          <strong>{image.title}</strong>
          {image.caption ? <span>{image.caption}</span> : null}
        </div>
      </div>
    </div>
  );
}

function PlaceImageCard({ image }: { image: PlaceImage }) {
  const [hidden, setHidden] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  useEffect(() => {
    setHidden(false);
  }, [image.imagePath]);
  if (hidden) return null;
  return (
    <>
      <button
        type="button"
        className="place-image-card"
        onClick={() => setLightboxImage({ src: image.imagePath, title: image.name, caption: `${image.type} reference for ${image.region}` })}
      >
        <img
          src={image.imagePath}
          alt={`${image.name} place reference`}
          loading="lazy"
          onError={() => setHidden(true)}
        />
        <span>
          <strong>{image.name}</strong>
        </span>
      </button>
      {lightboxImage ? <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} /> : null}
    </>
  );
}

function ProfileImageGallery({ title, images }: { title: string; images: PlaceImage[] }) {
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  return (
    <section className="profile-image-gallery">
      <div>
        <strong>{title}</strong>
        <em>{images.length}</em>
      </div>
      <div>
        {images.map((image) => (
          <button
            key={image.imagePath}
            type="button"
            onClick={() => setLightboxImage({ src: image.imagePath, title: image.name, caption: `${image.region} ${image.type} reference` })}
          >
            <img src={image.imagePath} alt={`${image.name} reference`} loading="lazy" />
            <span>{image.name}</span>
          </button>
        ))}
      </div>
      {lightboxImage ? <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} /> : null}
    </section>
  );
}

function subregionsFor(regionId: string) {
  const subregions: Record<string, string[]> = {
    "united-states": ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia", "Puerto Rico"],
    canada: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Nova Scotia", "New Brunswick", "Saskatchewan", "Newfoundland and Labrador"],
    brazil: ["Sao Paulo", "Rio de Janeiro", "Bahia", "Minas Gerais", "Parana", "Rio Grande do Sul", "Amazonas", "Pernambuco"],
    chile: ["Santiago Metropolitan Region", "Valparaiso Region", "Biobio Region", "Antofagasta Region", "Los Lagos Region", "Magallanes Region"],
    japan: ["Hokkaido", "Honshu", "Shikoku", "Kyushu", "Okinawa", "Kanto", "Kansai", "Chugoku"],
    australia: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", "Northern Territory"],
    "united-kingdom": ["England", "Scotland", "Wales", "Northern Ireland", "Greater London", "West Midlands"],
    "south-africa": ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State", "Mpumalanga", "Limpopo"],
    china: ["Beijing", "Shanghai", "Guangdong", "Sichuan", "Yunnan", "Xinjiang", "Tibet", "Hong Kong", "Macau", "Chongqing", "Tianjin", "Zhejiang", "Jiangsu", "Hubei", "Hunan", "Heilongjiang", "Fujian"],
    "hong-kong": ["Hong Kong Island", "Kowloon", "New Territories", "Lantau Island", "Outlying Islands", "Sha Tin", "Tsuen Wan", "Yuen Long"],
    india: ["Delhi", "Maharashtra", "Karnataka", "Tamil Nadu", "West Bengal", "Gujarat", "Uttar Pradesh", "Kerala"],
    indonesia: ["Java", "Sumatra", "Bali", "Kalimantan", "Sulawesi", "Papua"],
    argentina: ["Buenos Aires Province", "Cordoba", "Santa Fe", "Mendoza", "Patagonia", "Tierra del Fuego"],
    nigeria: ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"],
    russia: ["Moscow", "Saint Petersburg", "Siberia", "Far East", "Tatarstan", "Krasnodar Krai"],
    germany: ["Bavaria", "Berlin", "Hamburg", "Hesse", "North Rhine-Westphalia", "Saxony", "Baden-Wurttemberg", "Lower Saxony"],
    france: ["Ile-de-France", "Provence-Alpes-Cote d'Azur", "Occitanie", "Nouvelle-Aquitaine", "Brittany", "Corsica"],
    spain: ["Madrid", "Catalonia", "Andalusia", "Valencian Community", "Basque Country", "Galicia"],
    greece: ["Attica", "Central Macedonia", "Crete", "South Aegean", "Thessaly", "Western Greece", "Epirus"],
    morocco: ["Casablanca-Settat", "Rabat-Sale-Kenitra", "Marrakesh-Safi", "Tangier-Tetouan-Al Hoceima", "Fes-Meknes", "Souss-Massa"],
    algeria: ["Algiers", "Oran", "Constantine", "Annaba", "Adrar", "Tamanrasset"],
    egypt: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "South Sinai", "Suez"],
    "south-korea": ["Seoul Capital Area", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong", "Gyeonggi", "Gangwon", "North Chungcheong", "South Chungcheong", "North Jeolla", "South Jeolla", "North Gyeongsang", "South Gyeongsang", "Jeju"],
    portugal: ["Azores", "Madeira", "Lisbon", "Porto", "Setubal", "Braga", "Coimbra", "Faro", "Aveiro", "Leiria", "Viseu", "Evora", "Beja", "Vila Real", "Braganca", "Guarda", "Castelo Branco", "Portalegre", "Viana do Castelo", "Santarem"],
    uae: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah"],
    denmark: ["Zealand", "Jutland", "Funen", "Capital Region", "Aarhus Region"],
    thailand: ["Bangkok", "Chiang Mai", "Phuket", "Isan", "Chonburi", "Krabi"],
    finland: ["Uusimaa", "Lapland", "Southwest Finland", "Pirkanmaa", "North Ostrobothnia"],
    iceland: ["Capital Region", "Southern Peninsula", "South Iceland", "Westfjords", "North Iceland"],
    norway: ["Oslo", "Vestland", "Trondelag", "Troms", "Nordland", "Svalbard"],
    sweden: ["Stockholm County", "Vastra Gotaland", "Skane", "Norrbotten", "Uppsala County"],
    "new-zealand": ["North Island", "South Island", "Auckland Region", "Wellington Region", "Canterbury", "Otago"],
  };
  return subregions[regionId] ?? [];
}

function missingAssetMessage(name: string) {
  return `${name} still needs a regional image. Suggested asset types: flag, landmark, transit image, or regional capital image.`;
}

function nearbyDescriptionFor(region: Region) {
  if (region.id === "hungary") {
    return "Hungary sits in the heart of Central Europe. Explore how its rail and road connections link the Balkans, Central Europe, and Eastern Europe.";
  }
  if (region.maritime.some((item) => item.toLowerCase().includes("port") || item.toLowerCase().includes("ferr"))) {
    return `${region.name}'s nearby profiles help compare border, coastal, ferry, port, and airport corridors in the same neighborhood.`;
  }
  if (region.riversMountains.some((item) => /mountain|alps|andes|himalaya|river/i.test(item))) {
    return `${region.name}'s neighbors show how terrain, river valleys, border crossings, and rail corridors shape regional movement.`;
  }
  return `${region.name}'s nearby profiles show how neighboring countries connect through roads, rail, airports, borders, and shared regional geography.`;
}

function RegionAssetGrid({ region, subregions }: { region: Region; subregions: string[] }) {
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const [missingAsset, setMissingAsset] = useState<string | null>(null);
  const openAsset = (name: string) => {
    const imagePath = subdivisionImagePathForRegion(region.id, name);
    const flagPath = regionalFlagImagePathForName(region.id, name);
    const assetPath = imagePath || flagPath;
    if (assetPath) {
      setLightboxImage({ src: assetPath, title: name, caption: `${region.name} regional asset` });
      return;
    }
    setMissingAsset(name);
  };
  return (
    <details className="region-asset-panel">
      <summary>
        <span>Regional assets</span>
        <em>{subregions.length}</em>
      </summary>
      <div>
        {subregions.map((name) => {
          const imagePath = subdivisionImagePathForRegion(region.id, name);
          const flagPath = regionalFlagImagePathForName(region.id, name);
          const assetPath = imagePath || flagPath;
          return (
            <button
              key={name}
              type="button"
              className={assetPath ? "has-asset" : "needs-asset"}
              onClick={() => openAsset(name)}
            >
              {assetPath ? <img src={assetPath} alt="" loading="lazy" /> : <span>Needs assets</span>}
              <strong>{name}</strong>
              <em>{assetPath ? "assets" : "needs assets"}</em>
            </button>
          );
        })}
      </div>
      {missingAsset ? (
        <div className="missing-asset-note" role="status">
          <button type="button" onClick={() => setMissingAsset(null)} aria-label="Close missing asset note">×</button>
          <strong>{missingAsset}</strong>
          <p>{missingAssetMessage(missingAsset)}</p>
        </div>
      ) : null}
      {lightboxImage ? <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} /> : null}
    </details>
  );
}

function nearbyRegionsFor(regionId: string) {
  const nearbyIds: Record<string, string[]> = {
    hungary: ["austria", "slovakia", "ukraine", "romania", "serbia", "croatia", "slovenia"],
    iceland: ["greenland", "faroe-islands", "norway", "united-kingdom"],
    greenland: ["canada", "iceland", "faroe-islands", "denmark"],
    canada: ["united-states", "greenland", "st-pierre-and-miquelon"],
    "st-pierre-and-miquelon": ["canada", "greenland", "iceland"],
    australia: ["new-zealand", "papua-new-guinea", "indonesia", "timor-leste"],
    "new-zealand": ["australia", "fiji", "tonga", "samoa"],
    portugal: ["spain", "morocco", "france"],
    spain: ["portugal", "france", "morocco", "andorra"],
    turkey: ["greece", "bulgaria", "georgia", "armenia", "iran", "iraq", "syria", "cyprus"],
    romania: ["hungary", "ukraine", "moldova", "bulgaria", "serbia"],
    ukraine: ["poland", "slovakia", "hungary", "romania", "moldova", "belarus", "russia"],
    norway: ["sweden", "finland", "russia", "denmark", "iceland"],
    "united-kingdom": ["ireland", "france", "netherlands", "belgium", "faroe-islands", "iceland"],
    chile: ["argentina", "bolivia", "peru", "brazil", "uruguay", "paraguay"],
    argentina: ["chile", "uruguay", "paraguay", "bolivia", "brazil"],
    brazil: ["argentina", "uruguay", "paraguay", "bolivia", "peru", "colombia"],
    mexico: ["united-states", "guatemala", "belize", "honduras", "cuba"],
    cuba: ["jamaica", "bahamas", "haiti", "dominican-republic", "mexico", "united-states"],
    japan: ["south-korea", "taiwan", "china", "russia", "philippines"],
    morocco: ["spain", "algeria", "portugal", "tunisia", "mauritania"],
    algeria: ["morocco", "tunisia", "libya", "mali", "niger", "mauritania"],
    fiji: ["tonga", "samoa", "vanuatu", "new-zealand", "australia"],
    vietnam: ["cambodia", "laos", "thailand", "china", "philippines"],
    indonesia: ["malaysia", "singapore", "philippines", "australia", "papua-new-guinea", "timor-leste"],
    malaysia: ["singapore", "thailand", "indonesia", "brunei", "philippines"],
    egypt: ["libya", "sudan", "israel", "jordan", "saudi-arabia", "greece"],
    nigeria: ["benin", "niger", "chad", "cameroon", "ghana"],
    "south-africa": ["namibia", "botswana", "zimbabwe", "mozambique", "lesotho", "eswatini"],
  };
  const curatedNearbyIds = nearbyIds[regionId];
  if (curatedNearbyIds) {
    return curatedNearbyIds
    .map((id) => regions.find((region) => region.id === id))
    .filter((region): region is Region => Boolean(region));
  }
  const origin = capitalCoordinatesByRegionId[regionId];
  if (!origin) return [];
  return regions
    .filter((region) => region.id !== regionId && Boolean(capitalCoordinatesByRegionId[region.id]))
    .map((region) => ({ region, distance: coordinateDistance(origin, capitalCoordinatesByRegionId[region.id]) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6)
    .map((item) => item.region);
}

function coordinateDistance(a: [number, number], b: [number, number]) {
  const longitudeDelta = Math.abs(a[0] - b[0]);
  const wrappedLongitudeDelta = Math.min(longitudeDelta, 360 - longitudeDelta);
  const latitudeDelta = a[1] - b[1];
  return Math.hypot(wrappedLongitudeDelta * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180), latitudeDelta);
}

function CountryDiagram({ region }: { region: Region }) {
  const cities = [region.capital, ...region.majorCities].filter((item, index, array) => item && !item.includes("queued") && array.indexOf(item) === index).slice(0, 6);
  const landmarks = region.landmarks.slice(0, 5);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const activeLandmark = landmarks[activeImage] ?? landmarks[0] ?? region.name;
  const countryImage = countryImagePathForName(region.name);
  const previousImage = () => setActiveImage((index) => (index + landmarks.length - 1) % landmarks.length);
  const nextImage = () => setActiveImage((index) => (index + 1) % landmarks.length);

  return (
    <div className="country-diagram">
      <button
        type="button"
        className="country-profile-photo"
        onClick={() => countryImage && setLightboxImage({ src: countryImage, title: region.name, caption: region.capital.includes("queued") ? "Country profile image" : region.capital })}
      >
        <img src={countryImage} alt={`${region.name} profile view`} loading="lazy" />
        <span>
          <strong>{region.name}</strong>
          <em>{region.capital.includes("queued") ? "Capital profile" : region.capital}</em>
        </span>
      </button>
      <div className="country-shape">
        <span className="capital-pin">{region.capital.includes("queued") ? "Capital" : region.capital}</span>
        {cities.slice(1).map((city, index) => (
          <span key={city} className={`city-pin city-${index}`}>{city}</span>
        ))}
      </div>
      <div className="country-photo-carousel">
        <button type="button" onClick={previousImage} aria-label="Previous country image">Previous</button>
        <a className={`landmark-photo-tile tile-${activeImage}`} href={referenceUrlForItem("Landmarks", activeLandmark)} target="_blank" rel="noreferrer">
          <span>{activeLandmark}</span>
        </a>
        <button type="button" onClick={nextImage} aria-label="Next country image">Next</button>
      </div>
      <div className="country-photo-thumbs">
        {landmarks.map((landmark, index) => (
          <button key={landmark} className={activeImage === index ? "selected" : ""} onClick={() => setActiveImage(index)} title={landmark}>
            {index + 1}
          </button>
        ))}
      </div>
      {lightboxImage ? <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} /> : null}
    </div>
  );
}

function InfoGroup({ title, items, regionName, badge = false }: { title: string; items: string[]; regionName: string; badge?: boolean }) {
  const filteredItems = items.filter((item) => item && !isGenericProfileItem(title, item));
  if (filteredItems.length === 0) return null;
  return (
    <details className="info-group" open={["Major Cities", "Airports"].includes(title)}>
      <summary>
        <span>{title}</span>
        <em>{filteredItems.length}</em>
      </summary>
      <div className={badge ? "badge-list" : "chip-list"}>
        {filteredItems.map((item) => {
          if (!isReferenceClickable(title, item)) {
            return <span key={item}>{item}</span>;
          }
          return (
            <a key={item} href={referenceUrlForItem(title, item, regionName)} target="_blank" rel="noreferrer" title={`Open reference for ${item}`}>
              {item}
            </a>
          );
        })}
      </div>
    </details>
  );
}

function isGenericProfileItem(groupTitle: string, item: string) {
  const normalized = item.toLowerCase();
  const genericPatterns = [
    "largest commercial city",
    "primary airport city",
    "major regional city",
    "historic or port city",
    "primary international airport",
    "secondary airport",
    "capital gateway airport",
    "regional domestic airport",
    "cargo or charter airport",
    "national rail or intercity coach corridor",
    "capital-area commuter links",
    "main freight corridor",
    "regional cross-border corridor",
    "capital transit network",
    "airport/capital bus link",
    "regional commuter buses",
    "primary national highway",
    "airport road",
    "river/port access where applicable",
    "airport gateway area",
    "historic center",
    "quiz and map-study anchor",
    "full 193 un-country",
    "local transit profile covering",
    "harder quizzes can draw",
    "available in the country profile",
  ];
  if (genericPatterns.some((pattern) => normalized.includes(pattern))) return true;
  if (groupTitle === "Metro" && normalized === "local buses") return true;
  if (groupTitle === "Fun Facts" && normalized.length < 36) return true;
  return false;
}

function isReferenceClickable(groupTitle: string, item: string) {
  const normalized = item.toLowerCase();
  if (groupTitle === "Fun Facts") return false;
  if (normalized.includes(";")) return false;
  if (normalized.includes("no commercial airport") || normalized.includes("no railway") || normalized.includes("no national")) return false;
  if (normalized.includes("where available") || normalized.includes("static") || normalized.includes("pending")) return false;
  if (normalized.includes("clue") || normalized.includes("included in") || normalized.includes("profile")) return false;
  if (normalized.includes("primary international airport") || normalized.includes("secondary airport")) return false;
  if (normalized.includes("primary national highway") || normalized.includes("main freight corridor")) return false;
  if (normalized.includes("capital-area") || normalized.includes("capital transit") || normalized.includes("intercity rail/coach")) return false;
  if (normalized.includes("regional cross-border") || normalized.includes("regional commuter") || normalized.includes("cargo or charter")) return false;
  if (normalized.includes("platform") && !normalized.includes("station")) return false;
  if (["Landmarks", "Places of Interest", "Major Cities", "Rivers & Mountains"].includes(groupTitle)) return true;
  if (groupTitle === "Airports") return /\b[A-Z0-9]{3}\b/.test(item) || normalized.includes("airport") || normalized.includes("airfield") || normalized.includes("airstrip");
  if (groupTitle === "Highways") return /\d/.test(item) || /\b(road|highway|bridge|tunnel|expressway|motorway|causeway|pass|corridor)\b/.test(normalized);
  if (groupTitle === "Rail" || groupTitle === "Metro") return /\b(rail|railway|metro|tram|station|subway|light rail|brt|express|shinkansen|gautrain|u-bahn|s-bahn|tgv|ice|al boraq|brightline)\b/.test(normalized);
  if (groupTitle === "Maritime") return /\b(port|harbor|harbour|canal|strait|ferry|river|bay|sea|ocean|passage|lagoon|shipping)\b/.test(normalized);
  return false;
}

function referenceUrlForItem(groupTitle: string, item: string, regionName = "") {
  const normalized = item.toLowerCase();
  const exactReferences: Array<[RegExp, string]> = [
    [/shinkansen/, "https://en.wikipedia.org/wiki/Shinkansen"],
    [/\btgv\b/, "https://en.wikipedia.org/wiki/TGV"],
    [/\bice\b|intercity-express/, "https://en.wikipedia.org/wiki/Intercity_Express"],
    [/al boraq/, "https://en.wikipedia.org/wiki/Al_Boraq"],
    [/brightline/, "https://en.wikipedia.org/wiki/Brightline"],
    [/gotthard/, "https://en.wikipedia.org/wiki/Gotthard_Base_Tunnel"],
    [/pontchartrain/, "https://en.wikipedia.org/wiki/Lake_Pontchartrain_Causeway"],
  ];
  const exactMatch = exactReferences.find(([pattern]) => pattern.test(normalized));
  if (exactMatch) return exactMatch[1];
  if (groupTitle === "Airports" && /^[A-Z0-9]{3}$/.test(item)) {
    return `https://www.google.com/maps/search/${encodeURIComponent(`${item} airport`)}`;
  }
  const scopedItem = regionName ? `${item} ${regionName}` : item;
  return `https://www.google.com/maps/search/${encodeURIComponent(scopedItem)}`;
}

function ReviewTab({
  profile,
  showAnswers,
  onToggleAnswers,
  onReplay,
  onClear,
}: {
  profile: PlayerProfile;
  showAnswers: boolean;
  onToggleAnswers: () => void;
  onReplay: (question?: Question) => void;
  onClear: () => void;
}) {
  return (
    <section className="review-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Missed queue</p>
          <h2>{profile.incorrectAnswers.length} saved questions</h2>
        </div>
        <div className="button-row">
          <button onClick={onToggleAnswers}>{showAnswers ? "Hide Answers" : "Show Answers"}</button>
          <button onClick={() => downloadReviewFlashcards(profile)} disabled={profile.incorrectAnswers.length === 0}>Flashcards</button>
          <button onClick={onClear}>Clear Queue</button>
        </div>
      </div>
      <LearningTricks />
      <div className="review-list">
        {profile.incorrectAnswers.length === 0 && <div className="empty-state">No misses saved yet. Clean route board.</div>}
        {profile.incorrectAnswers.map((item) => (
          <article key={item.id} className="review-card">
            <div>
              <span className={`difficulty-pill ${levelTone[item.question.difficulty]}`}>{difficultyLabels[item.question.difficulty]}</span>
              <h3>{item.question.prompt}</h3>
              <p>{item.question.explanation}</p>
            </div>
            <div className="review-meta">
              <span>Your answer: {item.userAnswer}</span>
              {showAnswers && <strong>Correct: {item.question.answer}</strong>}
              <small>{new Date(item.dateMissed).toLocaleString()}</small>
              <button onClick={() => onReplay(item.question)}>Replay</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LearningTricks() {
  const quickTricks = [
    "Airport codes often preserve older names: JFK was Idlewild, so New York aviation questions may hide history inside the code clue.",
    "Metro systems usually follow anchors: airport branch, downtown transfer, university/medical stop, then outer terminal.",
    "Canals and straits are chokepoints: Panama links Atlantic/Pacific, Suez links Mediterranean/Red Sea, Malacca sits by Singapore and Malaysia.",
    "For capitals, pair one landmark with one transport node: Tokyo-Shinkansen, Paris-CDG/RER, London-Heathrow/Tube, Washington-Metro.",
    "For flags, learn regions by color families first, then symbols: Nordic crosses, Pan-African colors, Gulf flags, and Pacific island flags.",
  ];
  const deeperTricks = [
    "West Africa memory hook: many coastal capitals double as port clues, while inland countries often point to dry-port or neighboring-seaport corridors.",
    "Island flags are easier by ocean first: Caribbean flags cluster around ferry/cruise clues; Pacific flags often pair with atolls, lagoons, and small airport gateways.",
    "For rail questions, learn the named corridor before the country: Shinkansen-Japan, TGV-France, ICE-Germany, Al Boraq-Morocco, Brightline-Florida.",
    "For map-click questions, zoom by continent first, then coast/inland position: Estonia on the Baltic, Burundi inland by the Great Lakes, Kyrgyzstan in Central Asia.",
    "For airports, avoid memorizing every code at once. Group them by metro: NYC has JFK/LGA/EWR, London has LHR/LGW/STN, Tokyo has HND/NRT.",
    "For bridges and tunnels, attach one geography clue: Golden Gate-San Francisco Bay, Gotthard-Alps, Mont Blanc-France/Italy, Pontchartrain-Louisiana.",
    "For flags that look similar, use one detail: Zambia has the eagle and vertical color block; Pakistan has the crescent/star; Bangladesh has the red disc on green.",
  ];
  return (
    <div className="tricks-panel">
      <h3>Quick Memory Tricks</h3>
      {quickTricks.map((trick) => <p key={trick}>{trick}</p>)}
      <details>
        <summary>Expand to learn more tricks</summary>
        {deeperTricks.map((trick) => <p key={trick}>{trick}</p>)}
      </details>
    </div>
  );
}

function ProfileTab({
  profile,
  profiles,
  friends,
  accuracy,
  onNameChange,
  onEmojiChange,
  onGuestChange,
  onReset,
  onCreateProfile,
  onSwitchProfile,
  onDeleteProfile,
  onAddFriend,
  onRemoveFriend,
}: {
  profile: PlayerProfile;
  profiles: PlayerProfile[];
  friends: LocalFriend[];
  accuracy: number;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string) => void;
  onGuestChange: (isGuest: boolean) => void;
  onReset: () => void;
  onCreateProfile: () => void;
  onSwitchProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onAddFriend: (friend: Omit<LocalFriend, "id">) => void;
  onRemoveFriend: (friendId: string) => void;
}) {
  const [showFlagLibrary, setShowFlagLibrary] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [friendName, setFriendName] = useState("");
  const [friendEmoji, setFriendEmoji] = useState("🚇");
  useEffect(() => {
    setDraftName(profile.name);
  }, [profile.id, profile.name]);
  const localProfiles = profiles
    .filter((item, index, array) => array.findIndex((profileItem) => profileItem.id === item.id) === index)
    .sort((a, b) => (b.totalAnswered - a.totalAnswered) || a.name.localeCompare(b.name));
  const profileAccuracy = (item: PlayerProfile) => item.totalAnswered ? Math.round((item.totalCorrect / item.totalAnswered) * 100) : 100;
  const countryFlagOptions = regions
    .filter((region) => /^[A-Z]{2}$/.test(region.flag))
    .map((region) => ({ name: region.name, emoji: flagEmoji(region.flag), image: flagImageSrc(region.flag) }))
    .filter((option, index, array) => array.findIndex((item) => item.emoji === option.emoji) === index)
    .sort((a, b) => a.name.localeCompare(b.name));
  const emojiGroups = [
    { label: "Transit", options: ["🚇", "✈️", "🚄", "🗺️", "🚢", "🚌", "🚦", "🛰️", "🌉", "🧭"] },
    { label: "Animals", options: ["🐆", "🦅", "🦁", "🐘", "🐼", "🐬", "🐻", "🦊", "🐺", "🐯", "🦓", "🦒", "🦏", "🦛", "🐪", "🦘", "🐢", "🐋"] },
  ];
  const categoryRows = Object.entries(profile.categoryStats)
    .map(([category, stat]) => ({
      category,
      answered: stat.answered,
      accuracy: stat.answered ? Math.round((stat.correct / stat.answered) * 100) : 0,
    }))
    .sort((a, b) => b.answered - a.answered);
  const strongest = [...categoryRows].sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakest = [...categoryRows].filter((row) => row.answered > 0).sort((a, b) => a.accuracy - b.accuracy)[0];
  const saveFriend = () => {
    const name = friendName.trim();
    if (!name) return;
    onAddFriend({
      name,
      emoji: friendEmoji,
      highScore: 0,
      accuracy: 100,
      totalAnswered: 0,
    });
    setFriendName("");
  };
  const addFromContacts = async () => {
    const contactsApi = (navigator as Navigator & {
      contacts?: {
        select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[] }>>;
      };
    }).contacts;
    if (!contactsApi) {
      alert("Contact import is not available in this browser. Add the friend manually for now.");
      return;
    }
    const contacts = await contactsApi.select(["name"], { multiple: true });
    contacts.forEach((contact) => {
      const name = contact.name?.[0]?.trim();
      if (name) onAddFriend({ name, emoji: "👤", highScore: 0, accuracy: 100, totalAnswered: 0 });
    });
  };

  return (
    <section className="profile-layout">
      <div className="profile-editor">
        <p className="eyebrow">Local profile</p>
        <h2>{profile.isGuest ? "Guest mode" : "Named operator"}</h2>
        <div className="profile-switcher">
          <label>
            Saved profiles
            <select value={profile.id} onChange={(event) => onSwitchProfile(event.target.value)}>
              {localProfiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.emoji} {item.name || "Unnamed operator"} · {profileAccuracy(item)}%
                </option>
              ))}
            </select>
          </label>
          <div className="profile-switcher-actions">
            {localProfiles.length === 0 && <button type="button" onClick={onCreateProfile}>Create Profile</button>}
            <button type="button" onClick={() => onDeleteProfile(profile.id)}>Delete Current Profile</button>
          </div>
        </div>
        <label>
          Operator name
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Create your username" />
        </label>
        <button type="button" className="primary-action" onClick={() => onNameChange(draftName.trim())}>Save Username</button>
        <div className="emoji-picker" aria-label="Profile emoji">
          {emojiGroups.map((group) => (
            <div className="emoji-section" key={group.label}>
              <span>{group.label}</span>
              <div>
                {group.options.map((emoji) => (
                  <button
                    key={emoji}
                    className={(profile.emoji ?? "🚇") === emoji ? "selected" : ""}
                    onClick={() => onEmojiChange(emoji)}
                    aria-label={`Use ${emoji} profile icon`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="emoji-section flag-library-section">
            <span>All country flags</span>
            <button
              type="button"
              className="flag-library-toggle"
              onClick={() => setShowFlagLibrary((open) => !open)}
              aria-expanded={showFlagLibrary}
            >
              {profile.emoji ?? "🚇"} {showFlagLibrary ? "Hide country flags" : "Open country flag picker"}
            </button>
            {showFlagLibrary && (
              <div className="flag-library" role="dialog" aria-label="All country flag emojis">
                {countryFlagOptions.map((option) => (
                  <button
                    key={`${option.name}-${option.emoji}`}
                    type="button"
                    className={profile.emoji === option.emoji ? "selected" : ""}
                    onClick={() => onEmojiChange(option.emoji)}
                    title={option.name}
                    aria-label={`Use ${option.name} flag`}
                  >
                    <span>{option.image ? <img src={option.image} alt="" /> : option.emoji}</span>
                    <em>{option.name}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="segmented">
          <button className={!profile.isGuest ? "selected" : ""} onClick={() => onGuestChange(false)}>Named</button>
          <button className={profile.isGuest ? "selected" : ""} onClick={() => onGuestChange(true)}>Guest</button>
        </div>
        <button onClick={onReset}>Reset Local Profile</button>
      </div>
      <div className="profile-stats">
        <Metric label="High Score" value={profile.highScore.toString()} />
        <Metric label="Answered" value={profile.totalAnswered.toString()} />
        <Metric label="Accuracy" value={`${accuracy}%`} />
        <Metric label="Current Level" value={difficultyLabels[profile.currentDifficulty]} />
        <Metric label="Strongest" value={strongest ? categoryLabels[strongest.category as keyof typeof categoryLabels] : "Pending"} />
        <Metric label="Weakest" value={weakest ? categoryLabels[weakest.category as keyof typeof categoryLabels] : "Pending"} />
      </div>
      <LocalLeaderboard profile={profile} profiles={profiles} friends={friends} />
      <div className="category-table">
        {categoryRows.length === 0 && <div className="empty-state">Category telemetry appears after the first run.</div>}
        {categoryRows.map((row) => (
          <div key={row.category} className="category-row">
            <span>{categoryLabels[row.category as keyof typeof categoryLabels]}</span>
            <strong>{row.accuracy}%</strong>
            <em>{row.answered} answered</em>
          </div>
        ))}
      </div>
      <div className="friends-panel">
        <div>
          <p className="eyebrow">Friends</p>
          <h2>Local friend board</h2>
          <p>Friends are saved on this device. Live mutual stats need accounts and a backend later.</p>
        </div>
        <div className="friend-form">
          <input value={friendEmoji} onChange={(event) => setFriendEmoji(event.target.value)} aria-label="Friend emoji" maxLength={4} />
          <input value={friendName} onChange={(event) => setFriendName(event.target.value)} placeholder="Friend name" />
          <button type="button" onClick={saveFriend}>Add Friend</button>
          <button type="button" onClick={addFromContacts}>Add From Contacts</button>
        </div>
        <div className="friend-list">
          {friends.length === 0 && <div className="empty-state">Add people to compare local stats.</div>}
          {friends.map((friend) => (
            <article key={friend.id} className="friend-card">
              <strong>{friend.emoji} {friend.name}</strong>
              <span>{friend.accuracy}% accuracy</span>
              <span>{friend.highScore} high score</span>
              <button type="button" onClick={() => onRemoveFriend(friend.id)}>Remove</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default App;
