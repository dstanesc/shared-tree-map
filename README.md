# Shared Tree Map

Minimal Fluid SharedTree DDS instantiation for testing purposes.

## Install

```
npm install --save-dev @dstanesc/shared-tree-map
```

## Usage

```ts
import { initMap } from "@dstanesc/shared-tree-map";
const sharedMap = await initMap(mapId);
sharedMap.set("key1", "abc");
sharedMap.set("key2", "def");
```

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