export async function* pollJson<T>(
  fetcher: () => Promise<T[]>,
  key: (item: T) => string,
  intervalMs = 1000,
): AsyncIterable<T> {
  const seen = new Set<string>();
  while (true) {
    const items = await fetcher();
    for (const item of items) {
      const id = key(item);
      if (!seen.has(id)) {
        seen.add(id);
        yield item;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

