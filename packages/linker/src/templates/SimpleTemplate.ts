import { replaceWords } from "wgsl-linker";
import { Template } from "../ModuleRegistry.js";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    return replaceWords(src, extParams);
  }
};
