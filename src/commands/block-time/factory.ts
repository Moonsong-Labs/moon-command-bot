import { TaskFactory } from "../factory";
import { BlockTimeTask, Network } from "./block-time";
import { Argv as ApiNetworkConfig, getApiFor } from "moonbeam-tools";
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

  public createTask(id: number) {
    return new BlockTimeTask(this.keyword, id, this.networkApis);
  }

  destroy() {}
}
