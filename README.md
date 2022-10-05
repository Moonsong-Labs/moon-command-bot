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

It requires to configure the github hook with webhook information. (TODO: Add instructions)

### Slack

Through `/<bot_name> <command> <...args>` in channels having the bot as a member.

It requires setting up a bot in slack (TODO: Add instructions)

### HTTP API

Through the url provided by the bot, it is possible to also trigger commands:

Ex: http://localhost:8000/api/sample

(Support for JSON format will come soon)

## Commands

There are multiple commands in the [commands](src/commands) folder.
Each one has its dedicated folder and can be enabled through the config.

Here are some of them:

- Sample: Triggers a timer of X (default: 10) seconds (for testing purposes)
- Benchmark: Triggers build and benchmark of moonbeam binary (requires a dedicated/powerful hardware)
- block-time: Returns the expected/past block number at a given time and vice et versa.

# Configuration

The bot is flexible and allows to choose which `hook` and `command` to use.
There are currently 3 pre-defined configuration:
[Production](src/configs/production.ts): Enable all the hooks/commands. It requires environment variables
[Local](src/configs/local.ts): Enable all commands but only the API HTTP hook. It requires environment variables
[Dev](src/configs/dev.ts): Only enable commands without external effect. Doesn't require environment variables

You can specify the predefined configuration using the `BOT_ENV` environment variable. Ex:

```bash
BOT_ENV=production npm run start
```

## Custom configuration

It is possible to make your own configuration:

- Copy the [env-sample.json](./env-sample.json) to your own json file (ex: `my-env.json`)
- Modify your json file to add/remove hooks/services/
- Start the service with `BOT_ENV=my-env.json npm run start`

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
