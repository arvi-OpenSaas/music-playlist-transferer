import { normalizeText } from '@/utils/Helpers';
import { MatcherOptions } from '@/matcher/MatcherOptions';
import { ScoredCandidate, Song } from '@/shared/types';

export class ConfidenceEngine {
  constructor(private readonly options: MatcherOptions) {}

  score(sourceSong: Song, candidate: Song): ScoredCandidate {
    const titleScore = this.scoreText(sourceSong.title, candidate.title);
    const artistScore = this.scoreText(sourceSong.artists.join(' '), candidate.artists.join(' '));
    const albumScore = this.scoreText(sourceSong.album ?? '', candidate.album ?? '');
    const durationScore = this.scoreDuration(sourceSong.durationSeconds, candidate.durationSeconds);
    const languageScore = this.scoreLanguage(sourceSong.language, candidate.language);
    const explicitScore = this.scoreBoolean(sourceSong.isExplicit, candidate.isExplicit);
    const popularityScore = this.scorePopularity(sourceSong.popularity, candidate.popularity);
    const liveScore = this.scoreBoolean(sourceSong.isLive, candidate.isLive);
    const remixScore = this.scoreBoolean(sourceSong.isRemix, candidate.isRemix);
    const acousticScore = this.scoreBoolean(sourceSong.isAcoustic, candidate.isAcoustic);

    const weightedScore =
      titleScore * this.options.titleWeight +
      artistScore * this.options.artistWeight +
      albumScore * this.options.albumWeight +
      durationScore * this.options.durationWeight +
      languageScore * this.options.languageWeight +
      explicitScore * this.options.explicitWeight +
      popularityScore * this.options.popularityWeight +
      liveScore * this.options.liveWeight +
      remixScore * this.options.remixWeight +
      acousticScore * this.options.acousticWeight;

    const confidence = Math.min(100, Math.max(0, Math.round(weightedScore * 100)));

    return {
      song: candidate,
      score: confidence,
      reason: this.describeScore(confidence, titleScore, artistScore),
    };
  }

  private scoreText(left: string, right: string): number {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);

    if (!normalizedLeft || !normalizedRight) {
      return 0.5;
    }

    if (normalizedLeft === normalizedRight) {
      return 1;
    }

    const similarity = this.levenshteinSimilarity(normalizedLeft, normalizedRight);
    return Math.max(0.3, similarity);
  }

  private scoreDuration(left?: number, right?: number): number {
    if (!left || !right) {
      return 0.5;
    }

    const delta = Math.abs(left - right);
    if (delta <= 2) {
      return 1;
    }

    if (delta <= 10) {
      return 0.8;
    }

    if (delta <= 30) {
      return 0.6;
    }

    return 0.2;
  }

  private scoreLanguage(left?: string, right?: string): number {
    if (!left || !right) {
      return 0.5;
    }
    return normalizeText(left) === normalizeText(right) ? 1 : 0.4;
  }

  private scoreBoolean(left?: boolean, right?: boolean): number {
    if (left === undefined || right === undefined) {
      return 0.5;
    }
    return left === right ? 1 : 0.2;
  }

  private scorePopularity(left?: number, right?: number): number {
    if (!left || !right) {
      return 0.5;
    }
    return Math.min(1, Math.max(0.3, (left + right) / 200));
  }

  private levenshteinSimilarity(left: string, right: string): number {
    if (left === right) {
      return 1;
    }

    const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i += 1) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= right.length; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    const maxLength = Math.max(left.length, right.length);
    return 1 - matrix[left.length][right.length] / maxLength;
  }

  private describeScore(confidence: number, titleScore: number, artistScore: number): string {
    if (confidence >= 95) {
      return 'Strong title and artist overlap';
    }

    if (titleScore >= 0.8 && artistScore >= 0.7) {
      return 'Moderate title and artist overlap';
    }

    return 'Fallback similarity match';
  }
}
