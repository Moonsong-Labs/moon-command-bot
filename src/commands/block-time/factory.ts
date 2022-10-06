import { TaskFactory } from "../factory";
import { BlockTimeTask, Network } from "./block-time";
import { Argv as ApiNetworkConfig, getApiFor } from "moonbeam-tools";
import { TaskArguments } from "../task";
export { Argv as ApiNetworkConfig } from "moonbeam-tools";

export interface BlockTimeFactoryConfig {
  networks: ApiNetworkConfig[];
}
export class BlockTimeFactory extends TaskFactory {
  private networkApis: Network[];

  constructor(keyword: string, { networks }: BlockTimeFactoryConfig) {
    super(keyword);
    const networkPromises = networks.map((network) => getApiFor(network));

    this.isReady = Promise.all(networkPromises).then(async (apis) => {
      this.networkApis = await Promise.all(
        apis.map(async (api) => {
          return { api, name: (await api.rpc.system.chain()).toString() };
        })
      );
      return this;
    });
  }

  public createTask(id: number, args: TaskArguments) {
    if (!args.positional || args.positional.length < 1) {
      throw new Error("not enough parameters");
    }

    const parameters =
      args.positional.length == 1 && typeof args.positional[0] == "number"
        ? { networkApis: this.networkApis, blockNumber: args.positional[0] }
        : {
            networkApis: this.networkApis,
            dateText: args.positional.join(" "),
          };
    return new BlockTimeTask(this.keyword, id, parameters);
  }

  destroy() {}
}
