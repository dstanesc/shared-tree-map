export interface SharedTreeMap {
  delete(key: string): void;
  forEach(callbackfn: (value: string, key: string) => void): void;
  get(key: string): string | undefined;
  has(key: string): boolean;
  set(key: string, value: string): this;
  keys(): string[];
  values(): string[];
  entries(): { key: string; value: string }[];

  // utility methods
  asMap(): Map<string, string>;
  setMany(map: Map<string, string>): this;
  deleteMany(keys: string[]): void;

  /**
   * Returns a binder that can be used to subscribe to invalidation events.
   * It is safe to read the map from within the callback.
   */
  getInvalidationBinder(): InvalidationBinder;
  /**
   * Returns a binder that can be used to subscribe to individual operations.
   * The binder will be notified while the change is applied to the map.
   * It is not safe to read the map from within the callback.
   */
  getDirectBinder(): OperationBinder;
  /**
   * Returns a binder which buffers operations until a consistent state is reached, then flushed.
   * It is safe to read the map from within the callback.
   */
  getBufferingBinder(): OperationBinder;
  /**
   * Returns a binder which buffers operations until a consistent state is reached, then flushed.
   * It is safe to read the map from within the callback.
   */
  getBatchingBinder(): BatchedOperationBinder;

  /*
   * Map identity token (provide as arg to initMap for distributed editing)
   */
  mapId(): string;

  /*
   * container life-cycle
   */
  dispose(): void;
}

/**
 * Invalidation binder is used to subscribe to invalidation events.
 */
export interface InvalidationBinder {
  bindOnInvalid(fn: () => void): () => void;
}

/**
 * Operation binder is used to subscribe to individual operations.
 */
export interface OperationBinder {
  bindOnChange(
    insertCall: (key: string, value: string) => void,
    deleteCall: (key: string) => void
  ): () => void;
}

/**
 * Custom domain (ie. Map) operation for batching purposes.
 */
export interface MapOperation {
  type: "insert" | "delete";
  key: string;
  value?: any;
}

/**
 * Batched operation binder is used to subscribe to batches of operations.
 */
export interface BatchedOperationBinder {
  bindOnBatch(batchCall: (batch: MapOperation[]) => void): () => void;
}
