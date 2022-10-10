import { ApiPromise } from "@polkadot/api";
import { Task } from "../task";
import { moment } from "moment-parseplus";

import Debug from "debug";
import { getBlockDate } from "../../actions/block-time";
import { callInterpreter, renderCallInterpretation } from "../../utils/call";
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
  private namePadding: number;
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
    this.namePadding = Math.max(
      ...this.parameters.networkApis.map(({ name }) => name.length)
    );
  }

  public async execute() {
    //
    let progress = 0;
    const networkReferendums = await Promise.all(
      this.parameters.networkApis.map(async ({ api, name }) => {
        const header = await api.rpc.chain.getHeader();
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash.toString();

        const referendums = await api.derive.democracy.referendums();
        if (referendums.length > 0) {
          this.emit(
            "log",
            "info",
            `${name.toString().padStart(this.namePadding, " ")}: ${
              referendums.length
            } referendums`
          );
        }
        const messages = await Promise.all(
          referendums.map(async (referendum) => {
            const preimageHash = referendum.imageHash;
            const polkadotPrefix = name == "Moonbase Alpha" ? "moonbase" : name;

            const enactBlock = referendum.status.end
              .add(referendum.status.delay)
              .toNumber();
            const endBlock = referendum.status.end.isubn(1).toNumber();
            const preimage = await api.query.democracy.preimages(preimageHash);
            let imageText = ""; // TODO refactor
            let subText = null; // TODO refactor
            if (preimage && preimage.isSome && preimage.unwrap().isAvailable) {
              const callData = await callInterpreter(
                api,
                await api.registry.createType(
                  "Call",
                  preimage.unwrap().asAvailable.data.toU8a(true)
                )
              );
              imageText = callData.text;
              subText =
                callData.depth == 0 ? null : renderCallInterpretation(callData);
            } else {
              imageText = preimageHash.toString();
            }

            return {
              end: endBlock,
              message: `[${referendum.index
                .toString()
                .padStart(
                  4,
                  " "
                )}](https://${polkadotPrefix}.polkassembly.network/referendum/${
                referendum.index
              }) - \`${subText ? preimageHash : imageText}\` (${
                referendum.isPassing ? `passing` : `failing`
              } - ${moment
                .duration(
                  moment((await getBlockDate(api, endBlock)).date).diff(
                    moment()
                  )
                )
                .humanize()})${subText ? `  \n${subText}` : ""}`,
            };
          })
        );
        this.emit(
          "progress",
          Math.round((progress += 100 / this.parameters.networkApis.length))
        );
        return { name, messages };
      })
    );
    this.emit(
      "result",
      networkReferendums
        .filter(({ messages }) => messages.length > 0)
        .map(
          ({ name, messages }) =>
            `**${name}**  \n${messages
              .sort((a, b) => a.end - b.end)
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