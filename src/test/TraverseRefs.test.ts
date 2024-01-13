import { expect, test } from "vitest";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { parseModule2 } from "../ParseModule2.js";
import {
  ExportRef,
  FoundRef,
  LocalRef,
  recursiveRefs,
} from "../TraverseRefs.js";

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
  const first = refs[0] as ExportRef;
  const second = refs[1] as LocalRef;
  expect(first.kind).toBe("exp");
  expect(first.expImpArgs).deep.eq([["A", "u32"]]);
  expect(second.kind).toBe("fn");
  expect(second.fn.name).eq("support");
});