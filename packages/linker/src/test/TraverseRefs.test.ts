import { expect, test } from "vitest";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { parseModule2 } from "../ParseModule2.js";
import { _withBaseLogger } from "../../../mini-parse/src/ParserTracing.js";
import {
  ExportRef,
  FoundRef,
  LocalRef,
  refName,
  traverseRefs
} from "../TraverseRefs.js";
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

  const refs = traverseTest(src, module1, module2);
  const first = refs[0] as ExportRef;
  const second = refs[1] as LocalRef;
  expect(first.kind).toBe("exp");
  expect(first.expImpArgs).deep.eq([["A", "u32"]]);
  expect(second.kind).toBe("local");
  expect(second.elem.name).eq("support");
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

  const refs = traverseTest(src, module1, module2);

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

  const refs = traverseTest(src, module1, module2, module3);

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

  const refs = traverseTest(src, module1, module2);

  const expImpArgs = refs.flatMap((r) => {
    const er = r as ExportRef;
    return er ? [{ name: er.elem.name, args: er.expImpArgs }] : [];
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
    
    fn support(d:D) { bar(d); } //  need to mark this as an export with importing, so we can map params
    `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;

  const { log } = traverseWithLog(src, module1, module2);

  expect(log.length).not.eq(0);
});

test("importing args don't match", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C, D) importing bar(E)
    fn foo(c:C, d:D) { bar(d); } `;
  const module2 = `
    #export(X)
    fn bar(x:X) { } `;

  const { log } = traverseWithLog(src, module1, module2);
  expect(log).toMatchInlineSnapshot(`
    "importing arg doesn't match export
        #export(C, D) importing bar(E)   Ln 2
                                ^
    reference not found
        fn bar(x:X) { }    Ln 3
                 ^"
  `);
});

test("mismatched import export params", () => {
  const src = `
    #import foo(A, B)
    fn main() {
      foo(k, l);
    } `;
  const module1 = `
    #export(C) 
    fn foo(c:C) { } `;

  const { log } = traverseWithLog(src, module1);
  expect(log).toMatchInlineSnapshot(`
    "mismatched import and export params
        #import foo(A, B)   Ln 2
        ^

        #export(C)    Ln 2
        ^"
  `);
});

test("traverse a struct to struct ref", () => {
  const src = `
    #import AStruct 

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1);
  expect(refs[0].kind).toBe("exp");
  expect(refName(refs[0])).toBe("AStruct");
});

test("traverse a fn to struct ref", () => {
  const src = `
    #import AStruct 

    fn main() {
      let a:AStruct; 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1);
  const exp = refs[0] as ExportRef;
  expect(exp.kind).eq("exp");
  expect(exp.elem.kind).eq("struct");
  expect(exp.elem.name).eq("AStruct");
});

test("traverse a global var to struct ref", () => {
  const src = `
    #import Uniforms

    @group(0) @binding(0) var<uniform> u: Uniforms;      
    `;
  const module1 = `
    #export
    struct Uniforms {
      model: mat4x4<f32>,
    }
  `;

  const refs = traverseTest(src, module1);
  const exp = refs[0] as ExportRef;
  expect(exp.kind).eq("exp");
  expect(exp.elem.kind).eq("struct");
  expect(exp.elem.name).eq("Uniforms");
});

test("traverse transitive struct refs", () => {
  const src = `
    #import AStruct 

    struct SrcStruct {
      a: AStruct,
    }
  `;
  const module1 = `
    #import BStruct

    #export
    struct AStruct {
      s: BStruct,
    }
  `;
  const module2 = `
    #export
    struct BStruct {
      x: u32,
    }
  `;

  const refs = traverseTest(src, module1, module2);
  expect(refName(refs[0])).toBe("AStruct");
  expect(refName(refs[1])).toBe("BStruct");
});

test("traverse #export importing struct to struct", () => {
  const src = `
    #import AStruct(MyStruct)

    struct MyStuct {
      x: u32
    }

    struct HomeStruct {
      a:AStruct
    }
  `;
  const module1 = `
    #export(B) importing BStruct(B)
    struct AStruct {
      b: BStruct
    }
  `;

  const module2 = `
    #export(Y) 
    struct BStruct {
      Y: Y
    }
  `;
  const refs = traverseTest(src, module1, module2);
  expect(refName(refs[0])).toBe("AStruct");
  expect(refName(refs[1])).toBe("BStruct");
});

test("traverse ref from struct constructor", () => {
  const src = `
    #import AStruct

    fn main() {
      var x = AStruct(1u);
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      b: u32
    }
  `;

  const refs = traverseTest(src, module1);
  expect(refName(refs[0])).toBe("AStruct");
});

test("traverse #importMerge", () => {
  const src = `
    #importMerge A
    struct B {
      x: u32
    }
  `;
  const module1 = `
    #export
    struct A {
      z: u32
    }
  `;
  const refs = traverseTest(src, module1);
  expect(refName(refs[0])).toBe("A");
});

test("traverse with local support struct", () => {
  const src = `
    #import A

    fn b() { var a: A; var b: B; }

    struct B { x: u32 }
  `;
  const module1 = `
    #export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(refName);
  expect(refNames).deep.eq(["A", "B"]);
});

test("traverse from return type of function", () => {
  const src = `
    #import A

    fn b() -> A { }
  `;
  const module1 = `
    #export
    struct A { y: i32 }
  `;

  const refs = traverseTest(src, module1);
  const refNames = refs.map(refName);
  expect(refNames).deep.eq(["A"]);
});

/** run traverseRefs with no filtering and return the refs and the error log output */
function traverseWithLog(
  src: string,
  ...modules: string[]
): { refs: FoundRef[]; log: string } {
  const { log, logged } = logCatch();
  const refs = _withBaseLogger(log, () => traverseTest(src, ...modules));

  return { refs, log: logged() };
}

function traverseTest(src: string, ...modules: string[]): FoundRef[] {
  const registry = new ModuleRegistry2(...modules);
  const srcModule = parseModule2(src);
  const refs: FoundRef[] = [];
  traverseRefs(srcModule, registry, (ref) => {
    refs.push(ref);
    return true;
  });
  return refs;
}
