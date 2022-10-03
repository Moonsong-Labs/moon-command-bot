import { TaskFactory } from "../factory";
import { BlockTimeTask } from "./block-time";
import { ApiPromise } from "@polkadot/api";
import { getApiFor } from "moonbeam-tools";

export class BlockTimeFactory extends TaskFactory {
  private networkApis: ApiPromise[];

  constructor(keyword: string, networks: string[]) {
    super(keyword);
    const networkPromises = networks.map((name) =>
      getApiFor({ network: name })
    );

    this.isReady = Promise.all(networkPromises).then((apis) => {
      this.networkApis = apis;
      return this;
    });
  }

  public createTask(id: number) {
    return new BlockTimeTask(this.keyword, id, this.networkApis);
  }

  destroy() {}
}
