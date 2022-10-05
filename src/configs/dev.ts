import { BotConfig } from "./config-types";

const prodConfig: BotConfig = {
  commands: {
    sample: { seconds: 10 },
    benchmark: null,
    "block-time": {
      networks: [
        { network: "alphanet" },
        { network: "moonriver" },
        { network: "moonbeam" },
      ],
    },
  },
  history: { limit: 1000, urlPrefix: "/history/test/tasks" },
  hooks: { http: { urlPrefix: "/api" } },
  server: { url: "http://localhost:8000", listener: {port: 8000, hostname: "0.0.0.0" }},
};

export default prodConfig;
