import {
  ContextuallyTypedNodeData,
  ISharedTreeView,
  SharedTreeFactory,
  typeNameSymbol,
  AllowedUpdateType,
} from "@fluid-experimental/tree2";

import { jest } from "@jest/globals";

import { MockFluidDataStoreRuntime } from "@fluidframework/test-runtime-utils";
import { MapOperation, SharedTreeMap } from "../interfaces";
import { v4 as uuid } from "uuid";
import * as assert from "assert";

import {
  contentField,
  contentSchema,
  fullSchemaData,
  initMap,
  CrashHandler,
  FluidMode,
} from "..";

const DEMO_PAYLOAD = "large & complex payload";
const DEMO_PAYLOAD_UPDATED = "updated large & complex payload";

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
    sharedMap = await initMap(undefined, process.env.FLUID_MODE as FluidMode);
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
    sharedMap = await initMap(undefined, process.env.FLUID_MODE as FluidMode);
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
    sharedMap = await initMap(undefined, process.env.FLUID_MODE as FluidMode);
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
  const updateSharedData = () => {
    for (const key of sharedMap.keys()) {
      sharedMap.set(key, DEMO_PAYLOAD_UPDATED);
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

  test("Update", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    updateSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(1, propertyTreeKeysAfter.length);
    assert.equal(1, localModel.size);
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
    sharedMap = await initMap(undefined, process.env.FLUID_MODE as FluidMode);
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
  const updateSharedData = () => {
    for (const key of sharedMap.keys()) {
      sharedMap.set(key, DEMO_PAYLOAD_UPDATED);
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

  test("Update", () => {
    const propertyTreeKeysBefore = sharedMap.keys();
    assert.equal(1, propertyTreeKeysBefore.length);
    updateSharedData();
    const propertyTreeKeysAfter = sharedMap.keys();
    assert.equal(1, propertyTreeKeysAfter.length);
    assert.equal(1, localModel.size);
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

describe("shared-tree map:: test pad for crash detection", () => {
  jest.setTimeout(1000000);
  let sharedMap: SharedTreeMap = undefined;
  let remoteMap: SharedTreeMap = undefined;
  let localModel: Map<string, string> = new Map<string, string>();
  const entryCount = 10;
  const shareData = async (data: Map<string, string>) => {
    sharedMap = await initMap(
      undefined,
      process.env.FLUID_MODE as FluidMode,
      new CrashHandler(() => {
        process.exit(1);
      })
    );
    const binder = sharedMap.getBufferingBinder();
    binder.bindOnChange(
      (key: string, value: string) => {
        localModel.set(key, value);
      },
      (key: string) => {
        localModel.delete(key);
      }
    );
    return sharedMap.mapId();
  };
  const deleteSharedData = () => {
    for (const key of localModel.keys()) {
      sharedMap.delete(key);
    }
  };
  const updateSharedData = () => {
    for (const key of sharedMap.keys()) {
      sharedMap.set(key, DEMO_PAYLOAD_UPDATED);
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

  const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
  const waitCompleteLocalState = (
    map: Map<string, string>,
    expectedCount: number,
    timeout = 1000 * 20
  ) => {
    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        if (map.size === expectedCount) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - startTime >= timeout) {
          clearInterval(interval);
          reject(
            new Error(
              `Timeout: Local state did not reach the expected number of entries within ${timeout}ms`
            )
          );
        }
      }, 100); // Check every 100ms
    });
  };

  test("Publish", async () => {
    const data = new Map();
    for (let i = 0; i < entryCount; i++) {
      data.set(uuid(), DEMO_PAYLOAD);
    }
    const mapId = await shareData(data);
    remoteMap = await initMap(
      mapId,
      process.env.FLUID_MODE as FluidMode,
      new CrashHandler(() => {
        process.exit(1);
      })
    );
    await sleep(1000 * 5);
    remoteMap.setMany(data);
    await waitCompleteLocalState(localModel, entryCount, 1000 * 20);
  });

  // test("Update", () => {
  //   updateSharedData();
  //   assert.equal(entryCount, localModel.size);
  // });

  // test("Delete", () => {
  //   const propertyTreeKeysBefore = sharedMap.keys();
  //   assert.equal(entryCount, propertyTreeKeysBefore.length);
  //   deleteSharedData();
  //   assert.equal(0, localModel.size);
  // });
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
