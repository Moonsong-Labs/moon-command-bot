import { CallInterpretation } from "moonbeam-tools";

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
