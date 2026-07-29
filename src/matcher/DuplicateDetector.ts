import { DuplicateSong, Song } from '@/shared/types';
import { normalizeText } from '@/utils/Helpers';

export class DuplicateDetector {
  detect(sourceSongs: Song[], destinationSongs: Song[]): DuplicateSong[] {
    const duplicates: DuplicateSong[] = [];

    for (const sourceSong of sourceSongs) {
      const normalizedSource = this.normalizedKey(sourceSong);
      const matchingDestination = destinationSongs.find((song) => this.normalizedKey(song) === normalizedSource);

      if (matchingDestination) {
        duplicates.push({
          sourceSong,
          duplicateOf: matchingDestination,
          reason: 'Normalized title/artist match',
        });
      }
    }

    return duplicates;
  }

  private normalizedKey(song: Song): string {
    return normalizeText(`${song.title} ${song.artists.join(' ')}`);
  }
}
