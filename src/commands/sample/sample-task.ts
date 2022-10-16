import { Task } from "../task";
import Debug from "debug";
const debug = Debug("commands:sample");

export class SampleTask extends Task {
  public isReady: Promise<SampleTask>;
  public readonly name: string;
  private readonly time: number;
  private cancelled: boolean;

  constructor(keyword: string, id: number, time: number) {
    super(keyword, id);
    this.time = time;
    this.name = `A simple task with ${time}s timer`;
  }

  public async execute() {
    for (const i of new Array(this.time).fill(0).map((_, i) => i)) {
      if (this.cancelled) {
        return;
      }
      this.emit("log", { time: Date.now() }, "debug", `Moving to timer ${i}`);
      this.emit(
        "progress",
        { time: Date.now() },
        (100 * i) / this.time,
        `Timer ${i}`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    this.emit("progress", { time: Date.now() }, 100, `Success`);
  }

  async cancel() {
    this.cancelled = true;
  }
}
