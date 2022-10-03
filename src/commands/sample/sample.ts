import { Writable } from "node:stream";
import { Task } from "../task";
import Debug from "debug";
const debug = Debug("commands:sample");

export class SampleTask extends Task {
  public isReady: Promise<SampleTask>;
  public readonly name: string;
  private cancelled: boolean;

  constructor(keyword: string, id: number) {
    super(keyword, id);
    this.name = `A simple task with 10s timer`;
  }

  public async execute(_: { [name: string]: string }) {
    for (const i of new Array(10).fill(0).map((_, i) => i)) {
      if (this.cancelled) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      this.emit("progress", 10 * i, `Timer ${i}`);
      this.emit("log", "debug", `Moving to timer ${i}`);
    }
    this.emit("progress", 100, `Success`);
  }

  async cancel() {
    this.cancelled = true;
  }
}
