import {
  ContextuallyTypedNodeData,
  ISharedTreeView,
  SharedTreeFactory,
  typeNameSymbol,
  AllowedUpdateType,
} from "@fluid-experimental/tree2";

import { contentField, contentSchema, fullSchemaData, initMap } from "../api";
import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils";
import { MapOperation, SharedTreeMap } from "../interfaces";
import { v4 as uuid } from "uuid";
import * as assert from "assert";

const DEMO_PAYLOAD = "large & complex payload";

describe("shared-tree map:: invalidation binder", () => {
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
    const binder = sharedMap.getInvalidationBinder();
    binder.bindOnInvalid(() => {
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
    const uqKey = uuid();
    const data = new Map([[uqKey, DEMO_PAYLOAD]]);
    await shareData(data).then((mapId) => {
      sharedMap.forEach((value, key) => {
        console.log(`Reading published entry ok "${key} => ${value}"`);
      });
      assert.equal(1, localModel.size);
      assert.equal(DEMO_PAYLOAD, localModel.get(uqKey));
    });
  });

  test("Delete", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    deleteSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(0, propertyTreeKeysAfter.length);
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
    assert.equal(1, Object.keys(content).length);
  });

  test("Publish editable tree", async () => {
    const view = treeView(EMPTY_TREE);
    const proxy = view.context.unwrappedRoot;
    const content = proxy[contentField];
    content["key1"] = "value1";
    content["key2"] = "value2";
    content["key3"] = "value3";
    assert.equal(3, Object.keys(content).length);
  });
});

describe("shared-tree map:: direct binder", () => {
  let sharedMap: SharedTreeMap = undefined;
  let localModel: Map<string, string> = new Map<string, string>();
  const shareData = async (data: Map<string, string>) => {
    sharedMap = await initMap(undefined);
    const binder = sharedMap.getDirectBinder();
    const insertCall = (key: string, value: string) => {
      localModel.set(key, value);
    };
    const deleteCall = (key: string) => {
      localModel.delete(key);
    };
    binder.bindOnChange(insertCall, deleteCall);
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
    const uqKey = uuid();
    const data = new Map([[uqKey, DEMO_PAYLOAD]]);
    await shareData(data).then((mapId) => {
      sharedMap.forEach((value, key) => {
        console.log(`Reading published entry ok "${key} => ${value}"`);
      });
      assert.equal(1, localModel.size);
      assert.equal(DEMO_PAYLOAD, localModel.get(uqKey));
    });
  });

  test("Delete", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    deleteSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(0, propertyTreeKeysAfter.length);
    assert.equal(0, localModel.size);
  });
});

describe("shared-tree map:: buffering binder", () => {
  let sharedMap: SharedTreeMap = undefined;
  let localModel: Map<string, string> = new Map<string, string>();
  const shareData = async (data: Map<string, string>) => {
    sharedMap = await initMap(undefined);
    const binder = sharedMap.getBufferingBinder();
    binder.bindOnChange(
      (key: string, value: string) => {
        localModel.set(key, value);
      },
      (key: string) => {
        localModel.delete(key);
      }
    );
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
    const uqKey = uuid();
    const data = new Map([[uqKey, DEMO_PAYLOAD]]);
    await shareData(data).then((mapId) => {
      sharedMap.forEach((value, key) => {
        console.log(`Reading published entry ok "${key} => ${value}"`);
      });
      assert.equal(1, localModel.size);
      assert.equal(DEMO_PAYLOAD, localModel.get(uqKey));
    });
  });

  test("Delete", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    deleteSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(0, propertyTreeKeysAfter.length);
    assert.equal(0, localModel.size);
  });
});

describe("shared-tree map:: batched binder", () => {
  let sharedMap: SharedTreeMap = undefined;
  let localModel: Map<string, string> = new Map<string, string>();
  const shareData = async (data: Map<string, string>) => {
    sharedMap = await initMap(undefined);
    const binder = sharedMap.getBatchingBinder();
    binder.bindOnBatch((batch: MapOperation[]) => {
      for (const op of batch) {
        if (op.type === "insert") {
          localModel.set(op.key, op.value);
        } else if (op.type === "delete") {
          localModel.delete(op.key);
        }
      }
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
    const uqKey = uuid();
    const data = new Map([[uqKey, DEMO_PAYLOAD]]);
    await shareData(data).then((mapId) => {
      sharedMap.forEach((value, key) => {
        console.log(`Reading published entry ok "${key} => ${value}"`);
      });
      assert.equal(1, localModel.size);
      assert.equal(DEMO_PAYLOAD, localModel.get(uqKey));
    });
  });

  test("Delete", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    deleteSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(0, propertyTreeKeysAfter.length);
    assert.equal(0, localModel.size);
  });
});

const EMPTY_TREE: ContextuallyTypedNodeData = {
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
    initialTree: initialData as any,
    schema: fullSchemaData,
  });
}

const TEST_DATA: ContextuallyTypedNodeData = {
  [typeNameSymbol]: contentSchema.name,
  [contentField]: {
    test: "test1",
  },
};
