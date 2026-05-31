export type DifficultyLevel =
  | "gateway"
  | "connector"
  | "hub"
  | "interchange"
  | "express"
  | "signal"
  | "control"
  | "dispatch"
  | "crosswind"
  | "night-ops"
  | "deep-route"
  | "polar"
  | "microstate"
  | "edgecase"
  | "outer-limits";

export type QuestionCategory =
  | "capitals"
  | "flags"
  | "landmarks"
  | "airports"
  | "airport-codes"
  | "metro"
  | "rail"
  | "highways"
  | "maritime"
  | "rivers-mountains"
  | "former-countries";

export type Question = {
  id: string;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  inputType: "multiple-choice" | "typed" | "map-click";
  prompt: string;
  answer: string;
  aliases?: string[];
  choices?: string[];
  explanation: string;
  image?: string;
  visualType?: "flag" | "regional-flag" | "landmark" | "street-view" | "metro-diagram" | "marta-map" | "aerial-map" | "station-map" | "wmata-map" | "transit-photo" | "landmark-photo";
  visualCaption?: string;
  mapTarget?: {
    lat: number;
    lng: number;
    toleranceKm: number;
  };
  relatedRegionIds?: string[];
};

export type SavedIncorrectAnswer = {
  id: string;
  question: Question;
  userAnswer: string;
  dateMissed: string;
};

export type PlayerProfile = {
  id: string;
  name: string;
  emoji: string;
  isGuest: boolean;
  highScore: number;
  totalAnswered: number;
  totalCorrect: number;
  currentDifficulty: DifficultyLevel;
  categoryStats: Record<string, { answered: number; correct: number }>;
  answeredQuestionIds: string[];
  questionHistory: Record<string, { seen: number; correct: number; lastSeen: string }>;
  incorrectAnswers: SavedIncorrectAnswer[];
};

export type LocalFriend = {
  id: string;
  name: string;
  emoji: string;
  highScore: number;
  accuracy: number;
  totalAnswered: number;
};

export type Region = {
  id: string;
  name: string;
  flag: string;
  capital: string;
  population: string;
  position: { x: number; y: number };
  majorCities: string[];
  airports: string[];
  rail: string[];
  metro: string[];
  highways: string[];
  maritime: string[];
  landmarks: string[];
  riversMountains: string[];
  placesOfInterest: string[];
  funFacts: string[];
  transitReferences: TransitReference[];
  flagPath?: string;
  imagePath?: string;
  galleryImages?: string[];
  facts: string[];
  sampleQuestionIds: string[];
};

export type TransitReference = {
  id: string;
  title: string;
  kind: "metro-map" | "rail-map" | "canal-map" | "corridor-map" | "country-brief";
  summary: string;
  keyNodes: string[];
};

export type QuizAnswer = {
  question: Question;
  userAnswer: string;
  correct: boolean;
  points: number;
};

export type QuizRun = {
  active: boolean;
  index: number;
  questionCount: number;
  score: number;
  correctStreak: number;
  missStreak: number;
  difficulty: DifficultyLevel;
  questions: Question[];
  answers: QuizAnswer[];
  previousHighScore: number;
  newRecord: boolean;
};
