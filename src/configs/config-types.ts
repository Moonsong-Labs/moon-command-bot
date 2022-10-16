import { ForkTestFactoryConfig } from "../commands/fork-test/fork-test-factory";
import { GovernanceFactoryConfig } from "../commands/governance/governance-factory";
import { BenchmarkFactoryConfig } from "../commands/benchmark/benchmark-factory";
import { BlockTimeFactoryConfig } from "../commands/block-time/block-time-factory";
import { SampleFactoryConfig } from "../commands/sample/sample-factory";
import { GithubHookConfig } from "../hooks/github-hook";
import { HttpHookConfig } from "../hooks/http-hook";
import { JsonHookConfig } from "../hooks/json-hook";
import { SlackHookConfig } from "../hooks/slack-hook";
import { HistoryServiceConfig } from "../services/history";
import { ProxyServiceConfig } from "../services/proxy";

export interface BotConfig {
  commander: {
    concurrentTasks: number;
  };
  commands: {
    sample?: SampleFactoryConfig;
    benchmark?: BenchmarkFactoryConfig;
    "block-time"?: BlockTimeFactoryConfig;
    governance?: GovernanceFactoryConfig;
    "fork-test"?: ForkTestFactoryConfig;
  };
  hooks: {
    http?: HttpHookConfig;
    json?: JsonHookConfig;
    github?: {
      [name: string]: GithubHookConfig;
    };
    slack?: SlackHookConfig;
  };
  proxies?: ProxyServiceConfig[];
  history?: HistoryServiceConfig;
  server: {
    serverUrl: string;
    listener: {
      hostname: string;
      port: number;
    };
  };
}
