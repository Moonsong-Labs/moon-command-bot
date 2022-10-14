import { TaskArguments, TaskFactory } from "../factory";
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
const HELP = `## Command \`sample\`

Simple command running a timer. Doesn't perform any
action. Is meant for **testing purposes**

usage: \`sample [time]\`

* time: Duration of the command in seconds (max: ${MAX_DELAY})

exemple: \`sample 5\`
`;

export class SampleFactory extends TaskFactory {
  // number of seconds before it ends
  private readonly seconds: number;

  constructor(keyword: string, { seconds }: SampleFactoryConfig) {
    super(keyword);
    this.seconds = seconds;

    this.isReady = Promise.resolve(this);
  }

  public help() {
    return HELP;
  }

  public createTask(id: number, args: SampleTaskArguments) {
    debug(args.positional);
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
