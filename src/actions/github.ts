import { Writable } from "node:stream";
import { runTask } from "./runner";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import Debug from "debug";
const debug = Debug("actions:github");

