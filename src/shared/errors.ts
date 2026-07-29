import { RETRY_DEFAULTS } from '@/shared/constants';

export type RecoveryAction = 'Retry' | 'Skip' | 'ManualReview';

export interface HarmonySyncErrorOptions {
  recoveryAction?: RecoveryAction;
  retryable?: boolean;
  innerError?: unknown;
  retryAttempts?: number;
}

export class HarmonySyncError extends Error {
  readonly reason: string;
  readonly recoveryAction: RecoveryAction;
  readonly retryable: boolean;
  readonly innerError?: unknown;
  readonly retryAttempts: number;

  constructor(reason: string, options: HarmonySyncErrorOptions = {}) {
    super(reason);
    this.name = 'HarmonySyncError';
    this.reason = reason;
    this.recoveryAction = options.recoveryAction ?? 'ManualReview';
    this.retryable = options.retryable ?? true;
    this.innerError = options.innerError;
    this.retryAttempts = options.retryAttempts ?? RETRY_DEFAULTS.maxAttempts;
  }
}
