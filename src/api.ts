import {
  ContextuallyTypedNodeData,
  FieldKinds,
  ISharedTree,
  LocalFieldKey,
  SchemaAware,
  SharedTreeFactory,
  TypedSchema,
  ValueSchema,
  brand,
  rootFieldKey,
  typeNameSymbol,
} from "@fluid-experimental/tree2";
import { Workspace, createSimpleWorkspace } from "./workspace";
import { SharedTreeMap } from "./interfaces";

export const [contentField]: LocalFieldKey = brand("content");

export const stringSchema = TypedSchema.tree("hex:String", {
  value: ValueSchema.String,
});

export const mapStringSchema = TypedSchema.tree("hex:Map<String>", {
  extraLocalFields: TypedSchema.field(FieldKinds.optional, stringSchema),
  value: ValueSchema.Serializable,
});

export const contentSchema = TypedSchema.tree("hex:Content", {
  local: {
    [contentField]: TypedSchema.field(FieldKinds.optional, mapStringSchema),
  },
});

export const rootContentSchema = TypedSchema.field(
  FieldKinds.optional,
  contentSchema
);

export const fullSchemaData = SchemaAware.typedSchemaData(
  [[rootFieldKey, rootContentSchema]],
  stringSchema,
  mapStringSchema,
  contentSchema
);

export interface DataBinder extends BatchBinder {}

export interface BatchBinder {
  bindOnBatch(fn: () => void): () => void;
}

class SimpleBinder implements DataBinder {
  constructor(public readonly sharedTree: ISharedTree) {}
  bindOnBatch(fn: () => void): () => void {
    const unregister = this.sharedTree.events.on("afterBatch", () => {
      fn();
    });
    return () => unregister();
  }
}

export type Entry = {
  key: string;
  value: string;
};

export async function initMap(
  mapId: string | undefined
): Promise<SharedTreeMap> {
  const workspace = await initWorkspace(mapId);
  return {
    mapId: () => workspace.containerId,
    delete: (key: string) => deleteEntry(key, workspace),
    get: (key: string) => getEntry(key, workspace).value,
    has: (key: string) => getEntry(key, workspace) !== undefined,
    set: (key: string, value: string) => {
      setEntry(key, value, workspace);
      return this;
    },
    keys: () => getKeys(workspace),
    values: () => getValues(workspace),
    entries: () => getEntries(workspace),
    asMap: () => {
      const map = new Map<string, string>();
      getEntries(workspace).forEach((entry) => map.set(entry.key, entry.value));
      return map;
    },
    forEach: (callbackfn: (value: string, key: string) => void) => {
      getEntries(workspace).forEach((entry) =>
        callbackfn(entry.value, entry.key)
      );
    },
    setMany: (map: Map<string, string>) => {
      setManyEntries(map, workspace);
      return this;
    },
    deleteMany: (keys: string[]) => deleteManyEntries(keys, workspace),
    getBinder: () => new SimpleBinder(workspace.tree),
    dispose: () => workspace.dispose(),
  };
}

export const EMPTY_TREE: ContextuallyTypedNodeData = {
  [typeNameSymbol]: contentSchema.name,
  [contentField]: {},
};

export async function initWorkspace(containerId: string): Promise<Workspace> {
  const workspace = await createSimpleWorkspace(containerId);
  const tree = workspace.tree;
  tree.storedSchema.update(fullSchemaData);
  tree.root = EMPTY_TREE;
  return workspace;
}

function getMap(workspace: Workspace) {
  const tree = workspace.tree;
  const proxy = tree.context.unwrappedRoot;
  const map = proxy[contentField];
  return map;
}

export function getEntry(key: string, workspace: Workspace): Entry {
  const map = getMap(workspace);
  const value = map[key];
  return { key, value };
}

export function setEntry(key: string, value: string, workspace: Workspace) {
  const map = getMap(workspace);
  map[key] = value;
}

export function deleteEntry(key: string, workspace: Workspace) {
  const map = getMap(workspace);
  delete map[key];
}

export function getKeys(workspace: Workspace): string[] {
  const map = getMap(workspace);
  return Object.keys(map);
}

export function getEntries(workspace: Workspace): Entry[] {
  const map = getMap(workspace);
  return Object.keys(map).map((key) => ({ key, value: map[key] }));
}

export function getValues(workspace: Workspace): string[] {
  const map = getMap(workspace);
  return Object.values(map);
}

export function setManyEntries(map: Map<string, string>, workspace: Workspace) {
  const proxy = getMap(workspace);
  for (const [key, value] of map.entries()) {
    proxy[key] = value;
  }
}

export function deleteManyEntries(keys: string[], workspace: Workspace) {
  const proxy = getMap(workspace);
  for (const key of keys) {
    delete proxy[key];
  }
}