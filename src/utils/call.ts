import { ApiPromise } from "@polkadot/api";
import { GenericCall } from "@polkadot/types/generic";

const NESTED_CALLS = [
  {
    section: "utility",
    method: "dispatchAs",
    multi: false,
    argumentPosition: 1,
  },
  { section: "sudo", method: "sudo", multi: false, argumentPosition: 0 },
  { section: "sudo", method: "sudoAs", multi: false, argumentPosition: 1 },
  { section: "batch", method: "batch", multi: true, argumentPosition: 0 },
];

export interface CallInterpretation {
  text: string;
  depth: number;
  subCalls: CallInterpretation[];
}

export function renderCallMarkdown(
  callData: CallInterpretation,
  separator = "\n",
  depth = 0
): string {
  return [
    `${"".padStart(depth * 6, " ")}⤷ \`${callData.text}\``,
    ...callData.subCalls.map((call) =>
      renderCallMarkdown(call, separator, depth + 1)
    ),
  ].join("\n");
}

export async function callInterpreter(
  api: ApiPromise,
  call: GenericCall
): Promise<CallInterpretation> {
  const nested = NESTED_CALLS.find(
    ({ section, method }) =>
      section == call.section.toString() && method == call.method.toString()
  );
  const text = `${call.section}.${call.method}`;
  if (nested) {
    if (nested.multi) {
      const subCalls = await api.registry.createType(
        "Vec<Call>",
        call.args[nested.argumentPosition].toU8a(true)
      );
      const subCallsData = await Promise.all(
        subCalls.map((subCall) => callInterpreter(api, subCall))
      );
      return {
        text,
        depth:
          subCallsData.length > 0
            ? Math.max(...subCallsData.map((sub) => sub.depth)) + 1
            : 1,
        subCalls: subCallsData,
      };
    }
    const subCall = await api.registry.createType(
      "Call",
      call.args[nested.argumentPosition].toU8a(true)
    );

    return { text, depth: 1, subCalls: [await callInterpreter(api, subCall)] };
  }

  return { text: `${call.section}.${call.method}`, depth: 0, subCalls: [] };
}
