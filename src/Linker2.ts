import { ModuleRegistry2 } from "./ModuleRegistry2.js";
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
      return src;
    }

    if (importing.kind === "text") {
      const exp = importing.export;
      const { src: importModuleSrc } = exp;
      const { start, end } = exp.ref;
      const importSrc = importModuleSrc.slice(start, end);
      return [importSrc];
    } else {
      throw new Error("NYI");
    }
  });

  return src.concat(imports.join("\n"));
}
