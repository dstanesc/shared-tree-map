# Shared Tree Map

Minimal Fluid SharedTree DDS instantiation for testing purposes. Includes data binding.

## Install

```
npm install @dstanesc/shared-tree-map
```

## Usage

Author data

```ts
import { initMap } from "@dstanesc/shared-tree-map";
const sharedMap = await initMap(mapId);
sharedMap.set("key1", "abc");
sharedMap.set("key2", "def");
sharedMap.delete("key1");
```

Subscribe to changes using the invalidation binder

```ts
import { initMap } from "@dstanesc/shared-tree-map";
const sharedMap = await initMap(mapId);
const binder = sharedMap.getInvalidationBinder();
binder.bindOnInvalid(() => {
  updateLocalModel(sharedMap.asMap());
});
```

Subscribe to changes using the direct binder. It is unsafe to read the shared map directly from the callback. It is recommended to use the buffering binder instead.

```ts
const binder = sharedMap.getDirectBinder();
binder.bindOnChange(
  (key: string, value: string) => {
    localModel.set(key, value);
  },
  (key: string) => {
    localModel.delete(key);
  }
);
```

Subscribe to changes using the buffering binder

```ts
const binder = sharedMap.getBufferingBinder();
binder.bindOnChange(
  (key: string, value: string) => {
    localModel.set(key, value);
  },
  (key: string) => {
    localModel.delete(key);
  }
);
```

Subscribe to changes using the batching binder

```ts
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
```

## Used By

[Hello World](https://github.com/dstanesc/shared-tree-map-hello)

## Configure Fluid Service

Configure the Fluid service w/ environment variables `FLUID_MODE=frs|router|tiny`

If `frs` is opted for, set-up both `SECRET_FLUID_TENANT` and `SECRET_FLUID_TOKEN` env. vars. (as configured in your azure service - `Tenant Id` respectively `Primary key` )

Example

```

FLUID_MODE=frs
SECRET_FLUID_TOKEN=xyz
SECRET_FLUID_TENANT=xyz

```

## Build & Test

> Note: npm tests are pre-configured with the `FLUID_MODE=tiny` setting (see `package.json`)

```sh
npx tinylicious
```

```sh
npm run clean
npm install
npm run build
npm run test
```

## Licenses

Licensed under either [Apache 2.0](http://opensource.org/licenses/MIT) or [MIT](http://opensource.org/licenses/MIT) at your option.
