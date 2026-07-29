import { LogEntry, LogLevel } from '@/shared/types';

export interface LoggerOptions {
  maxEntries?: number;
  module?: string;
}

export class Logger {
  private readonly entries: LogEntry[] = [];
  private readonly maxEntries: number;
  private readonly module: string;

  constructor(options: LoggerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100;
    this.module = options.module ?? 'HarmonySync';
  }

  info(message: string): void {
    this.push('info', message);
  }

  warn(message: string): void {
    this.push('warn', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  debug(message: string): void {
    this.push('debug', message);
  }

  getEntries(): LogEntry[] {
    return [...this.entries].reverse();
  }

  clear(): void {
    this.entries.length = 0;
  }

  private push(level: LogLevel, message: string): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp: Date.now(),
      level,
      message: `[${this.module}] ${message}`,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }

    if (level === 'error') {
      console.error(entry.message);
      return;
    }

    if (level === 'warn') {
      console.warn(entry.message);
      return;
    }

    if (level === 'debug') {
      console.debug(entry.message);
      return;
    }

    console.info(entry.message);
  }
}
