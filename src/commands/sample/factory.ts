import { TaskFactory } from "../factory";
import { TaskArguments } from "../task";
import { SampleTask } from "./sample";
import Debug from "debug";
const debug = Debug("commands:sample-factory");

export class SampleFactoryConfig {
  seconds: number;
}

export type SampleTaskParameters = TaskArguments & {
  // The pull request to execute the benchmark on
  // It is used by the github hook and override the given --pr parameter
  positional: [type: string, palletName: string];
  options: {
    pullNumber?: string;
  };
};

const MAX_DELAY = 15;

export class SampleFactory extends TaskFactory {
  // number of seconds before it ends
  private readonly seconds: number;

  constructor(keyword: string, { seconds }: SampleFactoryConfig) {
    super(keyword);
    this.seconds = seconds;
  }

  public createTask(id: number, args: TaskArguments) {
    debug(args.positional)
    const delay =
      args.positional && args.positional.length > 0
        ? parseInt(args.positional[0].toString())
        : this.seconds;
    if (isNaN(delay) || delay > MAX_DELAY || delay < 1) {
      throw new Error(
        `Invalid delay: ${delay} (Max allowed value: ${MAX_DELAY}`
      );
    }

    return new SampleTask(this.keyword, id, delay);
  }

  destroy() {}
}
