import { ImportElem } from "./AbstractElems.js";
import {
  ModuleRegistry2,
  TextModuleExport2
} from "./ModuleRegistry2.js";
import { TextModule2, parseModule2 } from "./ParseModule2.js";

/** parse source text for #import directives, return wgsl with all imports injected */
export function linkWgsl2(
  src: string,
  registry: ModuleRegistry2,
  extParams: Record<string, any> = {}
): string {
  const srcModule = parseModule2(src);
  const imports = resolveImports({
    srcModule,
    registry,
    extParams,
    imported: new Set(),
  });
  return src + "\n\n" + imports;
}

interface ResolveArgs {
  /** load all imports specified in this module */
  srcModule: TextModule2;
  /** find imports in this registry */
  registry: ModuleRegistry2;
  /** imports already resolved (export name changed possibly changed by 'as', with import params) */
  imported: Set<string>;
  /** params provided by the linkWsgl caller */
  extParams: Record<string, any>;
}

/** load all the imports from a module returning the resolved text */
function resolveImports(args: ResolveArgs): string {
  const { srcModule, registry } = args;
  const imports = srcModule.imports.flatMap((imp) => {
    const importing = registry.getModuleExport(imp.name, imp.from);
    if (!importing) {
      console.error(`#import "${imp.name}" not found position ${imp.start}`); // LATER add source line number
      return [];
    } else if (importing.kind === "text") {
      const imported = loadImportText(imp, importing);
      const importedResolved = resolveImports({
        ...args,
        srcModule: importing.module,
      });
      return [imported, importedResolved];
    } else {
      throw new Error("NYI");
    }
  });
  return imports.join("\n\n");
}

/** extract the import text from a module, replace export params with corresponding import arguments */
function loadImportText(
  importElem: ImportElem,
  importing: TextModuleExport2
): string {
  const exp = importing.export;
  const { src: importModuleSrc } = exp;
  const { start, end } = exp.ref;
  const importSrc = importModuleSrc.slice(start, end);

  /* replace export args with import arg values */
  const importArgs = importElem.args ?? [];
  const entries = exp.args.map((p, i) => [p, importArgs[i]]);
  const importParams = Object.fromEntries(entries);
  return replaceTokens2(importSrc, importParams);
}

const tokenRegex = /\b(\w+)\b/gi;
export function replaceTokens2(
  text: string,
  replace: Record<string, string>
): string {
  return text.replaceAll(tokenRegex, (s) => (s in replace ? replace[s] : s));
}
