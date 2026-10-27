/** Bound network waits; local lessons must not hang behind an unreachable API. */
export function createBoundedFetch(fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init), timeoutMs = 8000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const external = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => {
          controller.abort();
          const error = new Error('Network request cancelled'); error.name = 'AbortError'; reject(error);
        };
        if (external?.aborted) onAbort();
        else external?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error('Network request timed out'); error.name = 'TimeoutError'; reject(error);
        }, timeoutMs);
      });
      if (external?.aborted) return await aborted;
      return await Promise.race([fetcher(input, { ...init, signal: controller.signal }), aborted]);
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort) external?.removeEventListener('abort', onAbort);
    }
  };
}
