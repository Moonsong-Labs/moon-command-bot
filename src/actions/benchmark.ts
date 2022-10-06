import * as path from "path";
import * as fs from "fs/promises";
import { runTask } from "./runner";
import Debug from "debug";
const debug = Debug("actions:benchmark");

const cwd = process.cwd();

// const cargoRun = "cargo run --features=runtime-benchmarks --bin moonbeam -- ";
const cargoRun = "cargo run ";

const ORIGINAL_REMOTE_NAME = "original";
const FORK_REMOTE_NAME = "fork";

export interface PalletCommand {
  type: "pallet";
  palletName:
    | "crowdloan-rewards"
    | "parachain-staking"
    | "author-mapping"
    | "asset-manager";
}

export type Command = PalletCommand;

type CommandRunConfig = {
  [key in PalletCommand["type"]]: {
    title: string;
    cmd: string;
  };
};

export const commandRunConfigs: CommandRunConfig = {
  pallet: {
    title: "Runtime Pallet",
    cmd: [
      cargoRun,
      "--release",
      "--bin moonbeam",
      "--features=runtime-benchmarks",
      "--",
      "benchmark",
      "pallet",
      "--chain=dev",
      "--steps=50",
      "--repeat=20",
      "--pallet={pallet_name}",
      '--extrinsic="*"',
      "--execution=wasm",
      "--wasm-execution=compiled",
      "--heap-pages=4096",
      // "--header=./file_header.txt",
      "--template=./benchmarking/frame-weight-template.hbs",
      "--output=./pallets/{pallet_folder}/src/weights.rs",
    ].join(" "),
  },
};

export interface BenchRunConfig {
  // directory where cargo should run
  repoDirectory: string;
  // Branch to run the benchmark against
  branch: string;
  // Parameters benchmark command (ex: "pallet author-mapping")
  command: Command;
}

function checkRuntimeBenchmarkCommand(command) {
  let required = [
    "benchmark",
    "--pallet",
    "--extrinsic",
    "--execution",
    "--wasm-execution",
    "--steps",
    "--repeat",
    "--chain",
  ];
  let missing: string[] = [];
  for (const flag of required) {
    if (!command.includes(flag)) {
      missing.push(flag);
    }
  }

  return missing;
}
export interface PalletConfig {
  name: string;
  benchmark: string;
  dir: string;
}

export const PALLET_CONFIGS = {
  "crowdloan-rewards": {
    name: "crowdloan-rewards",
    benchmark: "pallet_crowdloan_rewards",
    dir: "crowdloan-rewards", // TODO: how can this be included in the moonbeam codebase?
  },
  "parachain-staking": {
    name: "parachain-staking",
    benchmark: "parachain_staking",
    dir: "parachain-staking",
  },
  "author-mapping": {
    name: "author-mapping",
    benchmark: "pallet_author_mapping",
    dir: "author-mapping",
  },
  "asset-manager": {
    name: "asset-manager",
    benchmark: "pallet_asset_manager",
    dir: "asset-manager",
  },
};
export type PalletName = keyof typeof PALLET_CONFIGS;

export const PALLET_NAMES = Object.keys(PALLET_CONFIGS) as PalletName[];

// Verifies the type and name used for benchmark are currently supported
export function validateCommand(type: string, name: string): Command {
  if (type == "pallet" && PALLET_CONFIGS[name]) {
    return { type, palletName: name as PalletName };
  }
  throw new Error(`Invalid benchmark ${type} ${name}`);
}


export async function benchmarkRuntime(config: BenchRunConfig) {
  debug(`Starting benchmark of ${config.command.type}...`);

  const runConfig = commandRunConfigs[config.command.type];
  if (!runConfig) {
    throw new Error(`Config for ${config.command.type} missing`);
  }

  // Complete the command with pallet information
  const palletInfo =
    PALLET_CONFIGS[
      validateCommand(config.command.type, config.command.palletName).palletName
    ];

  const completeBenchCommand = runConfig.cmd
    .replace("{pallet_name}", palletInfo.benchmark)
    .replace("{pallet_folder}", palletInfo.dir);

  let missing = checkRuntimeBenchmarkCommand(completeBenchCommand);
  if (missing.length > 0) {
    throw new Error(`Missing required flags: ${missing.toString()}`);
  }

  debug(
    `Started ${config.command.type} benchmark "${runConfig.title}." (command: ${completeBenchCommand})`
  );

  const outputFile = completeBenchCommand.match(
    /--output(?:=|\s+)(".+?"|\S+)/
  )[1];
  if (!outputFile) {
    throw new Error(`Missing output file parameter`);
  }

  debug(``);
  debug(`Running benchmark, expected output: ${outputFile}`);
  const logs = await runTask(
    completeBenchCommand,
    { cwd: config.repoDirectory },
    `Running for branch ${config.branch}, 
      outputFile: ${outputFile}: ${completeBenchCommand}`
  );
  return { logs, outputFile, benchCommand: completeBenchCommand };
}
