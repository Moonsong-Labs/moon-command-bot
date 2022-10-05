import { TaskFactory } from "../factory";
import { SampleTask } from "./sample";

export class SampleFactoryConfig {
  seconds: number;
}
export class SampleFactory extends TaskFactory {
  // number of seconds before it ends
  private readonly seconds: number;

  constructor(keyword: string, {seconds}: SampleFactoryConfig) {
    super(keyword);
    this.seconds = seconds;
  }

  public createTask(id: number) {
    return new SampleTask(this.keyword, id, this.seconds);
  }

  destroy() {}
}
