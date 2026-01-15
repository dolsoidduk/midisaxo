import { Boards } from "./boards";
import { arrayEqual } from "../../util";

export const getBoardDefinition = (value: number[]): IBoardDefinition => {
  // IdentifyBoard should return 4 bytes (target UID). If the device replies with
  // an empty/short payload (or parsing fails), don't attempt to match, since
  // some board definitions may contain empty IDs (legacy entries).
  if (!Array.isArray(value) || value.length !== 4) {
    return null as any;
  }

  const board = Boards.find(
    (b: any) =>
      (Array.isArray(b.id) && b.id.length === 4 && arrayEqual(b.id, value)) ||
      (Array.isArray(b.oldId) &&
        b.oldId.length === 4 &&
        arrayEqual(b.oldId, value)),
  );

  return board;
};

export * from "./boards";
