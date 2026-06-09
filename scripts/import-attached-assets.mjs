import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = process.argv[2];
if (!sourceRoot) {
  throw new Error("Usage: node scripts/import-attached-assets.mjs <expanded-zip-folder>");
}

const imageExtensions = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const flagRoot = path.join(projectRoot, "public", "images", "region-flags", "imported");
const imageRoot = path.join(projectRoot, "public", "images", "region-images", "imported");
const metroRoot = path.join(projectRoot, "public", "metro-images");

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function uniquePath(dir, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, ext);
  let candidate = path.join(dir, `${base}${ext}`);
  if (fs.existsSync(candidate)) return candidate;
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function countryForFile(filePath) {
  const lower = filePath.toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  const normalizedFileName = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-");
  const pathParts = lower.split(/[\\/]+/);
  if (normalizedFileName.includes("new-south-wales")) return "australia";
  if (["greece", "greek", "attica", "crete", "macedonia", "thrace", "epirus", "ionian", "aegean", "peloponnese", "thessaly", "athos"].some((token) => fileName.includes(token))) return "greece";
  if (["brazil", "acre", "alagoas", "amapa", "amazonas", "bahia", "ceara", "goias", "maranhao", "paraiba", "parana", "pernambuco", "rondonia", "roraima", "sergipe", "tocantins"].some((token) => fileName.includes(token))) return "brazil";
  if (["canada", "alberta", "british columbia", "manitoba", "new brunswick", "newfoundland", "nova scotia", "nunavut", "ontario", "prince edward", "quebec", "saskatchewan", "yukon"].some((token) => fileName.includes(token))) return "canada";
  if (["philippines", "ilocos", "cagayan", "calabarzon", "mimaropa", "visayas", "mindanao", "barmm"].some((token) => fileName.includes(token))) return "philippines";
  if (["south africa", "gauteng", "kwazulu", "limpopo", "mpumalanga", "western cape", "eastern cape", "free state"].some((token) => fileName.includes(token))) return "south-africa";
  if (["chile", "arica", "atacama", "aysen", "biobio", "coquimbo", "magallanes", "nuble", "valparaiso"].some((token) => fileName.includes(token))) return "chile";
  if (["france", "brittany", "corsica", "normandy", "occitanie", "aquitaine", "provence", "reunion", "guadeloupe", "martinique"].some((token) => fileName.includes(token))) return "france";
  if (["japan", "hokkaido", "tohoku", "kanto", "chubu", "kansai", "chugoku", "shikoku", "kyushu", "okinawa", "kyoto", "osaka"].some((token) => fileName.includes(token))) return "japan";
  if (["australia", "tasmania", "queensland", "victoria", "western australia", "western-australia", "south australia", "south-australia", "new south wales", "new-south-wales", "australian-capital-territory"].some((token) => fileName.includes(token))) return "australia";
  if (["mexico", "aguascalientes", "baja", "campeche", "chiapas", "chihuahua", "coahuila", "colima", "durango", "guanajuato", "guerrero", "hidalgo", "jalisco", "michoacan", "morelos", "nayarit", "nuevo leon", "oaxaca", "puebla", "queretaro", "quintana", "sinaloa", "sonora", "tabasco", "tamaulipas", "tlaxcala", "veracruz", "yucatan", "zacatecas"].some((token) => fileName.includes(token))) return "mexico";
  if (["spain", "andalusia", "aragon", "asturias", "balearic", "basque", "canary", "cantabria", "castile", "catalonia", "extremadura", "galicia", "madrid", "murcia", "navarra", "valencian"].some((token) => fileName.includes(token))) return "spain";
  if (["uae", "emirate", "abu dhabi", "dubai", "sharjah", "ajman", "fujairah", "ras al khaimah", "umm al quwain"].some((token) => fileName.includes(token))) return "uae";
  if (["vietnam", "ha noi", "hanoi", "ho chi minh", "da nang", "haiphong", "can tho", "thua thien", "quang"].some((token) => fileName.includes(token))) return "vietnam";
  if (["nigeria", "abia", "adamawa", "akwa ibom", "anambra", "bauchi", "bayelsa", "benue", "borno", "cross river", "delta", "ebonyi", "edo", "ekiti", "enugu", "gombe", "imo", "kaduna", "kano", "katsina", "kebbi", "kogi", "kwara", "lagos", "nasarawa", "niger", "ogun", "ondo", "osun", "oyo", "plateau", "rivers", "sokoto", "taraba", "yobe", "zamfara"].some((token) => fileName.includes(token))) return "nigeria";
  if (["kenya", "baringo", "bomet", "bungoma", "busia", "embu", "garissa", "homa bay", "isiolo", "kajiado", "kakamega", "kericho", "kiambu", "kilifi", "kirinyaga", "kisii", "kisumu", "kitui", "kwale", "laikipia", "lamu", "machakos", "makueni", "mandera", "marsabit", "meru", "migori", "mombasa", "murang", "nairobi", "nakuru", "nandi", "narok", "nyandarua", "nyeri", "samburu", "siaya", "taita", "tana river", "trans nzoia", "turkana", "uasin gishu", "vihiga", "wajir", "west pokot"].some((token) => fileName.includes(token))) return "kenya";
  if (["thailand", "thai", "amnat", "ayutthaya", "bangkok", "bueng kan", "chai nat", "chaiyaphum", "chanthaburi", "chiang mai", "chiang rai", "chonburi", "khon kaen", "lampang", "mae hong son", "pattani", "phuket", "rayong", "surin", "tak", "trang", "ubon", "uthai thani", "uttaradit", "yala", "yasothon"].some((token) => fileName.includes(token))) return "thailand";
  if (["algeria", "adrar", "algiers", "annaba", "constantine", "ghardaia", "oran", "ouargla", "tamanrasset"].some((token) => fileName.includes(token))) return "algeria";
  if (["zimbabwe", "bulawayo", "harare", "manicaland", "mashonaland", "masvingo", "matabeleland", "midlands province"].some((token) => fileName.includes(token))) return "zimbabwe";
  if (["russia", "moscow", "st petersburg", "irkutsk", "novosibirsk", "sakha", "sverdlovsk", "tatarstan"].some((token) => fileName.includes(token))) return "russia";
  if (["ukraine", "oblast", "cherkasy", "chernihiv", "chernivtsi", "dnipropetrovsk", "donetsk", "ivano", "kharkiv", "kherson", "khmelnytskyi", "kirovohrad", "kyiv", "luhansk", "lviv", "mykolaiv", "odesa", "poltava", "rivne", "sumy", "ternopil", "vinnytsia", "volyn", "zakarpattia", "zaporizh", "zhytomyr"].some((token) => fileName.includes(token))) return "ukraine";
  if (["south korea", "seoul", "busan", "daegu", "incheon", "gwangju", "daejeon", "ulsan", "jeju", "gyeonggi", "gangwon", "chungcheong", "jeolla", "gyeongsang"].some((token) => fileName.includes(token))) return "south-korea";
  if (["italy", "abruzzo", "aosta", "apulia", "basilicata", "calabria", "campania", "emilia", "friuli", "lazio", "liguria", "lombardy", "marche", "molise", "piedmont", "sardinia", "sicily", "tuscany", "umbria", "veneto"].some((token) => fileName.includes(token))) return "italy";
  if (["england", "scotland", "wales", "northern ireland", "belfast", "cardiff", "edinburgh", "glasgow", "aberdeen", "cornwall", "derry", "greater manchester", "gwynedd", "highland", "isle of man", "isle-of-man", "london", "merseyside", "west yorkshire"].some((token) => fileName.includes(token))) return "united-kingdom";
  if (["ad-yaman", "adiyaman", "adana", "afyon", "agri", "agr", "aksaray", "amasya", "ankara", "antalya", "ardahan", "aradahan", "artvin", "aydin", "bal-kesir", "balikesir", "bart-n", "bartin", "batman", "bayburt", "bilecik", "bingol", "bitlis", "bolu", "burdur", "bursa", "canakkale", "cank-r", "cankiri", "corum", "denizli", "denizili", "diyarbak-r", "diyarbakir", "duzce", "edirne", "elaz-g", "elazig", "erzincan", "erzurum", "eskisehir", "gaziantep", "gazientep", "giresun", "gumushane", "hakkari", "hatay", "igd-r", "igdir", "isparta", "istanbul", "izmir", "izmit", "k-r-kkale", "kirikkale", "k-rklareli", "kirklareli", "k-rsehir", "kirsehir", "kahramanmaras", "karabuk", "karaman", "kars", "kastamonu", "kayseri", "kilis", "konya", "kutahya", "malatya", "manisa", "mardin", "mersin", "mugla", "mus", "nevsehir", "nigde", "ordu", "osmaniye", "rize", "s-rnak", "sirnak", "sakarya", "samsun", "sanl-urfa", "sanliurfa", "siirt", "sinop", "sivas", "tekirdag", "tokat", "trabzon", "tunceli", "usak", "van", "yalova", "yozgat", "zonguldak"].some((token) => normalizedFileName.includes(token))) return "turkey";
  if (lower.includes("romania")) return "romania";
  if (lower.includes("norway")) return "norway";
  if (pathParts.some((part) => part === "turkey" || part === "turkish flags and images")) return "turkey";
  if (pathParts.some((part) => part === "uk flags" || part === "united kingdom" || part === "uk")) return "united-kingdom";
  if (lower.includes("ukranian") || lower.includes("ukrainian") || lower.includes("ukraine")) return "ukraine";
  return "";
}

function looksLikeFlag(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return /\b(flag|coa|coat|arms|stema|emblem|logo|actual|county_coa|judet|judetului|rou_|ro_)/i.test(name);
}

function cleanAssetName(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, ext)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(40px|actual|county|judetul|judetului|coa|coat|arms|of|romania|romanian|stema|flag|emblem|logo|rou|ro)\b/gi, " ");
  return `${slugify(base) || slugify(path.basename(filePath, ext))}${ext}`;
}

let copiedMetro = 0;
let copiedRegional = 0;
for (const filePath of walk(sourceRoot)) {
  const ext = path.extname(filePath).toLowerCase();
  if (!imageExtensions.has(ext)) continue;
  const lower = filePath.toLowerCase();
  if (lower.includes("metro images")) {
    ensureDir(metroRoot);
    fs.copyFileSync(filePath, uniquePath(metroRoot, cleanAssetName(filePath)));
    copiedMetro += 1;
    continue;
  }
  const country = countryForFile(filePath);
  if (!country) continue;
  const targetRoot = looksLikeFlag(filePath) ? flagRoot : imageRoot;
  const targetDir = path.join(targetRoot, country);
  ensureDir(targetDir);
  fs.copyFileSync(filePath, uniquePath(targetDir, cleanAssetName(filePath)));
  copiedRegional += 1;
}

function manifestKey(fileName) {
  const ext = path.extname(fileName);
  return slugify(path.basename(fileName, ext)
    .replace(/\b(flag|coa|coat|arms|county|region|province|actual|stema|emblem|logo|city|municipality)\b/gi, " "));
}

function buildManifest(root, publicPrefix) {
  const manifest = {};
  if (!fs.existsSync(root)) return manifest;
  for (const country of fs.readdirSync(root).sort()) {
    const countryDir = path.join(root, country);
    if (!fs.statSync(countryDir).isDirectory()) continue;
    manifest[country] = {};
    for (const filePath of walk(countryDir).sort()) {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExtensions.has(ext)) continue;
      const rel = path.relative(path.join(projectRoot, "public", "images", publicPrefix), filePath).replaceAll(path.sep, "/");
      const key = manifestKey(path.basename(filePath));
      if (key && !manifest[country][key]) manifest[country][key] = rel;
    }
  }
  return manifest;
}

fs.writeFileSync(
  path.join(projectRoot, "src", "regionFlagManifest.json"),
  `${JSON.stringify(buildManifest(flagRoot, "region-flags"), null, 2)}\n`,
);
fs.writeFileSync(
  path.join(projectRoot, "src", "regionImageManifest.json"),
  `${JSON.stringify(buildManifest(imageRoot, "region-images"), null, 2)}\n`,
);

console.log(`Copied ${copiedRegional} regional assets and ${copiedMetro} metro images.`);
