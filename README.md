# moon-command-bot

Bot to handle commands for github/slack/...

# Installation

```
sudo npm install -g @moonbeam-network/moon-bot
```

## Using source

```
git clone https://github.com/purestake/moon-command-bot
```

# How to use

## Starting the bot

```
moon-bot
```

## Using the source

```
npm run start
```

## Hooks

The bot is able to receive commands from different sources:

### Github

Through `/<command> <...args>` from comments in github issues and pull_request. The bot will reply by creating a new comment.

It requires to configure the github hook with webhook information.

#### Webhook Registration

To support Github Webhook, you need to setup a webhook in your repo. This is done directly in the `webhook` section of the repository. You will also need to add the MoonCommandBot application (see next section) in order to reply to the comment.

Webhook settings: https://github.com/purestake/moonbeam/settings/hooks
`Add Webhook`, here are the suggested parameters:

- Payload Url: https://your-domain-or-ip.com/github (the `/github` should match the urlPrefix in your config: `/github` by default)
- Content Type: `application/json`
- Secret: `<generated-very-long-random-string>` (Copy the secret into your [configuration](#configuration) probot => secret)
- Select **individual events** => `Issue comments`

### Slack

Through `/<bot_name> <command> <...args>` in channels having the bot as a member.

It requires setting up a bot in slack (TODO: Add instructions)

### HTTP API

Through the url provided by the bot, it is possible to also trigger commands:

Ex: http://localhost:8000/api/sample

(Support for JSON format will come soon)

## Help

Users can query the help for all the commands by providing the keyword "help"

## Commands

There are multiple commands in the [commands](src/commands) folder.
Each one has its dedicated folder and can be enabled through the config.

Here are some of them:

- Sample: Triggers a timer of X (default: 10) seconds (for testing purposes)
- Benchmark: Triggers build and benchmark of moonbeam binary (requires a dedicated/powerful hardware)
- block-time: Returns the expected/past block number at a given time and vice et versa.
  It requires substrate tools/libraries like cargo (see https://docs.substrate.io/install/linux/)
- fork-test: Execute a fork-test locally (requires `jq` to be installed).

# Configuration

The bot is flexible and allows to choose which `hook` and `command` to use.
There are currently 3 pre-defined configuration:
[Production](src/configs/production.ts): Enable all the hooks/commands. It requires environment variables
[Local](src/configs/local.ts): Enable all commands but only the API HTTP hook. It requires environment variables
[Dev](src/configs/dev.ts): Only enable commands without external effect. Doesn't require environment variables

You can specify the predefined configuration using the `BOT_ENV` environment variable or the `--env` option. Ex:

```bash
BOT_ENV=production npm run start
npm run start -- --env "local"
```

(`--` is required if you use `npm`, you need to remove it if you execute the script directly)

## Custom configuration

### Custom typescript config

The benefit of using a typescript config file is to import environment variables.  
You can copy one of the config sample or modify it and start the script with your ts file:

```
npm run start -- export-env --env local --out my-config.ts
```

It is possible to make your own configuration, by copying the config-sample-xxx.ts or by running the `export-env` subcommand and modifying your json file:

```
npm run start -- export-env --env local --out my-env.json
```

This will create a file `my-env.json` which you can tweak and then load with `npm run start -- --env my-env.json`

## Proxy support

It is possible to define a proxy for your main bot.
Proxying allows you to pass a command to another bot (dedicated to some specific tasks for exemple).

In the env configuration, you can pass:

```
proxies: [
  {
    url: "https://my-proxy.com/json",
    auth: {
      type: "secret",
      secret: "whatever-you-want-as-a-secret",
    },
    commands: ["benchmark", "fork-test"]
  }
]
```

(The proxy server needs to have the json hook enabled with matching auth)

# Linting and formatting

The commands `npm run format` and `npm run lint` are available for ensuring
style consistency on this project's code.

# Running

## Locally

`npm && npm start`

# Required Github settings

## Permissions

- Metadata: Read Only
- Issues: Read/Write
- Pull Requests: Read/Write
- Contents: Read/Write

## Event subscriptions

- Issue comments
