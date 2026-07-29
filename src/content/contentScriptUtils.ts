export interface ContentResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function createResponse<T>(data?: T): ContentResponse<T> {
  return { ok: true, data };
}

export function createErrorResponse(message: string): ContentResponse<never> {
  return { ok: false, error: message };
}

export function waitForDomReady(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }

    const timer = window.setTimeout(() => {
      resolve();
    }, timeoutMs);

    document.addEventListener('DOMContentLoaded', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export function scrollUntilStable(iterations = 5): Promise<void> {
  return new Promise((resolve) => {
    let remaining = iterations;

    const step = () => {
      window.scrollTo(0, document.body.scrollHeight);
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.setTimeout(step, 200);
    };

    step();
  });
}
