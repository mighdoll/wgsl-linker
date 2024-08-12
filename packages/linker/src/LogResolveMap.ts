import { ResolveMap } from "./ImportResolutionMap.js";
import { TextExport } from "./ParseModule.js";

export function logResolveMap(resolveMap: ResolveMap): void {
  const pathEntries = pathsToStrings(resolveMap);
  const exportEntries = exportsToStrings(resolveMap);
  console.log("\tpathsMap:\n\t\t" + pathEntries.join("\n\t\t"));
  console.log("\texportMap:\n\t\t" + exportEntries.join("\n\t\t"));
}

export function pathsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.pathsMap].map(([imp, exp]) => {
    return `${imp.join("/")} -> ${exp.join("/")}`;
  });
}

export function exportsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.exportMap].map(([imp, exp]) => {
    const expPath = `${exp.modExp.module.name}/${(exp.modExp.exp as TextExport).ref.name}`;
    const expImpArgs = exp.expImpArgs.length ? ` (${exp.expImpArgs.join(", ")})` : "";
    return `${imp} -> ${expPath}${expImpArgs}`;
  });
}