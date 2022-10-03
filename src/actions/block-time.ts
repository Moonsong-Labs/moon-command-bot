import { ApiPromise } from "@polkadot/api";
import { SignedBlock } from "@polkadot/types/interfaces";
import moment, { Moment } from "moment";

export async function getBlockDate(
  api: ApiPromise,
  blockNumber: number,
  currentBlock: SignedBlock
) {
  const diffCount = blockNumber - currentBlock.block.header.number.toNumber();
  if (diffCount < 0) {
    console.error("Block must be in the future");
    return;
  }

  const currentTimestamp = api.registry.createType(
    "Compact<u64>",
    currentBlock.block.extrinsics.find(
      (e) => e.method.section == "timestamp" && e.method.method == "set"
    ).data
  );

  const previousBlock = await api.rpc.chain.getBlock(
    (
      await api.rpc.chain.getBlockHash(
        currentBlock.block.header.number.toNumber() - diffCount
      )
    ).toString()
  );

  const previousTimestamp = api.registry.createType(
    "Compact<u64>",
    previousBlock.block.extrinsics.find(
      (e) => e.method.section == "timestamp" && e.method.method == "set"
    ).data
  );

  const expectedDate = new Date(
    currentTimestamp.toNumber() +
      (currentTimestamp.toNumber() - previousTimestamp.toNumber())
  );

  return moment.utc(expectedDate);
}

export async function computeBlockForMoment(
  api: ApiPromise,
  targetDate: Moment
) {
  const currentBlock = await api.rpc.chain.getBlock();
  const currentBlockNumber = currentBlock.block.header.number.toNumber();

  let evalDate = moment.utc();
  let targetBlock = currentBlockNumber;

  do {
    targetBlock += Math.floor(targetDate.diff(evalDate) / 1000 / 12);
    evalDate = await getBlockDate(api, targetBlock, currentBlock);

    await new Promise((resolve) => setTimeout(resolve, 1));
  } while (Math.abs(evalDate.diff(targetDate)) > 1000 * 60 * 10);
  return {
    block: targetBlock,
    date: evalDate,
    blockCount: targetBlock - currentBlockNumber,
  };
}
