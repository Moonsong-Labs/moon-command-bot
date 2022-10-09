import { ApiPromise } from "@polkadot/api";
import { Task, TaskArguments } from "../task";
import { moment } from "moment-parseplus";

import Debug from "debug";
import { computeBlockForMoment, getBlockDate } from "../../actions/block-time";
import { promiseConcurrent } from "moonbeam-tools";
const debug = Debug("commands:Governance");

export interface Network {
  name: string;
  api: ApiPromise;
}

export type GovernanceTaskParameters = {
  networkApis: Network[];
};

export class GovernanceTask extends Task {
  public readonly name: string;
  private cancelled: boolean;
  private namePadding: number;
  private parameters: GovernanceTaskParameters;

  constructor(
    keyword: string,
    id: number,
    parameters: GovernanceTaskParameters
  ) {
    super(keyword, id);
    this.parameters = parameters;
    this.cancelled = false;
    this.name = `Governance information`;
    this.namePadding = Math.max(
      ...this.parameters.networkApis.map(({ name }) => name.length)
    );
  }

  public async execute() {
    //
    let progress = 0;
    for (const { api, name } of this.parameters.networkApis) {
      const blockHash = await api.rpc.chain.getBlockHash();
      const apiAt = await api.at(blockHash);

      const referendums = await api.derive.democracy.referendums();
      if (referendums.length > 0) {
        this.emit(
          "log",
          "info",
          `${name.toString().padStart(this.namePadding, " ")}: ${
            referendums.length
          } referendums`
        );
      }

      for (const referendum of referendums) {
        const preimageHash = referendum.imageHash;
        this.emit(
          "log",
          "info",
          `  [${referendum.index
            .toString()
            .padStart(4, " ")}]: ${preimageHash} (${
            referendum.isPassing ? `passing` : `failing`
          })`
        );
      }
      this.emit(
        "progress",
        Math.round((progress += 100 / this.parameters.networkApis.length))
      );
    }
  }
  async cancel() {
    this.cancelled = true;
  }
}
