#!/usr/bin/env node

import chalk from "chalk";
import fs from "node:fs";
import prodEnv from "./configs/production";
import localEnv from "./configs/local";
import devEnv from "./configs/dev";

import { BotConfig } from "./configs/config-types";
import { start } from ".";

if (!process.env.BOT_ENV || process.env.BOT_ENV.toLocaleLowerCase() == "dev") {
  console.log(`========== ${chalk.yellow("DEV")} environment =========`);
  start(devEnv);
} else if (process.env.BOT_ENV.toLocaleLowerCase() == "production") {
  console.log(`====== ${chalk.red("PRODUCTION")} environment ======`);
  start(prodEnv);
} else if (process.env.BOT_ENV.toLocaleLowerCase() == "local") {
  console.log(`========= ${chalk.yellow("LOCAL")} environment ========`);
  start(localEnv);
} else {
  console.log(`======== ${chalk.red("CUSTOM")} environment ========`);
  console.log(`Loading env: ${chalk.red(process.env.BOT_ENV)}`);
  start(
    JSON.parse(fs.readFileSync(process.env.BOT_ENV).toString()) as BotConfig
  );
}
