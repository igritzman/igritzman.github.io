export type TransitTimeMachineEraKey = "early" | "mid" | "modern";

export type TransitTimeMachineEra = {
  key: string;
  phase: TransitTimeMachineEraKey;
  label: string;
  year: number;
  searchQueries: string[];
  preferredSources: string[];
  imageUrl: string;
  sourceUrl: string;
  license: string;
  caption: string;
  needsAsset: boolean;
};

export type TransitTimeMachineEntry = {
  city: string;
  country: string;
  system: string;
  mapQuery: string;
  eras: TransitTimeMachineEra[];
};

const assetRoot = "/assets/transit-time-machine";
const userArchiveSource = "user-provided://Transit Time Machine archives";

function era(
  key: TransitTimeMachineEraKey,
  label: string,
  year: number,
  queries: string[],
  caption: string,
  file = "",
  archive = "Metro Images (2).zip",
): TransitTimeMachineEra {
  const imageUrl = file ? `${assetRoot}/${file}` : "";
  return {
    key,
    phase: key,
    label,
    year,
    searchQueries: queries,
    preferredSources: key === "modern"
      ? ["official transit operator", "Wikimedia Commons", "Wikipedia"]
      : ["Wikimedia Commons", "official transit archives", "municipal archives"],
    imageUrl,
    sourceUrl: imageUrl ? `${userArchiveSource}/${archive}/${file}` : "",
    license: imageUrl ? "User-provided archive; reuse rights require verification" : "",
    caption,
    needsAsset: !imageUrl,
  };
}

function network(
  city: string,
  country: string,
  system: string,
  years: [number, number, number],
  captions: [string, string, string],
  files: [string, string, string],
): TransitTimeMachineEntry {
  const slug = city.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return {
    city,
    country,
    system,
    mapQuery: exactCityMapQueries[city] ?? `${city}, ${country}`,
    eras: [
      era("early", "Early network", years[0], [
        `${city} transit map ${years[0]}`,
        `${city} historical railway map opening era`,
        `${system} early network map`,
      ], captions[0], files[0], "Transit Assets.zip"),
      era("mid", "Expansion era", years[1], [
        `${city} transit map ${years[1]}`,
        `${city} metro map mid century`,
        `${system} historical expansion map`,
      ], captions[1], files[1], "Transit Assets.zip"),
      era("modern", "Current network", years[2], [
        `${city} transit map current`,
        `${city} metro route map English`,
        `${slug} rail network map official`,
      ], captions[2], files[2]),
    ],
  };
}

const exactCityMapQueries: Record<string, string> = {
  London: "London, England, United Kingdom",
  "New York": "New York City, New York, United States",
  Sydney: "Sydney, New South Wales, Australia",
  "Washington DC": "Washington, DC, United States",
  Toronto: "Toronto, Ontario, Canada",
  "Mexico City": "Mexico City, Mexico",
  "Sao Paulo": "Sao Paulo, Brazil",
  "Hong Kong": "Hong Kong, China",
};

function timelineEra(
  city: string,
  year: number,
  label: string,
  file: string,
  caption: string,
  phase: TransitTimeMachineEraKey,
): TransitTimeMachineEra {
  const item = era(phase, label, year, [
    `${city} transit map ${year}`,
    `${city} historical transit network ${year}`,
  ], caption, file, "Transit Assets (3).zip");
  return { ...item, key: String(year), phase };
}

function timeline(
  city: string,
  country: string,
  system: string,
  eras: TransitTimeMachineEra[],
): TransitTimeMachineEntry {
  return {
    city,
    country,
    system,
    mapQuery: exactCityMapQueries[city] ?? `${city}, ${country}`,
    eras: [...eras].sort((a, b) => a.year - b.year),
  };
}

export const transitTimeMachineImages: TransitTimeMachineEntry[] = [
  network("Tokyo", "Japan", "Tokyo subway / rail network", [1927, 1964, 2026], [
    "Tokyo's first subway era, centered on the Ginza Line.",
    "Tokyo's rail network during the rapid postwar and Olympics-era expansion.",
    "Modern Tokyo Metro and connected urban rail network.",
  ], ["tokyo-early.jpg", "tokyo-mid.jpg", "tokyo-modern.png"]),
  network("London", "United Kingdom", "London Underground", [1863, 2010, 2026], [
    "The Metropolitan Railway opened the world's first underground passenger railway.",
    "Postwar London consolidated and extended the familiar Underground network.",
    "The current Tube network and its cross-London connections.",
  ], ["london-early.jpg", "london-mid.webp", "london-modern.png"]),
  network("New York", "United States", "New York City Subway", [1904, 1950, 2026], [
    "The first IRT subway connected City Hall with Upper Manhattan.",
    "The unified postwar system linked former IRT, BMT, and IND routes.",
    "The modern subway network across four boroughs.",
  ], ["new-york-early.jpg", "new-york-mid.jpg", "new-york-modern.jpg"]),
  network("Sydney", "Australia", "Sydney suburban rail / Metro", [1855, 1932, 2026], [
    "Sydney's first railway began the city's radial suburban network.",
    "The Harbour Bridge era reshaped rail access to the north shore.",
    "Sydney Metro and suburban rail form a growing multi-layer network.",
  ], ["sydney-early.jpg", "sydney-mid.jpg", "sydney-modern.jpg"]),
  network("Shanghai", "China", "Shanghai urban rail", [1908, 2010, 2026], [
    "Shanghai opened its first metro line in the early 1990s.",
    "Expo-era construction accelerated the network's expansion.",
    "One of the world's largest rapid-transit networks serves metropolitan Shanghai.",
  ], ["shanghai-early.webp", "shanghai-mid.png", "shanghai-modern.png"]),
  network("Taipei", "Taiwan", "Taipei Metro", [1996, 2008, 2026], [
    "The Muzha Line introduced modern rapid transit to Taipei.",
    "Cross-city lines turned the initial corridors into a connected network.",
    "The current MRT links Taipei and New Taipei with airport and regional rail.",
  ], ["taipei-early.png", "", "taipei-modern.png"]),
  network("Tashkent", "Uzbekistan", "Tashkent Metro", [1977, 1991, 2026], [
    "Central Asia's first metro opened with ornate stations and one initial line.",
    "The network expanded as Tashkent entered the post-Soviet era.",
    "The modern system combines legacy lines with new orbital extensions.",
  ], ["tashkent-early.jpg", "", "tashkent-modern.jpg"]),
  timeline("Washington DC", "United States", "Washington Metro", [
    timelineEra("Washington DC", 1976, "Opening network", "washington-dc-1976.png", "Metro opened its first Red Line stations between Farragut North and Rhode Island Avenue.", "early"),
    timelineEra("Washington DC", 1977, "Regional expansion", "washington-dc-1977.png", "The first extensions began carrying Metro beyond the original downtown segment.", "early"),
    timelineEra("Washington DC", 1978, "Orange Line era", "washington-dc-1978.png", "Orange Line service added a major east-west spine through the monumental core.", "early"),
    timelineEra("Washington DC", 1979, "Northern growth", "washington-dc-1979.png", "New stations extended the young system farther into the region.", "early"),
    timelineEra("Washington DC", 1980, "Blue Line growth", "washington-dc-1980.png", "The Blue Line strengthened the cross-Potomac regional connection.", "mid"),
    timelineEra("Washington DC", 1981, "Connected core", "washington-dc-1981.png", "More of the planned five-line framework was now visible on the map.", "mid"),
    timelineEra("Washington DC", 1984, "Red Line expansion", "washington-dc-1984.png", "The Red Line reached farther into Montgomery County as the system matured.", "mid"),
    timelineEra("Washington DC", 1986, "Four-line network", "washington-dc-1986.png", "Rapid expansion turned Metro into a genuinely regional network.", "mid"),
    timelineEra("Washington DC", 1990, "Green Line begins", "washington-dc-1990.png", "The first Green Line segment introduced the fifth color of the original plan.", "mid"),
    timelineEra("Washington DC", 1991, "Green Line grows", "washington-dc-1991.png", "New Green Line service filled important gaps in the District.", "mid"),
    timelineEra("Washington DC", 1994, "Maturing system", "washington-dc-1994.png", "Metro's five-line structure increasingly resembled the planned regional system.", "mid"),
    timelineEra("Washington DC", 2004, "New York Avenue era", "washington-dc-2004.png", "An infill station opened at New York Avenue, later renamed NoMa–Gallaudet U.", "mid"),
    timelineEra("Washington DC", 2006, "Regional infill", "washington-dc-2006.png", "The established network continued to add access and prepare for its next major branch.", "mid"),
    timelineEra("Washington DC", 2012, "Silver Line construction", "washington-dc-2012.png", "The map anticipated the new route through Tysons toward Dulles.", "mid"),
    timelineEra("Washington DC", 2014, "Silver Line opens", "washington-dc-2014.png", "Silver Line service reached Tysons and Reston, reshaping the western network.", "modern"),
    timelineEra("Washington DC", 2017, "SafeTrack era", "washington-dc-2017.png", "The six-line system focused on renewal while regional growth continued.", "modern"),
    timelineEra("Washington DC", 2022, "Dulles connection", "washington-dc-2022.png", "The Silver Line extension finally connected Metro with Dulles Airport and Loudoun County.", "modern"),
    timelineEra("Washington DC", 2026, "Current network", "washington-dc-2026.png", "Today's six-line system connects the District, Maryland, Virginia, and both major airports.", "modern"),
  ]),
  timeline("Toronto", "Canada", "Toronto subway", [
    timelineEra("Toronto", 1954, "Opening network", "toronto-early.jpg", "Canada's first subway opened beneath Yonge Street.", "early"),
    timelineEra("Toronto", 2000, "Integrated city network", "toronto-mid.png", "The 2000 map shows TTC rapid transit and streetcar corridors across the amalgamated city.", "mid"),
    timelineEra("Toronto", 2016, "Pre-extension network", "toronto-2016.png", "The network immediately before the Line 1 extension to Vaughan shows its established urban spine.", "mid"),
    timelineEra("Toronto", 2026, "Current network", "toronto-modern.png", "Today's TTC subway connects with streetcars, buses, and regional GO services.", "modern"),
  ]),
  network("Madrid", "Spain", "Madrid Metro", [1919, 2010, 2026], [
    "Madrid's first metro linked Sol and Cuatro Caminos.",
    "Mid-century extensions pushed rapid transit beyond the historic center.",
    "The current network is among Europe's largest by route length.",
  ], ["madrid-early.jpg", "madrid-mid.jpg", "madrid-modern.png"]),
  network("Paris", "France", "Paris Metro / RER", [1900, 2010, 2026], [
    "Paris opened Métro Line 1 for the 1900 Exposition.",
    "Dense infill and extensions made the Métro a defining part of daily Paris.",
    "Métro, RER, tram, and Grand Paris projects form the modern network.",
  ], ["paris-early.jpg", "paris-mid.jpg", "paris-modern.png"]),
  network("Copenhagen", "Denmark", "Copenhagen S-train / Metro", [1934, 2002, 2026], [
    "The S-train introduced electrified suburban service to Copenhagen.",
    "The automated Metro added a new rapid-transit layer at the turn of the century.",
    "Metro, S-train, regional rail, and the Øresund link now operate together.",
  ], ["", "", "copenhagen-modern.png"]),
  network("Warsaw", "Poland", "Warsaw Metro / tram network", [1925, 1995, 2026], [
    "Early plans imagined a rapid-transit spine beneath a growing Warsaw.",
    "The first Metro line finally opened after decades of interruption and rebuilding.",
    "Metro, tram, and suburban rail now support a resilient regional network.",
  ], ["warsaw-early.jpg", "warsaw-mid.jpg", "warsaw-modern.png"]),
  network("Oslo", "Norway", "Oslo T-bane", [1898, 1966, 2026], [
    "Suburban railways began climbing from Oslo toward surrounding communities.",
    "The eastern and western systems moved toward a unified metro.",
    "The T-bane, tram, ferry, and regional rail form Oslo's integrated network.",
  ], ["", "", "oslo-modern.avif"]),
  network("Buenos Aires", "Argentina", "Buenos Aires Subte", [1913, 1950, 2026], [
    "Line A made Buenos Aires the first Latin American city with a subway.",
    "Several private-era lines had become a recognizable central network.",
    "The Subte works with commuter rail and Metrobus across Greater Buenos Aires.",
  ], ["buenos-aires-early.jpg", "buenos-aires-mid.jpg", "buenos-aires-modern.png"]),
  network("Sao Paulo", "Brazil", "São Paulo Metro / CPTM", [1974, 2000, 2026], [
    "The North-South Line introduced metro service to São Paulo.",
    "Metro and suburban rail integration began reshaping metropolitan mobility.",
    "A vast Metro and CPTM network serves Brazil's largest urban region.",
  ], ["", "", "sao-paulo-modern.png"]),
  network("Mexico City", "Mexico", "Mexico City Metro", [1969, 1985, 2026], [
    "The first three Metro lines opened during rapid metropolitan growth.",
    "Expansion created a multi-line network reaching beyond the historic center.",
    "Metro, Metrobús, Cablebús, trolleybus, and suburban rail now overlap.",
  ], ["", "", "mexico-city-modern.jpg"]),
  network("Istanbul", "Turkey", "Istanbul rail network", [1875, 2000, 2026], [
    "The Tünel became one of the world's earliest underground urban railways.",
    "Modern metro and light-rail corridors began to connect the growing metropolis.",
    "Metro, Marmaray, tram, funicular, ferry, and commuter rail span two continents.",
  ], ["istanbul-early.jpg", "", "istanbul-modern.png"]),
  network("Berlin", "Germany", "Berlin U-Bahn / S-Bahn", [1902, 1961, 2026], [
    "Berlin's elevated and underground railway opened at the start of the 20th century.",
    "Division transformed routes and stations on both sides of the Berlin Wall.",
    "The reunified U-Bahn and S-Bahn once again operate as one regional network.",
  ], ["berlin-early.jpg", "", "berlin-modern.png"]),
  network("Hong Kong", "China", "Hong Kong MTR", [1979, 2007, 2026], [
    "The Modified Initial System introduced high-capacity metro service.",
    "Rail mergers and new cross-harbour links broadened the regional network.",
    "The MTR integrates dense urban lines, new territories routes, and airport rail.",
  ], ["", "", "hong-kong-modern.png"]),
];
