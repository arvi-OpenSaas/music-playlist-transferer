import { MatchResult, ScoredCandidate, Song, TransferAction } from '@/shared/types';

export interface Matcher {
  match(sourceSong: Song, candidates: Song[]): Promise<MatchResult>;
}

export class SimpleMatcher implements Matcher {
  async match(sourceSong: Song, candidates: Song[]): Promise<MatchResult> {
    const scoredCandidates: ScoredCandidate[] = candidates.map((candidate) => ({
      song: candidate,
      score: this.scoreSong(sourceSong, candidate),
      reason: this.describeMatch(sourceSong, candidate),
    }));

    scoredCandidates.sort((left, right) => right.score - left.score);

    const best = scoredCandidates[0];
    const confidence = best ? best.score : 0;

    let action: TransferAction = 'manual-review';
    if (confidence >= 95) {
      action = 'auto';
    } else if (confidence >= 80) {
      action = 'ask';
    }

    return {
      sourceSong,
      candidates: scoredCandidates,
      selectedMatch: best?.song,
      confidence,
      action,
    };
  }

  private scoreSong(sourceSong: Song, candidate: Song): number {
    const titleScore = this.compareText(sourceSong.title, candidate.title);
    const artistScore = this.compareText(sourceSong.artists.join(' '), candidate.artists.join(' '));
    const albumScore = sourceSong.album && candidate.album ? this.compareText(sourceSong.album, candidate.album) : 0;

    const weighted = titleScore * 0.6 + artistScore * 0.25 + albumScore * 0.15;
    return Math.round(weighted * 100);
  }

  private describeMatch(sourceSong: Song, candidate: Song): string {
    return `Title ${this.compareText(sourceSong.title, candidate.title).toFixed(2)} / Artist ${this.compareText(sourceSong.artists.join(' '), candidate.artists.join(' ')).toFixed(2)}`;
  }

  private compareText(left: string, right: string): number {
    const normalizedLeft = left.toLowerCase().trim();
    const normalizedRight = right.toLowerCase().trim();

    if (!normalizedLeft || !normalizedRight) {
      return 0;
    }

    if (normalizedLeft === normalizedRight) {
      return 1;
    }

    const distance = this.levenshteinDistance(normalizedLeft, normalizedRight);
    const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
    return Math.max(0, 1 - distance / Math.max(1, maxLength));
  }

  private levenshteinDistance(left: string, right: string): number {
    const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

    for (let index = 0; index <= left.length; index += 1) {
      matrix[index][0] = index;
    }

    for (let index = 0; index <= right.length; index += 1) {
      matrix[0][index] = index;
    }

    for (let row = 1; row <= left.length; row += 1) {
      for (let column = 1; column <= right.length; column += 1) {
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost,
        );
      }
    }

    return matrix[left.length][right.length];
  }
}
