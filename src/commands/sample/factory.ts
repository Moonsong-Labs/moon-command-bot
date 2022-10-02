import { TaskFactory } from "../factory";
import { SampleTask } from "./sample";

export class SampleFactory extends TaskFactory {
  public createTask(id: number) {
    return new SampleTask(this.keyword, id);
  }

  destroy() {}
}
