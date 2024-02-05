import { Template } from "./ModuleRegistry2.js";
import { replaceTokens3 } from "./Util.js";

export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    return replaceTokens3(src, extParams);
  },
};
