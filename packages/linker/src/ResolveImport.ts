import { ResolveMap } from "./ImportResolutionMap.js";
import { ModuleExport } from "./ModuleRegistry.js";
import { overlapTail } from "./Util.js";

/** resolve an import to an export using the resolveMap
 * @param callPath the reference to the import, e.g. "foo::bar" from
 *    import pkg::foo
 *    fn () { foo::bar(); }
 *
 * Cases: all of these find export path pkg/foo
 *   foo() -> import pkg::foo,
 *   bar() -> import pkg::foo as bar
 *   pkg::foo()  -> import pkg
 *   pkg::foo()  -> import pkg::foo
 *   npkg::foo() -> import pkg as npkg
 *   npkg.foo()  -> import pkg as npkg
 */
export function resolveImport(
  callPath: string,
  resolveMap: ResolveMap
): ModuleExport | undefined {
  const importSegments = callPath.includes("::")
    ? callPath.split("::")
    : callPath.split(".");

  const expPath = impToExportPath(importSegments, resolveMap);
  if (expPath) {
    const exp = resolveMap.exportMap.get(expPath);
    if (exp) {
      return exp;
    }
  }

  return undefined;
}

function impToExportPath(
  impSegments: string[],
  resolveMap: ResolveMap
): string | undefined {
  const { pathsMap } = resolveMap;
  for (const [imp, exp] of pathsMap.entries()) {
    const impTail = overlapTail(imp, impSegments);
    if (impTail) {
      console.assert(imp.length === exp.length);
      const combined = [...exp, ...impTail];
      return combined.join("/");
    }
  }

  return undefined;
}
