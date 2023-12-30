import { ImportElem } from "./MiniWgslParse.js";
import {
  ModuleExport2,
  ModuleRegistry2,
  TextModuleExport2,
} from "./ModuleRegistry2.js";
import { parseModule2 } from "./ParseModule2.js";

/** parse source text for #import directives, return wgsl with all imports injected */
export function linkWgsl2(
  src: string,
  registry: ModuleRegistry2,
  params: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const imports = srcModule.imports.flatMap((imp) => {
    const importing = registry.getModuleExport(imp.name, imp.from);
    if (!importing) {
      console.error(`#import "${imp.name}" not found position ${imp.start}`); // LATER add source line number
      return [];
    } else if (importing.kind === "text") {
      return [resolveTextModule(imp, importing)];
    } else {
      throw new Error("NYI");
    }
  });

  return src.concat(imports.join("\n"));
}

function resolveTextModule(importElem:ImportElem, importing: TextModuleExport2): string {
  const exp = importing.export;
  const { src: importModuleSrc } = exp;
  const { start, end } = exp.ref;
  const importSrc = importModuleSrc.slice(start, end);

  const importArgs = importElem.args ?? [];
  const entries = exp.args.map((p, i) => [p, importArgs[i]]);
  const importParams = Object.fromEntries(entries);
  const resolved = replaceTokens2(importSrc, importParams);

  return resolved;
}

const tokenRegex = /\b(\w+)\b/gi;
export function replaceTokens2(text: string, replace: Record<string, string>): string {
  return text.replaceAll(tokenRegex, s => (s in replace ? replace[s] : s));
}
