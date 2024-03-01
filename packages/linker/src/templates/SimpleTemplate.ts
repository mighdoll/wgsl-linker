import { Template } from "../ModuleRegistry.js";
import { replaceTokens3 } from "../Util.js";

// TODO fixme
export const simpleTemplate: Template = {
  name: "simple",
  apply: (src, extParams) => {
    return src;
    // return replaceTokens3(src, extParams);
  }
};
