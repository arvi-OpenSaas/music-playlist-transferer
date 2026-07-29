import { Logger } from '@/utils/Logger';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  factor: number;
}

export interface RetryAttemptContext {
  attempt: number;
  delayMs: number;
  lastError?: Error;
}

export class RetryEngine {
  constructor(
    private readonly policy: RetryPolicy = {
      maxAttempts: 3,
      baseDelayMs: 500,
      factor: 2,
    },
    private readonly logger: Logger = new Logger({ module: 'RetryEngine' }),
  ) {}

  async runWithRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: unknown, attempt: number) => boolean = this.defaultShouldRetry,
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < this.policy.maxAttempts) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const retryable = shouldRetry(error, attempt);
        if (!retryable || attempt >= this.policy.maxAttempts) {
          throw error;
        }

        const delayMs = this.computeDelay(attempt);
        this.logger.warn(`Retrying operation after ${delayMs}ms (attempt ${attempt}/${this.policy.maxAttempts})`);
        await this.delay(delayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Retry failed');
  }

  getRetryContext(attempt: number, lastError?: Error): RetryAttemptContext {
    return {
      attempt,
      delayMs: this.computeDelay(attempt),
      lastError,
    };
  }

  private defaultShouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      return /timeout|network|temporar|rate limit|429|5\d\d/i.test(error.message);
    }
    return false;
  }

  private computeDelay(attempt: number): number {
    return this.policy.baseDelayMs * Math.pow(this.policy.factor, attempt - 1);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
