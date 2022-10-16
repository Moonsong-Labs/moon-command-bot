import Debug from "debug";
import { runTask } from "./runner";
const debug = Debug("actions:fork-test");

export type NetworkName = "moonbeam" | "moonriver" | "alphanet";
export const NETWORK_NAMES: NetworkName[] = [
  "moonbeam",
  "moonriver",
  "alphanet",
];

export const NETWORK_RUNTIMES: { [name in NetworkName]: string } = {
  moonbeam: "moonbeam",
  moonriver: "moonriver",
  alphanet: "moonbase",
};

export const NETWORK_FORK_NAMES: { [name in NetworkName]: string } = {
  moonbeam: "moonbeam",
  moonriver: "moonriver",
  alphanet: "moonbase-alpha",
};

export interface ForkTestConfig {
  // directory where cargo should run
  repoDirectory: string;
  // folder used to run the fork test
  dataFolder: string;

  // network
  network: NetworkName;
  // branch to run the fork from
  branch: string;
}

// TODO: Split this into multiple function doing what run-fork-test.sh
export async function executeForkTest(config: ForkTestConfig) {
  debug(`Starting fork-test of ${config.network} on ${config.branch}...`);

  if (!NETWORK_NAMES.includes(config.network)) {
    throw new Error(`Invalid network: ${config.network}`);
  }

  const result = await runTask(
    `./scripts/run-fork-test.sh 2>&1 | tee ${config.dataFolder}/run.log`,
    {
      cwd: config.repoDirectory,
      env: {
        ...process.env,
        RUNTIME_NAME: NETWORK_RUNTIMES[config.network],
        NETWORK: NETWORK_FORK_NAMES[config.network],
        ROOT_FOLDER: config.dataFolder,
        GIT_TAG: config.branch,
        USE_LOCAL_CLIENT: "true",
      },
    }
  );
  debug(`scripts/run-fork-test.sh finished`);
  return result;
}
