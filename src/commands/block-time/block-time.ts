import { ApiPromise } from "@polkadot/api";
import { Task } from "../task";
import { moment } from "moment-parseplus";

import Debug from "debug";
import { computeBlockForMoment, getBlockDate } from "../../actions/block-time";
const debug = Debug("commands:blocktime");

export class BlockTimeTask extends Task {
  private networkApis: ApiPromise[];
  public readonly name: string;
  private cancelled: boolean;

  constructor(keyword: string, id: number, networkApis: ApiPromise[]) {
    super(keyword, id);
    this.networkApis = networkApis;
    this.cancelled = false;
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
        this.networkApis.map(async (api) => {
          const { blockCount, date } = await getBlockDate(api, blockNumber);
          this.emit(
            "log",
            "info",
            `${(await api.rpc.system.chain()).toString()}: #${blockNumber} (${
              blockCount > 0 ? `+${blockCount}` : `${blockCount}`
            }) - ${date.format("dddd, MMMM Do YYYY, h:mm:ss a")}`
          );
          this.emit("progress", (progress += 100 / networkNames.length));
        })
      );
    }

    const text = parameters.cmdLine.split(" ").slice(1).join(" ");
    const targetDate = moment(text);
    debug(`Checking time for "${text}", found ${targetDate.toISOString()}`);
    if (targetDate.isBefore(moment())) {
      throw new Error("Cannot (yet) compute past date blocks");
    }
    const networkNames = Object.keys(this.networkApis);
    let progress = 0;
    await this.networkApis.map(async (api) => {
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
        `${(
          await api.rpc.system.chain()
        ).toString()}: #${block} (+${blockCount}) - ${date.format(
          "dddd, MMMM Do YYYY, h:mm:ss a"
        )}`
      );
      this.emit("progress", (progress += 100 / networkNames.length));
    });
  }
  async cancel() {
    this.cancelled = true;
  }
}
