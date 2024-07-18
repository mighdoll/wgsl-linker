import { dlog } from "berry-pretty";
import { ResolveMap } from "./ImportResolutionMap.js";
import { TextExport } from "./ParseModule.js";

export function logResolveMap(resolveMap: ResolveMap): void {
  const expMap = [...resolveMap.exportMap.entries()].map(([imp, exp]) => {
    return `${imp} -> ${exp.module.name}/${(exp.exp as TextExport).ref.name}`;
  });
  const pathMap = [...resolveMap.pathsMap.entries()].map(([imp, exp]) => {
    return `${imp.join("/")} -> ${exp.join("/")}`;
  });
  dlog({ expMap, pathMap });
}
