import { TaskFactory } from "../factory";
import { BlockTimeTask, NetworkConfig } from "./block-time";
import { ApiPromise } from "@polkadot/api";
import { getApiFor } from "moonbeam-tools";

export class BlockTimeFactory extends TaskFactory {
  private networkApis: NetworkConfig[];

  constructor(keyword: string, networks: string[]) {
    super(keyword);
    const networkPromises = networks.map((name) =>
      getApiFor({ network: name })
    );

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
