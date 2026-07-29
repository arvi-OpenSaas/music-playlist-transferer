export interface MatcherOptions {
  titleWeight: number;
  artistWeight: number;
  albumWeight: number;
  durationWeight: number;
  languageWeight: number;
  explicitWeight: number;
  popularityWeight: number;
  liveWeight: number;
  remixWeight: number;
  acousticWeight: number;
  autoMatchThreshold: number;
  askUserThreshold: number;
}

export function createDefaultMatcherOptions(): MatcherOptions {
  return {
    titleWeight: 0.35,
    artistWeight: 0.25,
    albumWeight: 0.1,
    durationWeight: 0.1,
    languageWeight: 0.05,
    explicitWeight: 0.03,
    popularityWeight: 0.04,
    liveWeight: 0.04,
    remixWeight: 0.02,
    acousticWeight: 0.02,
    autoMatchThreshold: 95,
    askUserThreshold: 80,
  };
}
