import { Template } from "../ModuleRegistry.js";
import { sliceReplace, sliceWords } from "../Slicer.js";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    const slices = sliceWords(src, extParams);
    return sliceReplace(src, slices);
  },
};
