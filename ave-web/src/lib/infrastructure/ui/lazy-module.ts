export function lazyModule<T>(loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => pending ??= loader();
}
