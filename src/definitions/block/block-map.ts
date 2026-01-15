import {
  Block,
  SectionType,
  IBlockDefinition,
  ISectionDefinition,
} from "../interface";
import {
  GlobalBlock,
  AnalogBlock,
  ButtonBlock,
  EncoderBlock,
  LedBlock,
  DisplayBlock,
  TouchscreenBlock,
} from "./index";

export const BlockMap: Dictionary<IBlockDefinition> = {
  [Block.Global]: GlobalBlock,
  [Block.Analog]: AnalogBlock,
  [Block.Button]: ButtonBlock,
  [Block.Encoder]: EncoderBlock,
  [Block.Led]: LedBlock,
  [Block.Display]: DisplayBlock,
  [Block.Touchscreen]: TouchscreenBlock,
};

// Combine routes for each block into a single array

const combineBlockRoutes = (
  accumulator: any[],
  currentBlock: IBlockDefinition,
): any[] => {
  if (currentBlock.routes) {
    accumulator.push(...currentBlock.routes);
  }
  return accumulator;
};

export const getDefaultDataForBlock = (
  block: Block,
  sectionType?: SectionType,
): Record<string, number | null> => {
  return Object.values(BlockMap[block].sections).reduce(
    (formData: Record<string, number | null>, section: ISectionDefinition) => {
      if (!sectionType || section.type === sectionType) {
        formData[section.key] = null;
      }
      return formData;
    },
    {},
  );
};

export const BlockRoutes = Object.values(BlockMap).reduce(
  combineBlockRoutes,
  [],
);
