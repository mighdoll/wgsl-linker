import { SrcMap } from "mini-parse";
import { Template } from "../ModuleRegistry.js";
import { sliceReplace, sliceWords } from "../Slicer.js";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    const slices = sliceWords(src, extParams);
    const text = sliceReplace(src, slices);
    return { text, srcMap: new SrcMap(text) };
  },
};
