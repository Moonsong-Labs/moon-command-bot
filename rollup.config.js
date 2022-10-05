import path from "node:path";

import commonjs from "@rollup/plugin-commonjs";
import alias from "@rollup/plugin-alias";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";
import strip from "rollup-plugin-strip";
import typescript from "rollup-plugin-typescript2";
import { preserveShebangs } from "rollup-plugin-preserve-shebangs";
import pkg from "./package.json";

const root = __dirname;
const src = path.join(root, "src");
const mod = path.join(root, "node_modules");

const external = [
  "assert",
  "buffer",
  "crypto",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "querystring",
  "stream",
  "string_decoder",
  "tty",
  "url",
  "util",
  "zlib",
];

export default [
  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" },
    ],
    external,
    plugins: [
      typescript({
        abortOnError: false,
        tsconfigOverride: { compilerOptions: { module: "es2020" } },
      }),
      commonjs({ include: ["node_modules/debug/src/index.js"] }),
    ],
  },
  {
    input: "src/server.ts",
    output: [{ file: "./bins/moon-bot/moon-bot.cjs", format: "cjs" }],
    external,
    plugins: [
      alias({
        debug: "node_modules/debug/src/common.js",
        entries: [
          {
            find: "@polkadot/x-textdecoder",
            replacement: "node_modules/@polkadot/x-textdecoder/node.js",
          },
          {
            find: "@polkadot/x-textencoder",
            replacement: "node_modules/@polkadot/x-textencoder/node.js",
          },
          {
            find: "@polkadot/x-fetch",
            replacement: "node_modules/@polkadot/x-fetch/node.js",
          },
          {
            find: "@polkadot/x-randomvalues",
            replacement: "node_modules/@polkadot/x-randomvalues/node.js",
          },
          {
            find: "@polkadot/x-ws",
            replacement: "node_modules/@polkadot/x-ws/node.js",
          },
          {
            find: "@polkadot/wasm-crypto",
            replacement: "node_modules/@polkadot/wasm-crypto/cjs/bundle.js",
          },
          {
            find: "@polkadot/wasm-crypto-init",
            replacement: "node_modules/@polkadot/wasm-crypto-init/cjs/wasm.js",
          },
        ],
      }),
      replace({
        preventAssignment: true,
        values: { "'string_decoder/'": "'string_decoder'" },
        delimiters: ["", ""],
      }),
      resolve({
        browser: false,
        preferBuiltins: true,
        mainFields: ["module", "main", "jsnext:main"],
        extensions: [".js", ".json", ".ts"],
      }),
      typescript({
        abortOnError: false,
        tsconfigOverride: { compilerOptions: { module: "es2020" } },
      }),
      preserveShebangs(),
      commonjs(),
      json(),
      strip({
        functions: ["assert.*"],
        include: [path.join(src, "**/*.ts"), path.join(mod, "**/*.(js|ts)")],
        sourceMap: false,
      }),
      terser(),
    ],
  },
];
