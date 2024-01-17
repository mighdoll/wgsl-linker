import { expect, test } from "vitest";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { parseModule2 } from "../ParseModule2.js";
import {
  ExportRef,
  FoundRef,
  LocalRef,
  _withErrLogger,
  traverseRefs,
} from "../TraverseRefs.js";
import { dlog } from "berry-pretty";
import { logCatch } from "./LogCatcher.js";

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
  traverseRefs(srcModule, registry, (ref) => {
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

test("traverse importing", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(D)
    fn foo(c:C, d:D) { bar(d); } `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;

  const registry = new ModuleRegistry2(module1, module2);
  const srcModule = parseModule2(src);
  const refs: FoundRef[] = [];
  traverseRefs(srcModule, registry, (ref) => {
    refs.push(ref);
    return true;
  });
  const importingRef = refs[1] as ExportRef;
  expect(importingRef.expImpArgs).deep.eq([["X", "B"]]);
});

test("traverse double importing", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(D)
    fn foo(c:C, d:D) { bar(d); } `;
  const module2 = `
    #export(X) importing zap(X)
    fn bar(x:X) { zap(x); } `;
  const module3 = `
    #export(Y) 
    fn zap(y:Y) { } `;

  const registry = new ModuleRegistry2(module1, module2, module3);
  const srcModule = parseModule2(src);
  const refs: FoundRef[] = [];
  traverseRefs(srcModule, registry, (ref) => {
    refs.push(ref);
    return true;
  });
  const expImpArgs = refs.flatMap((r) => {
    const er = r as ExportRef;
    return er ? [er.expImpArgs] : [];
  });
  expect(expImpArgs[1]).deep.eq([["X", "B"]]);
  expect(expImpArgs[2]).deep.eq([["Y", "B"]]);
});

test("traverse importing from a support fn", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing support(D)
    fn foo(c:C, d:D) { support(d); } 
    
    #export(D) importing bar(D)
    fn support(d:D) { bar(d); }
    `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;

  const registry = new ModuleRegistry2(module1, module2);
  const srcModule = parseModule2(src);
  const refs: FoundRef[] = [];
  traverseRefs(srcModule, registry, (ref) => {
    refs.push(ref);
    return true;
  });

  const expImpArgs = refs.flatMap((r) => {
    const er = r as ExportRef;
    return er ? [{ name: er.fn.name, args: er.expImpArgs }] : [];
  });
  expect(expImpArgs).toMatchSnapshot();
});

test("traverse importing from a local call fails", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(D)
    fn foo(c:C, d:D) { support(d); } 
    
    fn support(d:D) { bar(d); }
    `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;

  const registry = new ModuleRegistry2(module1, module2);
  const srcModule = parseModule2(src);
  const refs: FoundRef[] = [];
  const { log, logged } = logCatch();
  _withErrLogger(log, () => {
    traverseRefs(srcModule, registry, (ref) => {
      refs.push(ref);
      return true;
    });
  });

  expect(logged().length).not.eq(0);
});
