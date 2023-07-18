import {
  ContextuallyTypedNodeData,
  FieldKinds,
  ISharedTree,
  LocalFieldKey,
  SchemaAware,
  SchemaBuilder,
  SharedTreeFactory,
  ValueSchema,
  brand,
  rootFieldKey,
  typeNameSymbol,
  FlushableBinderOptions,
  ViewEvents,
  createFlushableBinderOptions,
  FlushableDataBinder,
  InvalidationBinderEvents,
  createDataBinderInvalidating,
  BindingType,
  BindSyntaxTree,
  BindTree,
  compileSyntaxTree,
  InvalidationBindingContext,
  OperationBinderEvents,
  DataBinder,
  createBinderOptions,
  BinderOptions,
  createDataBinderDirect,
  InsertBindingContext,
  toDownPath,
  BindPath,
  DownPath,
  DeleteBindingContext,
  createDataBinderBuffering,
  BatchBindingContext,
  VisitorBindingContext,
} from "@fluid-experimental/tree2";
import { Workspace, createSimpleWorkspace, FluidMode } from "./workspace";
import {
  SharedTreeMap,
  InvalidationBinder,
  OperationBinder,
  BatchedOperationBinder,
  MapOperation,
} from "./interfaces";
import { ITelemetryBaseLogger } from "@fluidframework/azure-client";

export const [contentField]: LocalFieldKey = brand("content");

const builder = new SchemaBuilder("10bc20fc-65e1-4f1d-99f2-cb5937306190");

export const stringSchema = builder.primitive("hex:String", ValueSchema.String);

export const mapStringSchema = builder.object("hex:Map<String>", {
  extraLocalFields: SchemaBuilder.field(FieldKinds.optional, stringSchema),
  value: ValueSchema.Serializable,
});

export const contentSchema = builder.object("hex:Content", {
  local: {
    [contentField]: SchemaBuilder.field(FieldKinds.optional, mapStringSchema),
  },
});

export const rootField = SchemaBuilder.field(
  FieldKinds.optional,
  contentSchema
);

export const fullSchemaData = builder.intoDocumentSchema(rootField);

class SimpleInvalidationBinder implements InvalidationBinder {
  dataBinder: FlushableDataBinder<InvalidationBinderEvents>;
  constructor(public readonly sharedTree: ISharedTree) {
    const options: FlushableBinderOptions<ViewEvents> =
      createFlushableBinderOptions({
        autoFlushPolicy: "afterBatch",
        matchPolicy: "subtree",
      });
    this.dataBinder = createDataBinderInvalidating(
      this.sharedTree.events,
      options
    );
  }
  bindOnInvalid(fn: () => void): () => void {
    const syntaxTree: BindSyntaxTree = { [contentField]: true };
    const bindTree: BindTree = compileSyntaxTree(syntaxTree);
    const root = this.sharedTree.context.root.getNode(0);
    this.dataBinder.register(
      root,
      BindingType.Invalidation,
      [bindTree],
      (invalidStateContext: InvalidationBindingContext) => {
        fn();
      }
    );
    return () => this.dataBinder.unregisterAll();
  }
}

class DirectBinder implements OperationBinder {
  dataBinder: DataBinder<OperationBinderEvents>;
  constructor(public readonly sharedTree: ISharedTree) {
    const options: BinderOptions = createBinderOptions({
      matchPolicy: "subtree",
    });
    this.dataBinder = createDataBinderDirect(sharedTree.events, options);
  }
  bindOnChange(
    insertCall: (key: string, value: string) => void,
    deleteCall: (key: string) => void
  ): () => void {
    const syntaxTree: BindSyntaxTree = { [contentField]: true };
    const bindTree: BindTree = compileSyntaxTree(syntaxTree);
    const root = this.sharedTree.context.root.getNode(0);
    this.dataBinder.register(
      root,
      BindingType.Insert,
      [bindTree],
      (insertContext: InsertBindingContext) => {
        const key: string = String(insertContext.path.parentField);
        const value: string = (insertContext.content[0] as any).siblings[0]
          .value;
        insertCall(key, value);
      }
    );
    this.dataBinder.register(
      root,
      BindingType.Delete,
      [bindTree],
      (deleteContext: DeleteBindingContext) => {
        const key: string = String(deleteContext.path.parentField);
        deleteCall(key);
      }
    );
    return () => this.dataBinder.unregisterAll();
  }
}

class BufferingBinder implements OperationBinder {
  dataBinder: FlushableDataBinder<OperationBinderEvents>;
  constructor(public readonly sharedTree: ISharedTree) {
    const options: FlushableBinderOptions<ViewEvents> =
      createFlushableBinderOptions({
        matchPolicy: "subtree",
        autoFlush: true,
        autoFlushPolicy: "afterBatch",
        sortFn: deletesFirst,
        sortAnchorsFn: () => 0,
      });
    this.dataBinder = createDataBinderBuffering(sharedTree.events, options);
  }
  bindOnChange(
    insertCall: (field: string, value: string) => void,
    deleteCall: (field: string) => void
  ): () => void {
    const syntaxTree: BindSyntaxTree = { [contentField]: true };
    const bindTree: BindTree = compileSyntaxTree(syntaxTree);
    const root = this.sharedTree.context.root.getNode(0);
    this.dataBinder.register(
      root,
      BindingType.Insert,
      [bindTree],
      (insertContext: InsertBindingContext) => {
        const key: string = String(insertContext.path.parentField);
        const value: string = (insertContext.content[0] as any).siblings[0]
          .value;
        insertCall(key, value);
      }
    );
    this.dataBinder.register(
      root,
      BindingType.Delete,
      [bindTree],
      (deleteContext: DeleteBindingContext) => {
        const key: string = String(deleteContext.path.parentField);
        deleteCall(key);
      }
    );
    return () => this.dataBinder.unregisterAll();
  }
}

class BatchedBinder implements BatchedOperationBinder {
  dataBinder: FlushableDataBinder<OperationBinderEvents>;
  constructor(public readonly sharedTree: ISharedTree) {
    const options: FlushableBinderOptions<ViewEvents> =
      createFlushableBinderOptions({
        matchPolicy: "subtree",
        autoFlush: true,
        autoFlushPolicy: "afterBatch",
        sortFn: deletesFirst,
        sortAnchorsFn: () => 0,
      });
    this.dataBinder = createDataBinderBuffering(sharedTree.events, options);
  }
  bindOnBatch(batchCall: (batch: MapOperation[]) => void): () => void {
    const syntaxTree: BindSyntaxTree = { [contentField]: true };
    const bindTree: BindTree = compileSyntaxTree(syntaxTree);
    const root = this.sharedTree.context.root.getNode(0);
    this.dataBinder.register(root, BindingType.Insert, [bindTree]);
    this.dataBinder.register(root, BindingType.Delete, [bindTree]);
    this.dataBinder.register(
      root,
      BindingType.Batch,
      [bindTree],
      (batchContext: BatchBindingContext) => {
        const batch: MapOperation[] = [];
        for (const event of batchContext.events) {
          if (event.type === BindingType.Insert) {
            const key: string = String(event.path.parentField);
            const value: string = (event.content[0] as any).siblings[0].value;
            batch.push({ type: "insert", key, value });
          } else if (event.type === BindingType.Delete) {
            const key: string = String(event.path.parentField);
            batch.push({ type: "delete", key });
          }
        }
        batchCall(batch);
      }
    );
    return () => this.dataBinder.unregisterAll();
  }
}

function deletesFirst(
  a: VisitorBindingContext,
  b: VisitorBindingContext
): number {
  if (a.type === BindingType.Delete && b.type === BindingType.Delete) {
    return 0;
  }
  if (a.type === BindingType.Delete) {
    return -1;
  }
  if (b.type === BindingType.Delete) {
    return 1;
  }
  return 0;
}

export type Entry = {
  key: string;
  value: string;
};

export async function initMap(
  mapId: string | undefined,
  fluidMode: FluidMode,
  logger: ITelemetryBaseLogger | undefined = undefined
): Promise<SharedTreeMap> {
  const workspace = await initWorkspace(mapId, fluidMode, logger);
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
    getInvalidationBinder: () => new SimpleInvalidationBinder(workspace.tree),
    getDirectBinder: () => new DirectBinder(workspace.tree),
    getBufferingBinder: () => new BufferingBinder(workspace.tree),
    getBatchingBinder: () => new BatchedBinder(workspace.tree),
    dispose: () => workspace.dispose(),
  };
}

export const EMPTY_TREE: ContextuallyTypedNodeData = {
  [typeNameSymbol]: contentSchema.name,
  [contentField]: {},
};

export async function initWorkspace(
  containerId: string | undefined,
  fluidMode: FluidMode,
  logger: ITelemetryBaseLogger | undefined = undefined
): Promise<Workspace> {
  const workspace = await createSimpleWorkspace(containerId, fluidMode, logger);
  const tree = workspace.tree;
  tree.storedSchema.update(fullSchemaData);
  if (containerId === undefined) tree.root = EMPTY_TREE;
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
