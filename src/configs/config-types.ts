import { BenchmarkFactoryConfig } from "../commands/benchmark/benchmark-factory";
import { BlockTimeFactoryConfig } from "../commands/block-time/block-time-factory";
import { SampleFactoryConfig } from "../commands/sample/sample-factory";
import { GithubHookConfig } from "../hooks/github-hook";
import { HttpHookConfig } from "../hooks/http-hook";
import { SlackHookConfig } from "../hooks/slack-hook";
import { TaskHistoryConfig } from "../services/task-history";

export interface BotConfig {
  commands: {
    sample?: SampleFactoryConfig;
    benchmark?: BenchmarkFactoryConfig;
    "block-time"?: BlockTimeFactoryConfig;
  };
  hooks: {
    http?: HttpHookConfig;
    github?: {
      [name: string]: GithubHookConfig;
    };
    slack?: SlackHookConfig;
  };
  history: TaskHistoryConfig;
  server: {
    listener: {
      hostname: string;
      port: number;
    }
  }
}
