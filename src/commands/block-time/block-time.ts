import { ApiPromise } from "@polkadot/api";
import { Task } from "../task";
import moment from "moment";

import Debug from "debug";
import { computeBlockForMoment } from "../../actions/block-time";
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
    const [subcommand, ...additional] = parameters.cmdLine.split(" ").slice(1);
    if (!subcommand || additional.length == 0) {
      throw new Error("not enough parameters");
    }

    if (subcommand == "at") {
      const targetDate = moment(additional.join(" "));
      if (targetDate.isBefore(moment())) {
        throw new Error("Cannot (yet) compute past date blocks");
      }
      const networkNames = Object.keys(this.networkApis);
      let progress = 0;
      for (const api of this.networkApis) {
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
            await api.query.systen.chain()
          ).toString()}: #${block} (+${blockCount}) - ${date.format(
            "dddd, MMMM Do YYYY, h:mm:ss a"
          )}`
        );
        this.emit("progress", (progress += 100 / networkNames.length));
      }
    }
  }
  async cancel() {
    this.cancelled = true;
  }
}
