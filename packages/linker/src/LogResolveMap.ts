import { dlog } from "berry-pretty";
import { ResolveMap } from "./ImportResolutionMap.js";
import { TextExport } from "./ParseModule.js";

export function logResolveMap(resolveMap: ResolveMap): void {
  const expMap = exportsToStrings(resolveMap);
  const pathMap = pathsToStrings(resolveMap);
  dlog({ expMap, pathMap });
}

export function pathsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.pathsMap.entries()].map(([imp, exp]) => {
    return `${imp.join("/")} -> ${exp.join("/")}`;
  });
}

export function exportsToStrings(resolveMap: ResolveMap): string[] {
  return [...resolveMap.exportMap.entries()].map(([imp, exp]) => {
    return `${imp} -> ${exp.module.name}/${(exp.exp as TextExport).ref.name}`;
  });
}
