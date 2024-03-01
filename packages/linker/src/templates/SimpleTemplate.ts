import { Template } from "../ModuleRegistry.js";
import { replaceWords } from "wgsl-linker";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    return replaceWords(src, extParams);
  }
};
