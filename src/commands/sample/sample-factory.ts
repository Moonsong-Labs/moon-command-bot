import { TaskFactory } from "../factory";
import { TaskArguments } from "../task";
import { SampleTask } from "./sample-task";
import Debug from "debug";
const debug = Debug("commands:sample-factory");

export class SampleFactoryConfig {
  seconds: number;
}

export type SampleTaskArguments = TaskArguments & {
  positional: [seconds?: number];
};

const MAX_DELAY = 15;

export class SampleFactory extends TaskFactory {
  // number of seconds before it ends
  private readonly seconds: number;

  constructor(keyword: string, { seconds }: SampleFactoryConfig) {
    super(keyword);
    this.seconds = seconds;
  }

  public createTask(id: number, args: SampleTaskArguments) {
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
