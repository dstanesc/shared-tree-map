import {
  ContextuallyTypedNodeData,
  ISharedTreeView,
  SharedTreeFactory,
} from "@fluid-experimental/tree2";
import { AllowedUpdateType } from "@fluid-experimental/tree2/dist/core";
import {
  ContextuallyTypedNodeDataObject,
  typeNameSymbol,
} from "@fluid-experimental/tree2/dist/feature-libraries";
import { contentField, contentSchema, fullSchemaData, initMap } from "../api";
import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils";
import { IFluidDataStoreRuntime } from "@fluidframework/datastore-definitions";
import { SharedTreeMap } from "../interfaces";
import { v4 as uuid } from "uuid";
import * as assert from "assert";

const DEMO_PAYLOAD = "large & complex payload";

describe("shared-tree map", () => {
  let sharedMap: SharedTreeMap = undefined;
  let localModel: Map<string, string> = new Map<string, string>();
  const updateLocalModel = (values: Map<string, string>) => {
    localModel.clear();
    for (const key of values.keys()) {
      localModel.set(key, values.get(key));
    }
  };
  const shareData = async (data: Map<string, string>) => {
    sharedMap = await initMap(undefined);
    const binder = sharedMap.getBinder();
    binder.bindOnBatch(() => {
      updateLocalModel(sharedMap.asMap());
    });
    sharedMap.setMany(data);
    return sharedMap.mapId();
  };
  const deleteSharedData = () => {
    for (const key of localModel.keys()) {
      sharedMap.delete(key);
    }
  };
  const cleanUp = () => {
    localModel = new Map<string, string>();
  };
  const dispose = () => {
    sharedMap.dispose();
  };
  afterAll(() => {
    cleanUp();
    dispose();
  });

  test("Publish", async () => {
    const data = new Map([[uuid(), DEMO_PAYLOAD]]);
    await shareData(data).then((mapId) => {
      sharedMap.forEach((value, key) => {
        console.log(`Reading published entry ok "${key} => ${value}"`);
      });
      assert.equal(1, localModel.size);
    });
  });

  test("Delete", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    console.log(
      `Before delete, property tree keys ${JSON.stringify(
        propertyTreeKeysBefore
      )}`
    );
    assert.equal(1, propertyTreeKeysBefore.length);
    deleteSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    console.log(
      `After delete, property tree keys ${JSON.stringify(
        propertyTreeKeysAfter
      )}`
    );
    assert.equal(0, propertyTreeKeysAfter.length);
    console.log(`Done deleting data`);
    sharedMap.forEach((value, key) => {
      console.log(`This entry should not exist "${key} => ${value}"`);
    });
    assert.equal(0, localModel.size);
  });

  test("Debug editable tree", async () => {
    const view = treeView(TEST_DATA);
    view.root = TEST_DATA;
    const proxy = view.context.unwrappedRoot;
    for (const key of Object.keys(proxy)) {
      if (typeof proxy[key] === "string") {
        console.log("key", key);
        console.log("value", proxy[key]);
      }
    }
    const content = proxy[contentField];
    debug(content);
    assert.equal(1, Object.keys(content).length);
  });

  test("Publish editable tree", async () => {
    const view = treeView(EMPTY_TREE);
    const proxy = view.context.unwrappedRoot;
    const content = proxy[contentField];
    content["key1"] = "value1";
    content["key2"] = "value2";
    content["key3"] = "value3";
    debug(content);
    assert.equal(3, Object.keys(content).length);
  });
});

export const EMPTY_TREE: ContextuallyTypedNodeData = {
  [typeNameSymbol]: contentSchema.name,
  [contentField]: {},
};

function debug(obj: any) {
  for (const key of Object.keys(obj)) {
    console.log(`Debug: ${key}:${obj[key]}`);
  }
}

function treeView(initialData: ContextuallyTypedNodeData): ISharedTreeView {
  const factory = new SharedTreeFactory();
  const tree = factory.create(new MockFluidDataStoreRuntime(), "test");
  return tree.schematize({
    allowedSchemaModifications: AllowedUpdateType.None,
    initialTree: EMPTY_TREE,
    schema: fullSchemaData,
  });
}

export const TEST_DATA: ContextuallyTypedNodeDataObject = {
  [typeNameSymbol]: contentSchema.name,
  [contentField]: {
    test: "test1",
  },
};
