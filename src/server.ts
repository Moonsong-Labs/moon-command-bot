#!/usr/bin/env node

import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import yargs from "yargs";
import prodEnv from "./configs/production";
import localEnv from "./configs/local";
import devEnv from "./configs/dev";

import { BotConfig } from "./configs/config-types";
import { start } from ".";

function loadEnvConfig(envName: string) {
  if (!envName || envName.toLocaleLowerCase() == "dev") {
    console.log(`========== ${chalk.yellow("DEV")} environment =========`);
  } else if (envName.toLocaleLowerCase() == "production") {
    console.log(`====== ${chalk.red("PRODUCTION")} environment ======`);
  } else if (envName.toLocaleLowerCase() == "local") {
    console.log(`========= ${chalk.yellow("LOCAL")} environment ========`);
  } else {
    console.log(`======== ${chalk.red("CUSTOM")} environment ========`);
    console.log(`Loading env: ${chalk.red(envName)}`);
  }

  return envName.toLocaleLowerCase() == "dev"
    ? devEnv
    : envName.toLocaleLowerCase() == "production"
    ? prodEnv
    : envName.toLocaleLowerCase() == "local"
    ? localEnv
    : envName.endsWith(".json")
    ? (JSON.parse(fs.readFileSync(envName).toString()) as BotConfig)
    : (require(path.join(process.cwd(), envName)).default as BotConfig);
}

yargs(process.argv.slice(2))
  .usage("Usage: $0")
  .version("1.0.0")
  .options("env", {
    type: "string",
    description: "Environment configuration to load",
  })
  .command({
    command: "export-env [out] [env]",
    describe: "Export the given environment as json file",
    builder: (yargs) =>
      yargs.option("out", {
        describe: "File to write the json to",
        type: "string",
        demandOption: true,
      }),
    handler: (argv) => {
      const config = loadEnvConfig(
        (argv.env || process.env.BOT_ENV || "dev").toLocaleLowerCase()
      );
      fs.writeFileSync(argv.out, JSON.stringify(config, null, 2));
      console.log(`Exported env to ${chalk.red(argv.out)}`);
    },
  })
  .command({
    command: "* [env]",
    describe: "Run the bot",
    builder: (yargs) => yargs,
    handler: (argv) => {
      const config = loadEnvConfig(
        (argv.env || process.env.BOT_ENV || "dev").toLocaleLowerCase()
      );
      start(config);
    },
  })
  .help().argv;
