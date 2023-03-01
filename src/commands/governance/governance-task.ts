import "@polkadot/api-augment";
import "@moonbeam-network/api-augment";
import { BN, BN_TEN } from "@polkadot/util";
import { ApiPromise } from "@polkadot/api";

import { Task } from "../task";
import { moment } from "moment-parseplus";
import humanizeNumber from "humanize-number";

import { callInterpreter, getReferendumByGroups } from "moonbeam-tools";
import Debug from "debug";
import { getBlockDate } from "../../actions/block-time";
import { renderCallMarkdown } from "../../utils/call";
const debug = Debug("commands:Governance");

export interface Network {
  name: string;
  api: ApiPromise;
}

export type GovernanceTaskParameters = {
  networkApis: Network[];
};

export class GovernanceTask extends Task {
  public readonly name: string;
  private cancelled: boolean;
  private parameters: GovernanceTaskParameters;

  constructor(
    keyword: string,
    id: number,
    parameters: GovernanceTaskParameters
  ) {
    super(keyword, id);
    this.parameters = parameters;
    this.cancelled = false;
    this.name = `Governance information`;
  }

  public async execute() {
    //
    let progress = 0;
    const networkDemocracy = await Promise.all(
      this.parameters.networkApis.map(async ({ api, name }) => {
        const header = await api.rpc.chain.getHeader();

        const referendumV1 = await api.derive.democracy.referendums();
        const messages = await Promise.all(
          referendumV1.map(async (referendum) => {
            const preimageHash = referendum.imageHash;
            const polkadotPrefix = name == "Moonbase Alpha" ? "moonbase" : name;

            const endBlock = referendum.status.end.isubn(1).toNumber();
            let imageText = "";
            let subText = null;
            if (
              referendum.image &&
              referendum.image.proposal &&
              referendum.image.proposal
            ) {
              const callData = await callInterpreter(
                api,
                await api.registry.createType("Call", referendum.image.proposal)
              );
              imageText = callData.text;
              subText =
                callData.depth == 0
                  ? null
                  : callData.subCalls
                      .map((c) => renderCallMarkdown(c, "  \n", 1))
                      .join("  \n");
            } else {
              imageText = preimageHash.toString();
            }

            const yes = referendum.votedAye.div(
              BN_TEN.pow(new BN(api.registry.chainDecimals[0]))
            );

            const no = referendum.votedNay.div(
              BN_TEN.pow(new BN(api.registry.chainDecimals[0]))
            );

            return {
              sortKey: endBlock,
              message: `${
                referendum.isPassing ? `:green_circle:` : `:red_circle:`
              } [${referendum.index
                .toString()
                .padStart(
                  4,
                  " "
                )}](https://${polkadotPrefix}.polkassembly.network/referendum/${
                referendum.index
              }) - \`${imageText}\` ( :thumbsup:${humanizeNumber(
                yes.toNumber()
              )} vs ${humanizeNumber(no.toNumber())}:thumbsdown: | ${moment
                .duration(
                  moment((await getBlockDate(api, endBlock)).date).diff(
                    moment()
                  )
                )
                .humanize()} left)${subText ? `  \n${subText}` : ""}`,
            };
          })
        );

        this.emit(
          "progress",
          { time: Date.now() },
          Math.floor(
            (progress += 100 / (this.parameters.networkApis.length * 2))
          )
        );
        return { version: "1", name, messages };
      })
    );

    const networkReferendums = await Promise.all(
      this.parameters.networkApis.map(async ({ api, name }) => {
        const totalIssuance = await api.query.balances.totalIssuance();
        const currentBlock = (
          await api.rpc.chain.getHeader()
        ).number.toNumber();

        const toBlockMoment = async (
          api: ApiPromise,
          endBlock: BN,
          symbol: string
        ) => {
          if (currentBlock > endBlock.toNumber()) {
            return `${moment
              .duration(
                moment(
                  (await getBlockDate(api, endBlock.toNumber())).date
                ).diff(moment())
              )
              .humanize()} ago`;
          }
          return `${moment
            .duration(
              moment((await getBlockDate(api, endBlock.toNumber())).date).diff(
                moment()
              )
            )
            .humanize()}->${symbol}`;
        };

        const referendum = await getReferendumByGroups(api);
        const messages = await Promise.all(
          referendum.map(async (ref) => {
            const polkadotPrefix = name == "Moonbase Alpha" ? "moonbase" : name;

            const enactmentDelayFromNow = ref.ongoing.enactment.isAfter
              ? currentBlock +
                Math.max(
                  ref.ongoing.enactment.asAfter.toNumber(),
                  ref.track.minEnactmentPeriod.toNumber()
                )
              : Math.max(
                  currentBlock + ref.track.minEnactmentPeriod.toNumber(),
                  ref.ongoing.enactment.asAt.toNumber()
                );

            const isExecuted =
              ref.info.isApproved &&
              ((ref.ongoing.enactment.isAfter &&
                ref.info.asApproved[0]
                  .add(ref.ongoing.enactment.asAfter)
                  .toNumber() < currentBlock) ||
                (ref.ongoing.enactment.isAt &&
                  ref.ongoing.enactment.asAt.toNumber() < currentBlock));

            const networkIcon =
              polkadotPrefix == "moonbeam"
                ? "🌒"
                : polkadotPrefix == "moonriver"
                ? "⛵"
                : "?";
            const statusIcon = ref.info.isApproved
              ? isExecuted
                ? "⚡"
                : "✅"
              : ref.info.isCancelled
              ? "⛔"
              : ref.info.isKilled
              ? "💀"
              : ref.info.isRejected
              ? "🟥"
              : ref.info.isTimedOut
              ? "🕑"
              : ref.info.isOngoing
              ? ref.info.asOngoing.deciding.isSome &&
                ref.info.asOngoing.deciding.unwrap().confirming.isSome
                ? "❗"
                : "📰"
              : "?";

            const callData =
              ref?.image?.proposal &&
              (await callInterpreter(api, ref.image.proposal));
            const imageText =
              callData && callData.text
                ? callData.text.startsWith("whitelist.dispatch") &&
                  callData.subCalls.length > 0
                  ? `${
                      ref.info.isOngoing
                        ? (
                            await api.query.whitelist.whitelistedCall(
                              callData.subCalls[0].call.hash.toHex()
                            )
                          ).isSome
                          ? `🔓`
                          : `🔐`
                        : ""
                    }[${callData.subCalls[0].text}]`
                  : callData.text
                : "";
            const subText =
              !callData ||
              callData.depth == 0 ||
              callData.text.startsWith("whitelist.dispatch")
                ? null
                : callData.subCalls
                    .map((c) => renderCallMarkdown(c, "  \n", 1))
                    .join("  \n");

            const yes = ref.ongoing.tally.ayes.div(
              BN_TEN.pow(new BN(api.registry.chainDecimals[0]))
            );

            const no = ref.ongoing.tally.nays.div(
              BN_TEN.pow(new BN(api.registry.chainDecimals[0]))
            );

            const supportPercent =
              ref.ongoing.tally.support
                .muln(10_000)
                .div(totalIssuance)
                .toNumber() / 100;

            const nextStepTime = ref.info.isApproved
              ? ref.ongoing.enactment.isAfter
                ? `${await toBlockMoment(
                    api,
                    ref.info.asApproved[0].add(ref.ongoing.enactment.asAfter),
                    "⚡"
                  )}`
                : `${await toBlockMoment(
                    api,
                    ref.ongoing.enactment.asAt,
                    "⚡"
                  )}`
              : ref.info.isOngoing
              ? ref.info.asOngoing.deciding.isSome
                ? ref.info.asOngoing.deciding.unwrap().confirming.isSome
                  ? `${await toBlockMoment(
                      api,
                      ref.info.asOngoing.deciding.unwrap().confirming.unwrap(),
                      "✅"
                    )}`
                  : ref.decidingEnd
                  ? `${await toBlockMoment(api, ref.decidingEnd, "❗")}`
                  : `${await toBlockMoment(
                      api,
                      ref.track.preparePeriod
                        .add(ref.info.asOngoing.submitted)
                        .add(ref.track.decisionPeriod),
                      "⏱"
                    )}`
                : `${await toBlockMoment(
                    api,
                    ref.track.preparePeriod
                      .add(ref.info.asOngoing.submitted)
                      .add(ref.track.decisionPeriod),
                    "⏱"
                  )}`
              : "";

            const additionalConfirmingTime =
              ref.info.isOngoing &&
              (ref.info.asOngoing.deciding.isNone ||
                ref.info.asOngoing.deciding.unwrap().confirming.isNone)
                ? `+${moment
                    .duration(
                      moment(
                        (
                          await getBlockDate(
                            api,
                            ref.track.confirmPeriod
                              .addn(currentBlock)
                              .toNumber()
                          )
                        ).date
                      ).diff(moment())
                    )
                    .humanize()}->✅`
                : null;

            const additionalEnactmentTime =
              ref.info.isOngoing &&
              (ref.info.asOngoing.deciding.isNone ||
                ref.info.asOngoing.deciding.unwrap().confirming.isNone)
                ? `+${moment
                    .duration(
                      moment(
                        (await getBlockDate(api, enactmentDelayFromNow)).date
                      ).diff(moment())
                    )
                    .humanize()}->⚡`
                : null;

            return {
              sortKey:
                (ref.info.isApproved
                  ? ref.info.asApproved[0]
                  : ref.info.isCancelled
                  ? ref.info.asCancelled[0]
                  : ref.info.isKilled
                  ? ref.info.asKilled[0]
                  : ref.info.isRejected
                  ? ref.info.asRejected[0]
                  : ref.info.isTimedOut
                  ? ref.info.asTimedOut[0]
                  : ref.info.isOngoing
                  ? ref.info.asOngoing.deciding.isSome &&
                    ref.info.asOngoing.deciding.unwrap().confirming.isSome
                    ? ref.info.asOngoing.deciding.unwrap().confirming.unwrap()
                    : ref.decidingEnd
                  : ref.decidingEnd
                )?.toBigInt?.() || 0n,
              message:
                `${networkIcon}` +
                `[${ref.track.name
                  .toString()
                  .slice(0, 15)
                  .padStart(15, " ")}]` +
                `${ref.id.toString().padStart(3, " ")} -` +
                `${imageText.slice(0, 40).padStart(40, " ")}` +
                `${statusIcon}` +
                ` |👍${humanizeNumber(yes.toNumber()).padStart(
                  10,
                  " "
                )} vs ${humanizeNumber(no.toNumber()).padStart(10, " ")}👎` +
                `|${supportPercent.toFixed(2).padStart(5, " ")}%` +
                (nextStepTime
                  ? `|${nextStepTime[isExecuted ? "padStart" : "padStart"](
                      15,
                      " "
                    )}`
                  : "") +
                (additionalConfirmingTime
                  ? `|${additionalConfirmingTime.padStart(15, " ")}`
                  : "") +
                (additionalEnactmentTime
                  ? `|${additionalEnactmentTime.padStart(15, " ")}`
                  : "") +
                `|` +
                (subText ? `\n                 ${subText}` : ""),
            };
          })
        );

        this.emit(
          "progress",
          { time: Date.now() },
          Math.round(
            (progress += 100 / (this.parameters.networkApis.length * 2))
          )
        );
        return { version: "1", name, messages };
      })
    );

    this.emit(
      "result",
      { time: Date.now() },
      [...networkDemocracy, ...networkReferendums]
        .filter(({ messages }) => messages.length > 0)
        .map(
          ({ name, messages }) =>
            `#### ${name}  \n${messages
              .sort((a, b) => Number(a.sortKey) - Number(b.sortKey))
              .map(({ message }) => message)
              .join("  \n")}`
        )
        .join("\n\n")
    );
  }

  async cancel() {
    this.cancelled = true;
  }
}
