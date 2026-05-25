import type { LocalFriend, PlayerProfile, QuizRun } from "./types";

export const PROFILE_KEY = "geotransit.profile.v1";
export const RUN_KEY = "geotransit.activeRun.v1";
export const PROFILE_MODE_KEY = "geotransit.profileMode.v1";
export const PROFILE_LIST_KEY = "geotransit.profiles.v1";
export const FRIENDS_KEY = "geotransit.friends.v1";

const validDifficultyLevels = new Set([
  "gateway",
  "connector",
  "hub",
  "interchange",
  "express",
  "signal",
  "control",
  "dispatch",
  "crosswind",
  "night-ops",
  "deep-route",
  "polar",
  "microstate",
  "edgecase",
  "outer-limits",
]);

export function createDefaultProfile(): PlayerProfile {
  return {
    id: crypto.randomUUID(),
    name: "",
    emoji: "🚇",
    isGuest: false,
    highScore: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    currentDifficulty: "gateway",
    categoryStats: {},
    answeredQuestionIds: [],
    questionHistory: {},
    incorrectAnswers: [],
  };
}

function normalizeProfile(profile: PlayerProfile): PlayerProfile {
  const normalized = { ...createDefaultProfile(), ...profile };
  if (normalized.name === "Controller" || normalized.name === "Geo Operator" || normalized.name === "Ilan") normalized.name = "";
  if (!validDifficultyLevels.has(normalized.currentDifficulty)) normalized.currentDifficulty = "gateway";
  const currentEmoji = String(normalized.emoji ?? "");
  const emojiCodeUnits = Array.from(currentEmoji).map((character) => character.charCodeAt(0));
  if (!currentEmoji || emojiCodeUnits.includes(195) || emojiCodeUnits.includes(240)) normalized.emoji = "🚇";
  return normalized;
}

export function loadProfiles(): PlayerProfile[] {
  const raw = localStorage.getItem(PROFILE_LIST_KEY);
  if (raw) {
    try {
      const profiles = JSON.parse(raw) as PlayerProfile[];
      if (Array.isArray(profiles) && profiles.length > 0) return profiles.map(normalizeProfile);
    } catch {
      // Fall back to single-profile migration.
    }
  }
  return [loadProfile()];
}

export function saveProfiles(profiles: PlayerProfile[]) {
  localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles.map(normalizeProfile)));
}

export function loadProfile(): PlayerProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return createDefaultProfile();
  try {
    return normalizeProfile(JSON.parse(raw) as PlayerProfile);
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile) {
  const normalized = normalizeProfile(profile);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  localStorage.setItem(PROFILE_MODE_KEY, normalized.isGuest ? "guest" : "named");
  const profiles = loadProfiles();
  const nextProfiles = profiles.some((item) => item.id === normalized.id)
    ? profiles.map((item) => item.id === normalized.id ? normalized : item)
    : [normalized, ...profiles];
  saveProfiles(nextProfiles);
}

export function loadFriends(): LocalFriend[] {
  const raw = localStorage.getItem(FRIENDS_KEY);
  if (!raw) return [];
  try {
    const friends = JSON.parse(raw) as LocalFriend[];
    return Array.isArray(friends) ? friends : [];
  } catch {
    return [];
  }
}

export function saveFriends(friends: LocalFriend[]) {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export function loadRun(): QuizRun | null {
  const raw = localStorage.getItem(RUN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuizRun;
  } catch {
    return null;
  }
}

export function saveRun(run: QuizRun | null) {
  if (!run) {
    localStorage.removeItem(RUN_KEY);
    return;
  }
  localStorage.setItem(RUN_KEY, JSON.stringify(run));
}
