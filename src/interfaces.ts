import { DataBinder } from "./api";

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
  getBinder(): DataBinder;

  // map identity token (provide as arg to initMap for distributed editing)
  mapId(): string;
  // container life-cycle
  dispose(): void;
}
