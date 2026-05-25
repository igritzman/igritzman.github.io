import { difficultyLevels, questions, regions } from "./data";
import type { DifficultyLevel, PlayerProfile, Question, QuizRun } from "./types";

export const difficultyScore: Record<DifficultyLevel, number> = {
  gateway: 100,
  connector: 140,
  hub: 180,
  interchange: 230,
  express: 290,
  signal: 360,
  control: 450,
  dispatch: 540,
  crosswind: 650,
  "night-ops": 780,
  "deep-route": 930,
  polar: 1100,
  microstate: 1300,
  edgecase: 1550,
  "outer-limits": 1850,
};

export function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,]/g, "");
}

export function isCorrect(question: Question, value: string) {
  const normalized = normalizeAnswer(value);
  const accepted = [question.answer, ...(question.aliases ?? [])].map(normalizeAnswer);
  return accepted.includes(normalized);
}

export function levelIndex(level: DifficultyLevel) {
  return difficultyLevels.indexOf(level);
}

export function moveDifficulty(level: DifficultyLevel, delta: number) {
  const nextIndex = Math.max(0, Math.min(difficultyLevels.length - 1, levelIndex(level) + delta));
  return difficultyLevels[nextIndex];
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string) {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentRotationDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.max(0, dayOfYear % 30);
}

function choicesFor(answer: string, candidates: string[], seed: string) {
  const options = seededShuffle(candidates.filter((item) => item && item !== answer), seed).slice(0, 3);
  return seededShuffle([answer, ...options], `${seed}-final`);
}

const gatewayRegionIds = new Set([
  "united-states",
  "canada",
  "mexico",
  "united-kingdom",
  "france",
  "spain",
  "italy",
  "germany",
  "india",
  "china",
  "japan",
  "australia",
  "south-africa",
  "new-zealand",
  "singapore",
  "colombia",
  "argentina",
  "chile",
  "brazil",
]);

function monthlyDifficulty(_day: number, slot: number): DifficultyLevel {
  return difficultyLevels[Math.min(difficultyLevels.length - 1, Math.floor(slot / 10))];
}

function isTransportQuestion(question: Question) {
  return ["airports", "airport-codes", "metro", "rail", "highways", "maritime"].includes(question.category);
}

function isImageQuestion(question: Question) {
  return Boolean(question.visualType && question.visualType !== "flag" && question.image);
}

function airportPromptTarget(region: (typeof regions)[number]) {
  const preferredCity = region.majorCities.find((city) => city !== region.capital) ?? region.majorCities[0] ?? region.capital ?? region.name;
  return preferredCity && !preferredCity.includes("Largest commercial") && !preferredCity.includes("Primary airport") ? preferredCity : region.name;
}

function allowedFlagCount(count: number, startDifficulty: DifficultyLevel) {
  const ratio = levelIndex(startDifficulty) <= levelIndex("connector") ? 0.15 : 0.1;
  return Math.max(1, Math.floor(count * ratio));
}

function buildMonthlyRotationQuestions(monthKey = currentMonthKey()) {
  const rotationRegions = seededShuffle(regions, `geotransit-month-${monthKey}`);
  const capitalPool = regions.map((region) => region.capital).filter(Boolean);
  const countryPool = regions.map((region) => region.name);
  const questionsByDay: Question[] = [];
  const slotsPerDay = 170;

  for (let day = 0; day < 30; day += 1) {
    for (let slot = 0; slot < slotsPerDay; slot += 1) {
      const difficulty = monthlyDifficulty(day, slot);
      const easyRotationRegions = rotationRegions.filter((region) => gatewayRegionIds.has(region.id));
      const regionPool = difficulty === "gateway" || difficulty === "connector" ? easyRotationRegions : rotationRegions;
      const region = regionPool[(day * slotsPerDay + slot) % regionPool.length];
      const seed = `${monthKey}-${day}-${slot}-${region.id}`;
      const template = slot % 10;
      const primaryAirport = region.airports[0];
      const primaryRail = region.rail[0];
      const primaryMetro = region.metro[0];
      const primaryHighway = region.highways[0];
      const primaryMaritime = region.maritime[0];
      const primaryLandmark = region.landmarks[0];
      const primaryGeography = region.riversMountains[0];
      const primaryPlace = region.placesOfInterest[0];

      const monthlyQuestion: Question =
        template === 0 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-capital-${region.id}`,
          category: "capitals",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: what is the capital of ${region.name}?`,
          answer: region.capital,
          choices: choicesFor(region.capital, capitalPool, seed),
          explanation: `${region.capital} is the capital anchor for ${region.name}'s local transit and geography profile.`,
          relatedRegionIds: [region.id],
        } : template === 1 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-airport-${region.id}`,
          category: primaryAirport.startsWith("No ") ? "airports" : "airport-codes",
          difficulty,
          inputType: primaryAirport.length === 3 && primaryAirport.toUpperCase() === primaryAirport ? "typed" : "multiple-choice",
          prompt: primaryAirport.startsWith("No ")
            ? `Day ${day + 1}: which airport note belongs to ${region.name}?`
            : `Day ${day + 1}: identify a major airport clue for ${airportPromptTarget(region)}.`,
          answer: primaryAirport,
          aliases: primaryAirport.length === 3 ? [primaryAirport.toLowerCase()] : undefined,
          choices: primaryAirport.length === 3 ? undefined : choicesFor(primaryAirport, regions.flatMap((item) => item.airports.slice(0, 1)), seed),
          explanation: primaryAirport.startsWith("No ") ? primaryAirport : `${primaryAirport} appears in ${region.name}'s aviation profile.`,
          relatedRegionIds: [region.id],
        } : template === 2 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-rail-${region.id}`,
          category: "rail",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which rail or intercity corridor is associated with ${region.name}?`,
          answer: primaryRail,
          choices: choicesFor(primaryRail, regions.flatMap((item) => item.rail.slice(0, 2)), seed),
          explanation: `${primaryRail} is listed in ${region.name}'s rail/intercity transport brief.`,
          relatedRegionIds: [region.id],
        } : template === 3 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-metro-${region.id}`,
          category: "metro",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which urban transit clue belongs to ${region.name}?`,
          answer: primaryMetro,
          choices: choicesFor(primaryMetro, regions.flatMap((item) => item.metro.slice(0, 2)), seed),
          explanation: `${primaryMetro} is part of ${region.name}'s local metro, tram, bus, or urban transit profile.`,
          relatedRegionIds: [region.id],
        } : template === 4 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-highway-${region.id}`,
          category: "highways",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which highway or road corridor is tied to ${region.name}?`,
          answer: primaryHighway,
          choices: choicesFor(primaryHighway, regions.flatMap((item) => item.highways.slice(0, 2)), seed),
          explanation: `${primaryHighway} is a road clue in ${region.name}'s country table.`,
          relatedRegionIds: [region.id],
        } : template === 5 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-maritime-${region.id}`,
          category: "maritime",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which maritime, river, ferry, or port clue fits ${region.name}?`,
          answer: primaryMaritime,
          choices: choicesFor(primaryMaritime, regions.flatMap((item) => item.maritime.slice(0, 2)), seed),
          explanation: `${primaryMaritime} is part of ${region.name}'s water/port access profile.`,
          relatedRegionIds: [region.id],
        } : template === 6 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-network-${region.id}`,
          category: "rail",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which country profile pairs ${primaryRail} with ${primaryMetro}?`,
          answer: region.name,
          choices: choicesFor(region.name, countryPool, seed),
          explanation: `${primaryRail} and ${primaryMetro} are both transportation clues from the ${region.name} country panel.`,
          relatedRegionIds: [region.id],
        } : template === 7 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-geography-${region.id}`,
          category: "rivers-mountains",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: which river, mountain, coast, or landform belongs to ${region.name}?`,
          answer: primaryGeography,
          choices: choicesFor(primaryGeography, regions.flatMap((item) => item.riversMountains.slice(0, 2)), seed),
          explanation: `${primaryGeography} appears in ${region.name}'s geography profile.`,
          relatedRegionIds: [region.id],
        } : template === 8 ? {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-place-${region.id}`,
          category: "highways",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Day ${day + 1}: ${primaryHighway} is a road or traffic corridor clue for which country?`,
          answer: region.name,
          choices: choicesFor(region.name, countryPool, seed),
          explanation: `${primaryHighway} is listed in ${region.name}'s road and traffic profile.`,
          relatedRegionIds: [region.id],
        } : {
          id: `monthly-${monthKey}-${day + 1}-${slot + 1}-country-${region.id}`,
          category: "flags",
          difficulty,
          inputType: "multiple-choice",
          prompt: `Which country or territory does this flag belong to?`,
          answer: region.name,
          choices: choicesFor(region.name, countryPool, seed),
          explanation: `This is the flag shown on the ${region.name} country panel; ${region.capital} is its capital anchor.`,
          image: region.flag,
          visualType: "flag",
          visualCaption: `${region.name} flag`,
          relatedRegionIds: [region.id],
        };

      questionsByDay.push(monthlyQuestion);
    }
  }

  return questionsByDay;
}

export function monthlyRotationCatalogSize() {
  return 5100;
}

function questionVarietyScore(question: Question, recentMissIds: Set<string>, recentlySeenIds: Set<string>, profile: PlayerProfile | undefined, selected: Question[]) {
  const history = profile?.questionHistory?.[question.id];
  let score = 0;
  if (recentMissIds.has(question.id)) score -= 10;
  if (recentlySeenIds.has(question.id)) score -= 80;
  if (history) score -= Math.min(80, history.seen * 14);
  if (history?.seen && question.category === "airport-codes") score -= 20;
  if (question.id.startsWith("monthly-")) score += 9;
  if (question.inputType === "map-click") score += selected.some((item) => item.inputType === "map-click") ? -2 : 4;
  if (question.inputType === "typed") score += selected.some((item) => item.inputType === "typed") ? 1 : 3;
  if (question.visualType) score += 5;
  if (question.visualType === "wmata-map" || question.visualType === "station-map") score += 4;
  if (!selected.some((item) => item.category === question.category)) score += 2;
  score -= Math.abs(levelIndex(question.difficulty) - levelIndex(profile?.currentDifficulty ?? question.difficulty)) * 1.5;
  return score + Math.random() * 4;
}

export function pickQuestions(startDifficulty: DifficultyLevel, count = 10, profile?: PlayerProfile) {
  const selected: Question[] = [];
  let cursor = levelIndex(startDifficulty);
  const recentMissIds = new Set(profile?.incorrectAnswers.slice(0, 12).map((item) => item.question.id) ?? []);
  const recentlySeenIds = new Set(profile?.answeredQuestionIds.slice(-600) ?? []);
  const monthlyQuestions = buildMonthlyRotationQuestions();
  const today = currentRotationDay();
  const slotsPerDay = 170;
  const todaysDeck = monthlyQuestions.slice(today * slotsPerDay, today * slotsPerDay + slotsPerDay);
  const allQuestions = [...questions, ...monthlyQuestions];
  const pools = difficultyLevels.map((level) => allQuestions.filter((question) => question.difficulty === level));
  const lowestDailyIndex = Math.max(0, levelIndex(startDifficulty) - 1);
  const highestDailyIndex = Math.min(difficultyLevels.length - 1, levelIndex(startDifficulty) + Math.ceil(count / 5));
  const targetTransportCount = Math.round(count * 0.7);
  const maxGeneralCount = count - targetTransportCount;
  const maxFlagCount = allowedFlagCount(count, startDifficulty);
  const targetImageCount = Math.max(1, Math.round(count * 0.1));
  const maxImageCount = Math.max(targetImageCount, Math.ceil(count * 0.15));
  const canAddQuestion = (question: Question) => {
    const categoryCount = selected.filter((item) => item.category === question.category).length;
    const maxCategoryCount = Math.max(2, Math.ceil(count * 0.34));
    const generalCount = selected.filter((item) => !isTransportQuestion(item)).length;
    const imageCount = selected.filter(isImageQuestion).length;
    if (!isTransportQuestion(question) && generalCount >= maxGeneralCount) return false;
    if (isImageQuestion(question) && imageCount >= maxImageCount) return false;
    if (question.category === "flags" && categoryCount >= maxFlagCount) return false;
    return categoryCount < maxCategoryCount;
  };

  const dailyFresh = todaysDeck
    .filter((question) => {
      const rank = levelIndex(question.difficulty);
      return rank >= lowestDailyIndex && rank <= highestDailyIndex;
    })
    .filter((question) => !recentlySeenIds.has(question.id))
    .sort((a, b) => questionVarietyScore(b, recentMissIds, recentlySeenIds, profile, selected) - questionVarietyScore(a, recentMissIds, recentlySeenIds, profile, selected));
  while (selected.length < Math.min(count, todaysDeck.length) && dailyFresh.length > 0) {
    const nextIndex = dailyFresh.findIndex(canAddQuestion);
    const pickIndex = nextIndex >= 0 ? nextIndex : 0;
    selected.push(dailyFresh.splice(pickIndex, 1)[0]);
  }

  while (selected.length < count) {
    const progress = selected.length / count;
    const allowOuterLimits = cursor >= 6 && progress >= 0.55;
    const availableLevels = difficultyLevels.filter((level, index) => {
      if (level === "outer-limits" && !allowOuterLimits) return false;
      return index <= Math.min(cursor + 2, difficultyLevels.length - 1) && index >= Math.max(0, cursor - 1);
    });
    const freshPool = availableLevels
      .flatMap((level) => pools[levelIndex(level)])
      .filter((question) => !selected.some((item) => item.id === question.id))
      .filter((question) => !recentlySeenIds.has(question.id));
    const pool = freshPool.length > 0
      ? freshPool
      : availableLevels.flatMap((level) => pools[levelIndex(level)]).filter((question) => !selected.some((item) => item.id === question.id));
    const fallback = allQuestions.filter((question) => !selected.some((item) => item.id === question.id));
    const source = shuffled(pool.length > 0 ? pool : fallback)
      .sort((a, b) => questionVarietyScore(b, recentMissIds, recentlySeenIds, profile, selected) - questionVarietyScore(a, recentMissIds, recentlySeenIds, profile, selected));
    const transportCount = selected.filter(isTransportQuestion).length;
    const needsTransport = transportCount < targetTransportCount && selected.length >= maxGeneralCount;
    const pick = source.find((question) => canAddQuestion(question) && (!needsTransport || isTransportQuestion(question)))
      ?? source.find(canAddQuestion)
      ?? source[0];
    selected.push(pick);
    if (selected.length % 2 === 0) cursor = Math.min(cursor + 1, difficultyLevels.length - 1);
  }

  const typed = allQuestions.find((question) => question.inputType === "typed" && !selected.some((item) => item.id === question.id));
  const mapClickPool = allQuestions
    .filter((question) => question.inputType === "map-click" && !selected.some((item) => item.id === question.id))
    .filter((question) => {
      const rank = levelIndex(question.difficulty);
      return rank >= Math.max(0, levelIndex(startDifficulty) - 1) && rank <= Math.min(difficultyLevels.length - 1, levelIndex(startDifficulty) + 4);
    })
    .sort((a, b) => questionVarietyScore(b, recentMissIds, recentlySeenIds, profile, selected) - questionVarietyScore(a, recentMissIds, recentlySeenIds, profile, selected));
  const mapClick = mapClickPool[0] ?? allQuestions.find((question) => question.inputType === "map-click" && !selected.some((item) => item.id === question.id));
  if (!selected.some((question) => question.inputType === "typed") && typed) selected[1] = typed;
  if (!selected.some((question) => question.inputType === "map-click") && mapClick) selected[Math.min(5, count - 1)] = mapClick;
  const imagePool = allQuestions
    .filter(isImageQuestion)
    .filter((question) => !selected.some((item) => item.id === question.id))
    .sort((a, b) => questionVarietyScore(b, recentMissIds, recentlySeenIds, profile, selected) - questionVarietyScore(a, recentMissIds, recentlySeenIds, profile, selected));
  while (selected.filter(isImageQuestion).length < targetImageCount && imagePool.length > 0) {
    const replacementIndex = selected.findIndex((question, index) => index > 0 && question.inputType !== "typed" && question.inputType !== "map-click" && !isImageQuestion(question));
    if (replacementIndex < 0) break;
    selected[replacementIndex] = imagePool.shift()!;
  }

  return selected;
}

export function createDailyLadderQuestions(startDifficulty: DifficultyLevel, profile?: PlayerProfile) {
  const selected: Question[] = [];
  const recentMissIds = new Set(profile?.incorrectAnswers.slice(0, 12).map((item) => item.question.id) ?? []);
  const recentlySeenIds = new Set(profile?.answeredQuestionIds.slice(-800) ?? []);
  const allQuestions = [...questions, ...buildMonthlyRotationQuestions()];

  difficultyLevels.slice(levelIndex(startDifficulty)).forEach((level) => {
    const source = allQuestions
      .filter((question) => question.difficulty === level)
      .filter((question) => !selected.some((item) => item.id === question.id))
      .sort((a, b) => questionVarietyScore(b, recentMissIds, recentlySeenIds, profile, selected) - questionVarietyScore(a, recentMissIds, recentlySeenIds, profile, selected));
    selected.push(...source.slice(0, 10));
  });

  return selected;
}

export function createRun(profile: PlayerProfile, count = 10, startDifficulty = profile.currentDifficulty): QuizRun {
  const runQuestions = count === 150 ? createDailyLadderQuestions(startDifficulty, profile) : pickQuestions(startDifficulty, count, profile);
  return {
    active: true,
    index: 0,
    questionCount: runQuestions.length,
    score: 0,
    correctStreak: 0,
    missStreak: 0,
    difficulty: startDifficulty,
    questions: runQuestions,
    answers: [],
    previousHighScore: profile.highScore,
    newRecord: false,
  };
}

export function nextDifficulty(current: DifficultyLevel, correct: boolean, correctStreak: number, missStreak: number) {
  if (correct && correctStreak >= 8 && correctStreak % 2 === 0) {
    return moveDifficulty(current, 2);
  }
  if (correct && correctStreak > 0 && correctStreak % 2 === 0) {
    return moveDifficulty(current, 1);
  }
  if (!correct && missStreak >= 6) {
    return moveDifficulty(current, -1);
  }
  return current;
}
