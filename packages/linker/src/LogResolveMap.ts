import { dlog } from "berry-pretty";
import { ResolveMap } from "./ImportResolutionMap.js";
import { TextExport } from "./ParseModule.js";

export function logResolveMap(resolveMap: ResolveMap): void {
  const expMap = exportsToStrings(resolveMap);
  const pathsMap = pathsToStrings(resolveMap);
  dlog({ expMap});
  dlog({ pathsMap });
}

export function pathsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.pathsMap].map(([imp, exp]) => {
    return `${imp.join("/")} -> ${exp.join("/")}`;
  });
}

export function exportsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.exportMap].map(([imp, exp]) => {
    const expPath = `${exp.modExp.module.name}/${(exp.modExp.exp as TextExport).ref.name}`;
    const expImpArgs = exp.expImpArgs ? `(${exp.expImpArgs.join(", ")})` : "";
    return `${imp} -> ${expPath} (${expImpArgs})`;
  });
}
