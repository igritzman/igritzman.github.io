export type PlaceImportance = {
  id: string;
  title: string;
  capitalNote: string;
  transitHighlights: string[];
  geographicHighlights: string[];
  majorNonCapitalCities: string[];
  regionalNotes: string[];
};

export const placeImportance: PlaceImportance[] = [
  {
    id: "colombia",
    title: "Why Colombia matters",
    capitalNote: "Bogotá is the national government center and the hub of the TransMilenio BRT network.",
    transitHighlights: ["Medellín’s Metrocable is one of the world’s best-known examples of cable cars operating as everyday urban transit."],
    geographicHighlights: ["Andean valleys and steep mountain slopes make cable cars, winding highways, and regional aviation especially important."],
    majorNonCapitalCities: ["Medellín", "Cali", "Barranquilla", "Cartagena"],
    regionalNotes: ["Medellín Metro, regional airports, Caribbean ports, and intercity corridors connect very different elevations and coasts."],
  },
  {
    id: "japan",
    title: "Why Japan matters",
    capitalNote: "Tokyo is the capital and the center of the world’s largest concentration of urban rail services.",
    transitHighlights: ["The Shinkansen forms a high-speed spine across Honshu, linking Tokyo with Nagoya, Kyoto, Osaka, and cities farther west and north."],
    geographicHighlights: ["Mountainous islands concentrate settlement and railways into coastal corridors, while ferries and aviation reach more distant islands."],
    majorNonCapitalCities: ["Osaka", "Kyoto", "Nagoya", "Fukuoka", "Sapporo"],
    regionalNotes: ["Hokkaido’s Sapporo network and Kyushu’s rail hubs show how regional systems extend beyond the Tokyo–Osaka corridor."],
  },
  {
    id: "united-states",
    title: "Why the United States matters",
    capitalNote: "Washington, D.C. is the federal capital and is served by the Washington Metro, commuter rail, and intercity Northeast Corridor trains.",
    transitHighlights: ["New York Subway, Chicago ‘L’, Boston MBTA, BART/Muni, Los Angeles Metro, Seattle Link, Denver RTD, Dallas DART, and Atlanta MARTA show the variety of local networks."],
    geographicHighlights: ["Continental distances make aviation and highways dominant, while dense metropolitan corridors support rail, subway, and light-rail systems."],
    majorNonCapitalCities: ["New York", "Chicago", "Los Angeles", "San Francisco", "Miami", "Atlanta"],
    regionalNotes: ["Florida’s Brightline is a notable modern private intercity rail service linking Miami, Fort Lauderdale, West Palm Beach, and Orlando."],
  },
  {
    id: "australia",
    title: "Why Australia matters",
    capitalNote: "Canberra is the national capital and has a growing light-rail spine.",
    transitHighlights: ["Sydney combines Sydney Trains, Sydney Metro, ferries, and light rail; Melbourne is defined by its extensive tram and suburban-rail networks."],
    geographicHighlights: ["Large distances and a sparsely populated interior concentrate transit in coastal cities and make domestic aviation essential."],
    majorNonCapitalCities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
    regionalNotes: ["Perth’s rail network, Brisbane’s commuter rail and ferries, and island links to Tasmania broaden the national transport story."],
  },
  {
    id: "brazil",
    title: "Why Brazil matters",
    capitalNote: "Brasília is the planned federal capital, shaped around monumental avenues and bus-oriented travel.",
    transitHighlights: ["São Paulo is Brazil’s largest transit hub, where the Metro and CPTM urban rail network move passengers across a vast metropolitan region."],
    geographicHighlights: ["Immense distances, the Amazon basin, coastal mountain ranges, and dense southeastern cities create sharply different transport needs."],
    majorNonCapitalCities: ["São Paulo", "Rio de Janeiro", "Salvador", "Belo Horizonte", "Recife"],
    regionalNotes: ["Rio de Janeiro’s metro, suburban rail, ferries, and BRT connect coastal neighborhoods separated by bays and mountains."],
  },
  {
    id: "turkey",
    title: "Why Turkey matters",
    capitalNote: "Ankara is the capital and a major high-speed-rail and metro hub in central Anatolia.",
    transitHighlights: ["Istanbul’s ferries, Marmaray, metro, and trams connect Europe and Asia across and beneath the Bosphorus."],
    geographicHighlights: ["Turkey bridges the Balkans, Black Sea, Caucasus, Mediterranean, and Middle East, making its straits and plateau corridors globally significant."],
    majorNonCapitalCities: ["Istanbul", "İzmir", "Bursa", "Antalya", "Konya"],
    regionalNotes: ["İzmir’s suburban rail and ferries and expanding metro systems in Bursa and other cities show a transport story well beyond Ankara."],
  },
  {
    id: "canada",
    title: "Why Canada matters",
    capitalNote: "Ottawa is the federal capital and is served by the O-Train and intercity rail corridor.",
    transitHighlights: ["Toronto’s TTC and GO Transit, Montréal Metro, and Vancouver SkyTrain are the country’s most prominent metropolitan networks."],
    geographicHighlights: ["Most Canadians live near the southern border, while huge northern distances depend more heavily on aviation, ferries, and seasonal transport."],
    majorNonCapitalCities: ["Toronto", "Montréal", "Vancouver", "Calgary", "Edmonton"],
    regionalNotes: ["The Québec City–Windsor corridor concentrates population, intercity rail, highways, and several of Canada’s busiest airports."],
  },
  {
    id: "france",
    title: "Why France matters",
    capitalNote: "Paris is the capital and the center of the Métro, RER, and national rail network.",
    transitHighlights: ["TGV high-speed lines radiate from Paris while regional TER services and city tram networks connect the rest of France."],
    geographicHighlights: ["Atlantic, Mediterranean, Alpine, and cross-Channel geography makes France a major European rail, road, aviation, and maritime crossroads."],
    majorNonCapitalCities: ["Lyon", "Marseille", "Lille", "Bordeaux", "Toulouse", "Strasbourg"],
    regionalNotes: ["Lyon is a major national rail junction; Marseille combines metro, tram, port, and Mediterranean ferry connections."],
  },
  {
    id: "germany",
    title: "Why Germany matters",
    capitalNote: "Berlin is the capital and is served by an extensive U-Bahn, S-Bahn, tram, and regional-rail network.",
    transitHighlights: ["ICE high-speed trains link a decentralized group of major hubs including Frankfurt, Munich, Hamburg, Cologne, and Berlin."],
    geographicHighlights: ["Germany’s central European position makes it a key north–south and east–west passenger and freight corridor."],
    majorNonCapitalCities: ["Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart"],
    regionalNotes: ["Munich and Hamburg have integrated U-Bahn/S-Bahn systems, while Frankfurt is one of Europe’s most important rail and aviation hubs."],
  },
  {
    id: "spain",
    title: "Why Spain matters",
    capitalNote: "Madrid is the capital and the radial center of the Metro, Cercanías, and AVE high-speed network.",
    transitHighlights: ["Barcelona adds a major Metro, commuter-rail, tram, port, and international corridor facing the Mediterranean."],
    geographicHighlights: ["A high central plateau, mountain barriers, long coasts, and island regions shape Spain’s radial railways, ports, and aviation."],
    majorNonCapitalCities: ["Barcelona", "Valencia", "Seville", "Bilbao", "Málaga"],
    regionalNotes: ["AVE links major mainland cities, while the Canary and Balearic Islands depend on airports, ferries, buses, and selected rail systems."],
  },
  {
    id: "portugal",
    title: "Why Portugal matters",
    capitalNote: "Lisbon is the capital and combines Metro, suburban rail, ferries, trams, and an Atlantic port.",
    transitHighlights: ["Porto Metro and suburban rail connect the Douro estuary with northern Portugal and the airport."],
    geographicHighlights: ["Portugal faces the Atlantic, so ports, coastal rail, and aviation are central to both mainland and island mobility."],
    majorNonCapitalCities: ["Porto", "Braga", "Coimbra", "Faro"],
    regionalNotes: ["Madeira and the Azores rely on aviation, ferries, buses, and island-specific infrastructure rather than mainland rail."],
  },
  {
    id: "mexico",
    title: "Why Mexico matters",
    capitalNote: "Mexico City is the capital and anchors the Metro, Metrobús, Cablebús, trolleybus, and Tren Suburbano networks.",
    transitHighlights: ["Monterrey’s Metrorrey and Guadalajara’s light-rail system show that major rapid-transit networks extend well beyond the capital."],
    geographicHighlights: ["High plateaus, mountain ranges, deserts, and two long coastlines shape road, rail, airport, and port corridors."],
    majorNonCapitalCities: ["Guadalajara", "Monterrey", "Tijuana", "Puebla", "León"],
    regionalNotes: ["Border cities, tourism centers, and industrial corridors create strong cross-border and intercity transport flows."],
  },
  {
    id: "argentina",
    title: "Why Argentina matters",
    capitalNote: "Buenos Aires is both the capital and the country’s primary transit hub.",
    transitHighlights: ["The Subte was Latin America’s first subway, and an extensive commuter-rail network reaches deep into Greater Buenos Aires."],
    geographicHighlights: ["Argentina stretches from subtropical north to Patagonia, making long-distance buses, aviation, ports, and selective rail corridors essential."],
    majorNonCapitalCities: ["Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata"],
    regionalNotes: ["Rosario’s Paraná River port and Mendoza’s Andes gateway illustrate transport roles outside Buenos Aires."],
  },
  {
    id: "south-korea",
    title: "Why South Korea matters",
    capitalNote: "Seoul is the capital and the center of one of the world’s largest integrated metropolitan subway networks.",
    transitHighlights: ["KTX high-speed rail links Seoul with Busan and other regional cities, while Busan operates its own major metro network."],
    geographicHighlights: ["Mountainous terrain concentrates cities and transport in corridors between coastal plains and river valleys."],
    majorNonCapitalCities: ["Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"],
    regionalNotes: ["AREX links Seoul with Incheon International Airport, and Busan combines metro, high-speed rail, port, and ferry connections."],
  },
  {
    id: "china",
    title: "Why China matters",
    capitalNote: "Beijing is the capital and a major metro, high-speed-rail, and national aviation hub.",
    transitHighlights: ["Shanghai Metro, Guangzhou and Shenzhen metros, and the national high-speed-rail network connect some of the world’s largest urban regions."],
    geographicHighlights: ["Megacity clusters, vast interior distances, major rivers, deserts, and mountain barriers require transport systems at extraordinary scale."],
    majorNonCapitalCities: ["Shanghai", "Guangzhou", "Shenzhen", "Chongqing", "Chengdu"],
    regionalNotes: ["Chongqing’s monorails respond to steep terrain, while Pearl River Delta networks increasingly function as a connected megaregion."],
  },
  {
    id: "united-kingdom",
    title: "Why the United Kingdom matters",
    capitalNote: "London is the capital and combines the Underground, Elizabeth line, Overground, buses, and a dense National Rail hub system.",
    transitHighlights: ["Manchester Metrolink, Glasgow Subway, Tyne and Wear Metro, and regional railways give several non-capital cities distinct transit identities."],
    geographicHighlights: ["A compact island geography favors rail corridors, ferries, ports, and cross-Channel links alongside major aviation hubs."],
    majorNonCapitalCities: ["Manchester", "Birmingham", "Glasgow", "Liverpool", "Newcastle", "Edinburgh"],
    regionalNotes: ["National Rail ties regional cities to London and each other, while ferries and the Channel Tunnel connect the islands with Europe."],
  },
  {
    id: "morocco",
    title: "Why Morocco matters",
    capitalNote: "Rabat is the capital and shares a cross-river tram network with Salé.",
    transitHighlights: ["Casablanca has the country’s largest urban rail and tram hub, while Al Boraq high-speed trains link Casablanca, Rabat, and Tangier."],
    geographicHighlights: ["Atlantic and Mediterranean coasts, the Atlas Mountains, and the Sahara edge channel travel into a small number of strategic corridors."],
    majorNonCapitalCities: ["Casablanca", "Marrakesh", "Tangier", "Fes", "Agadir"],
    regionalNotes: ["Tangier’s port and rail gateway connect Morocco with Europe, while Marrakesh and Agadir anchor major tourism corridors."],
  },
];

export const placeImportanceById = Object.fromEntries(placeImportance.map((entry) => [entry.id, entry])) as Record<string, PlaceImportance>;

export function getPlaceImportance(id: string) {
  return placeImportanceById[id];
}

export function hasCustomPlaceImportance(id: string) {
  return Boolean(placeImportanceById[id]);
}
