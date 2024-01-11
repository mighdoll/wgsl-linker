import { expect, test } from "vitest";
import { linkWgsl2 } from "../Linker2.js";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { parseModule2 } from "../ParseModule2.js";
import { FoundRef, recursiveRefs } from "../TraverseRefs.js";
import { dlogOpt } from "berry-pretty";

test("traverse nested import with params and support fn", () => {
  
  const src = `
    // #import foo(u32)
    fn bar() {
      foo(8u);
    }
  `;

  const module1 = `
    // #import zap
  
    // #export (A)
    fn foo(a: A) { 
      support(a);
      zap();
    }

    fn support() {}
  `;

  const module2 = `
    // #export 
    fn zap() {}
  `;

  const registry = new ModuleRegistry2(module1, module2);
  const srcModule = parseModule2(src);

  const refs: FoundRef[] = [];
  recursiveRefs(srcModule.fns, srcModule, registry, (ref) => {
    refs.push(ref);
    return true;
  });
  console.log("refs", refs);
});