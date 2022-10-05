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
export class BlockTimeTask extends Task {
  private networkApis: Network[];
  public readonly name: string;
  private cancelled: boolean;
  private namePadding: number;

  constructor(keyword: string, id: number, networkApis: Network[]) {
    super(keyword, id);
    this.networkApis = networkApis;
    this.cancelled = false;
    this.namePadding = Math.max(...networkApis.map(({ name }) => name.length));
    this.name = `Block time`;
  }

  public async execute(parameters: { [name: string]: string }) {
    const words = parameters.cmdLine.trim().split(" ");
    if (words.length < 2) {
      throw new Error("not enough parameters");
    }

    if (words.length == 2) {
      const blockNumber = parseInt(words[1]);
      let progress = 0;
      await Promise.all(
        this.networkApis.map(async ({ api, name }) => {
          const { blockCount, date } = await getBlockDate(api, blockNumber);
          this.emit(
            "log",
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
            Math.round((progress += 100 / this.networkApis.length))
          );
        })
      );
      return;
    }

    const text = parameters.cmdLine.split(" ").slice(1).join(" ");
    const targetDate = moment(text);
    debug(`Checking time for "${text}", found ${targetDate.toISOString()}`);
    if (targetDate.isBefore(moment())) {
      throw new Error("Cannot (yet) compute past date blocks");
    }
    let progress = 0;
    await Promise.all(
      this.networkApis.map(async ({ api, name }) => {
        if (this.cancelled) {
          throw new Error("Cancelled");
        }
        const { block, date, blockCount } = await computeBlockForMoment(
          api,
          targetDate
        );
        this.emit(
          "log",
          "info",
          `${name.padStart(this.namePadding, " ")}: #${block
            .toString()
            .padEnd(8, " ")} (+${blockCount
            .toString()
            .padEnd(8, " ")}) - ${date.format("dddd, MMMM Do YYYY, h:mm:ss a")}`
        );
        this.emit(
          "progress",
          Math.round((progress += 100 / this.networkApis.length))
        );
      })
    );
  }
  async cancel() {
    this.cancelled = true;
  }
}
