export type TransitTimeMachineEraKey = "early" | "mid" | "modern";

export type TransitTimeMachineEra = {
  key: TransitTimeMachineEraKey;
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
  network("Washington DC", "United States", "Washington Metro", [1978, 1984, 2026], [
    "Metro opened its first Red Line segment in the monumental core.",
    "The original five-line plan matured into a regional network.",
    "The current system includes the Silver Line connection toward Dulles Airport.",
  ], ["washington-dc-early.png", "washington-dc-mid.png", "washington-dc-modern.png"]),
  network("Toronto", "Canada", "Toronto subway", [1954, 2010, 2026], [
    "Canada's first subway opened beneath Yonge Street.",
    "The Bloor-Danforth and Spadina corridors created a wider rapid-transit grid.",
    "Today's TTC subway connects with streetcars, buses, and regional GO services.",
  ], ["toronto-early.jpg", "toronto-mid.png", "toronto-modern.png"]),
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
  network("Addis Ababa", "Ethiopia", "Addis Ababa Light Rail", [2015, 2020, 2026], [
    "Africa's first modern light-rail system opened with two crossing corridors.",
    "The initial network settled into daily operation across the capital.",
    "The current system remains a landmark experiment in African urban rail.",
  ], ["", "", "addis-ababa-modern.png"]),
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
  network("Jerusalem", "Israel", "Jerusalem Light Rail", [2011, 2020, 2026], [
    "The Red Line introduced modern tram service across Jerusalem.",
    "Operating experience set the stage for a broader light-rail program.",
    "The expanding network links major civic, residential, and historic districts.",
  ], ["", "", "jerusalem-modern.png"]),
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
  network("Abu Dhabi", "United Arab Emirates", "Abu Dhabi public transport plan", [2008, 2020, 2026], [
    "Early master plans proposed rail corridors for a rapidly growing capital.",
    "Bus reform and future metro planning shaped the expansion era.",
    "Current plans emphasize integrated bus, rapid-transit, and intercity links.",
  ], ["", "", "abu-dhabi-modern.jpg"]),
  network("Dubai", "United Arab Emirates", "Dubai Metro", [2009, 2020, 2026], [
    "The Red Line opened as the Arabian Peninsula's first major urban metro.",
    "Route 2020 extended automated rail toward the Expo site.",
    "Metro, tram, buses, and marine transit support a fast-growing city.",
  ], ["", "", "dubai-modern.jpg"]),
  network("Hong Kong", "China", "Hong Kong MTR", [1979, 2007, 2026], [
    "The Modified Initial System introduced high-capacity metro service.",
    "Rail mergers and new cross-harbour links broadened the regional network.",
    "The MTR integrates dense urban lines, new territories routes, and airport rail.",
  ], ["", "", "hong-kong-modern.png"]),
];
