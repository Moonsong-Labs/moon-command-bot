import { BotConfig } from "./src/configs/config-types";

const config: BotConfig = {
  commander: { concurrentTasks: 10 },
  proxies: [
    {
      url: "http://localhost:8001/json",
      auth: { type: "secret", secret: "test" },
      commands: ["sample"],
    },
  ],
  commands: {
    "block-time": {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
    governance: {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
  },
  history: { limit: 1000 },
  hooks: {
    http: { urlPrefix: "/api" },
    json: { urlPrefix: "/json", auth: { type: "none" } },
  },
  server: {
    serverUrl: "http://localhost:8000",
    listener: { port: 8000, hostname: "0.0.0.0" },
  },
};

export default config;
