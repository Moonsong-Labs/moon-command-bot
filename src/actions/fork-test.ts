import Debug from "debug";
import { runTask } from "./runner";
const debug = Debug("actions:fork-test");

export type NetworkName = "moonbeam" | "moonriver" | "alphanet";
export const NETWORK_NAMES: NetworkName[] = [
  "moonbeam",
  "moonriver",
  "alphanet",
];

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
        RUNTIME_NAME: "moonbeam",
        NETWORK: "moonbeam",
        ROOT_FOLDER: config.dataFolder,
        GIT_TAG: config.branch,
        USE_LOCAL_CLIENT: "true",
      },
    }
  );
  debug(`scripts/run-fork-test.sh finished`);
  return result;
}
