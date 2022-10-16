import { ApiPromise } from "@polkadot/api";
import { Task } from "../task";
import { moment } from "moment-parseplus";

import Debug from "debug";
import { computeBlockForMoment, getBlockDate } from "../../actions/block-time";
const debug = Debug("commands:blocktime");

export interface Network {
  name: string;
  api: ApiPromise;
}

export interface BlockTimeNumberParameters {
  blockNumber: number;
}

export interface BlockTimeDateParameters {
  dateText: string;
}

export type BlockTimeTaskParameters = (
  | BlockTimeNumberParameters
  | BlockTimeDateParameters
) & {
  networkApis: Network[];
};

export class BlockTimeTask extends Task {
  public readonly name: string;
  private cancelled: boolean;
  private namePadding: number;
  private parameters: BlockTimeTaskParameters;

  constructor(
    keyword: string,
    id: number,
    parameters: BlockTimeTaskParameters
  ) {
    super(keyword, id);
    this.parameters = parameters;
    this.cancelled = false;
    this.namePadding = Math.max(
      ...this.parameters.networkApis.map(({ name }) => name.length)
    );
    this.name = `Block time`;
  }

  public async execute() {
    //
    if ("blockNumber" in this.parameters) {
      const { blockNumber } = this.parameters;
      let progress = 0;
      await Promise.all(
        this.parameters.networkApis.map(async ({ api, name }) => {
          const { blockCount, date } = await getBlockDate(api, blockNumber);
          this.emit(
            "log",
            { time: Date.now() },
            "info",
            `${name.padStart(this.namePadding, " ").toString()}: #${blockNumber
              .toString()
              .padEnd(8, " ")} (${
              blockCount > 0
                ? `+${blockCount.toString().padEnd(7, " ")}`
                : `${blockCount.toString().padEnd(8, " ")}`
            }) - ${date.format("dddd, MMMM Do YYYY, h:mm:ss a")}`
          );
          this.emit(
            "progress",
            { time: Date.now() },
            Math.round((progress += 100 / this.parameters.networkApis.length))
          );
        })
      );
      return;
    }

    if ("dateText" in this.parameters) {
      const targetDate = moment(this.parameters.dateText);
      debug(
        `Checking time for "${
          this.parameters.dateText
        }", found ${targetDate.toISOString()}`
      );
      if (targetDate.isBefore(moment())) {
        throw new Error("Cannot (yet) compute past date blocks");
      }
      let progress = 0;
      await Promise.all(
        this.parameters.networkApis.map(async ({ api, name }) => {
          if (this.cancelled) {
            throw new Error("Cancelled");
          }
          const { block, date, blockCount } = await computeBlockForMoment(
            api,
            targetDate
          );
          this.emit(
            "log",
            { time: Date.now() },
            "info",
            `${name.padStart(this.namePadding, " ")}: #${block
              .toString()
              .padEnd(8, " ")} (+${blockCount
              .toString()
              .padEnd(8, " ")}) - ${date.format(
              "dddd, MMMM Do YYYY, h:mm:ss a"
            )}`
          );
          this.emit(
            "progress",
            { time: Date.now() },
            Math.round((progress += 100 / this.parameters.networkApis.length))
          );
        })
      );
      return;
    }

    throw new Error(`Unexpected block-time command`);
  }
  async cancel() {
    this.cancelled = true;
  }
}
