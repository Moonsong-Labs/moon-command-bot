import { TaskArguments, TaskFactory } from "../factory";
import { BlockTimeTask, Network } from "./block-time-task";
import { Argv as ApiNetworkConfig, getApiFor } from "moonbeam-tools";

export interface BlockTimeFactoryConfig {
  networks: ApiNetworkConfig[];
}

export type BlockTimeTaskArguments = TaskArguments & {
  positional: [target: string];
  options: {};
};

const HELP = `# Command block-time

Computes time information for a given block or time.

usage: \`block-time <time_or_block>\`

* time_or_block: The future or past block number or time to inspect.
time can be given in relative or absolute formats like. "*in 5 days*" or "*November 5th 2023*"

exemple: \`block-time in 1 month\` or \`block-time 1259344\`
`;

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

  public help() {
    return HELP;
  }

  public createTask(id: number, args: BlockTimeTaskArguments) {
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
