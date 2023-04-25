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

class MySharedTree {
  public static getFactory(): any {
    return new SharedTreeFactory();
  }
  onDisconnect() {
    console.warn("disconnected");
  }
}

export interface Workspace {
  containerId: string | undefined;
  container: IFluidContainer;
  tree: ISharedTree;
  dispose(): void;
}

export function getClient(
  userId: string,
  logger: ITelemetryBaseLogger
): AzureClient {
  console.log(`ENV.FLUID_MODE is ${process.env.FLUID_MODE}`);
  switch (process.env.FLUID_MODE) {
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
    case "router": //guesswork, untested
      const routerConnectionConfig: AzureRemoteConnectionConfig = {
        type: "remote",
        tenantId: "fluid",
        tokenProvider: new InsecureTokenProvider(
          "create-new-tenants-if-going-to-production",
          { id: userId, name: userId }
        ),
        endpoint: "http://localhost:3003",
      };
      console.log(`Connecting to ${routerConnectionConfig.endpoint}`);
      return new AzureClient({
        connection: routerConnectionConfig,
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
    console.log(
      `Custom telemetry object array: ${JSON.stringify(event, null, 2)}`
    );
  }
}

export async function createSimpleWorkspace(
  containerId: string | undefined,
  logger: ITelemetryBaseLogger | undefined = undefined
): Promise<Workspace> {
  const createNew = containerId === undefined;
  const treeClass: any = MySharedTree;
  const containerSchema = {
    initialObjects: { tree: treeClass },
  };
  const client = getClient("benchmark", logger);
  let containerAndServices;
  if (createNew) {
    containerAndServices = await client.createContainer(containerSchema);
    containerId = await containerAndServices.container.attach();
  } else {
    containerAndServices = await client.getContainer(
      containerId,
      containerSchema
    );
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
