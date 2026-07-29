import { Logger } from '@/utils/Logger';
import { IStorage } from '@/storage/IStorage';
import { MusicProvider } from '@/providers/MusicProvider';
import { AppleMusicProvider } from '@/providers/AppleProvider';
import { YouTubeMusicProvider } from '@/providers/YoutubeProvider';
import { ProviderName } from '@/shared/types';
import { HarmonySyncError } from '@/shared/errors';

export class ProviderFactory {
  constructor(
    private readonly logger: Logger = new Logger({ module: 'ProviderFactory' }),
    private readonly storage: IStorage,
  ) {}

  createProvider(name: ProviderName): MusicProvider {
    switch (name) {
      case ProviderName.APPLE_MUSIC:
        return new AppleMusicProvider(this.logger, this.storage);
      case ProviderName.YOUTUBE_MUSIC:
        return new YouTubeMusicProvider(this.logger, this.storage);
      default:
        throw new HarmonySyncError(`Unsupported provider: ${name}`, {
          recoveryAction: 'ManualReview',
          retryable: false,
        });
    }
  }
}
