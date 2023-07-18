import {
  Delta,
  ISharedTree,
  SharedTreeFactory,
} from "@fluid-experimental/tree2";
import { InsecureTokenProvider } from "@fluidframework/test-client-utils";
import {
  AzureClient,
  AzureRemoteConnectionConfig,
  ITelemetryBaseEvent,
  ITelemetryBaseLogger,
} from "@fluidframework/azure-client";
import { IFluidContainer } from "@fluidframework/fluid-static";
import { ConnectionState } from "@fluidframework/container-loader";

class MySharedTree {
  public static getFactory(): any {
    return new SharedTreeFactory();
  }
  onDisconnect() {
    console.warn("disconnected");
  }
}

export type FluidMode = "frs" | "tiny";

export interface Workspace {
  containerId: string | undefined;
  container: IFluidContainer;
  tree: ISharedTree;
  dispose(): void;
}

export function getClient(
  userId: string,
  mode: FluidMode,
  logger: ITelemetryBaseLogger,
): AzureClient {
  console.log(`fluid mode is ${mode}`);
  switch (mode) {
    case "frs":
      const remoteConnectionConfig: AzureRemoteConnectionConfig = {
        type: "remote",
        tenantId: process.env.SECRET_FLUID_TENANT!,
        tokenProvider: new InsecureTokenProvider(
          process.env.SECRET_FLUID_TOKEN!,
          {
            id: userId,
            name: userId,
          }
        ),
        endpoint: process.env.SECRET_FLUID_RELAY!,
      };
      console.log(`Connecting to ${process.env.SECRET_FLUID_RELAY}`);
      return new AzureClient({
        connection: remoteConnectionConfig,
        logger,
      });
    default:
      console.log(`Connecting to http://localhost:7070`);
      return new AzureClient({
        connection: {
          type: "local",
          tokenProvider: new InsecureTokenProvider("", {
            id: userId,
            name: userId,
          }),
          endpoint: "http://localhost:7070",
        },
        logger,
      });
  }
}

export class ReadyLogger implements ITelemetryBaseLogger {
  send(event: ITelemetryBaseEvent) {
    console.log(`${JSON.stringify(event, null, 2)}`);
  }
}

export class CrashHandler implements ITelemetryBaseLogger {
  constructor(private readonly crashHandler: () => void) {}
  send(event: ITelemetryBaseEvent) {
    console.log(`${JSON.stringify(event, null, 2)}`);
    if (event.category === "error" || event.category === "generic") {
      if (event.canRetry === false) {
        this.crashHandler();
      } else if (event.attempts === 3) {
        this.crashHandler();
      }
    }
  }
}

export async function createSimpleWorkspace(
  containerId: string | undefined,
  mode: FluidMode,
  logger: ITelemetryBaseLogger | undefined = undefined,
): Promise<Workspace> {
  const createNew = containerId === undefined;
  const treeClass: any = MySharedTree;
  const containerSchema = {
    initialObjects: { tree: treeClass },
  };
  const client = getClient("benchmark", mode, logger );
  let containerAndServices;
  if (createNew) {
    containerAndServices = await client.createContainer(containerSchema);
    containerId = await containerAndServices.container.attach();
  } else {
    containerAndServices = await client.getContainer(
      containerId,
      containerSchema
    );
    await waitForFullyLoaded(containerAndServices.container);
  }
  const sharedTree = containerAndServices.container.initialObjects
    .tree as ISharedTree;
  return {
    containerId: containerId,
    container: containerAndServices.container,
    tree: sharedTree,
    dispose: () => {
      containerAndServices.container.dispose();
    },
  };
}

async function waitForFullyLoaded(container: IFluidContainer) {
  if (container.connectionState !== ConnectionState.Connected) {
    await new Promise<void>((resolve) => {
      container.once("connected", resolve);
    });
  }
}
