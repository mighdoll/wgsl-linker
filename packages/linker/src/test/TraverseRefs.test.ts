import { _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { FoundRef, TextRef, refName, traverseRefs } from "../TraverseRefs.js";
import { printRef } from "../RefDebug.js";
import { refLog } from "../LinkerLogging.js";
import { dlog } from "berry-pretty";

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
  const exp = refs[1] as TextRef;
  expect(exp.kind).eq("txt");
  expect(exp.elem.kind).eq("struct");
  expect(exp.elem.name).eq("AStruct");
});

test("traverse simple rust style import", () => {
  const main = `
    import bar::foo;
    module main
    fn main() { foo(); }
  `;
  const bar = `
    module bar
    export fn foo() { }
  `;
  const refs = traverseTest(main, bar);
  const exp = refs[1] as TextRef;
  expect(exp.kind).eq("txt");
  expect(exp.elem.kind).eq("fn");
  expect(exp.elem.name).eq("foo");
});

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
  const first = refs[1] as TextRef;
  const second = refs[2] as TextRef;
  expect(first.kind).toBe("txt");
  expect(first.expInfo?.expImpArgs).deep.eq([["A", "u32"]]);
  expect(second.kind).toBe("txt");
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

  const importingRef = refs[2] as TextRef;
  expect(importingRef.expInfo?.expImpArgs).deep.eq([["X", "B"]]);
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
    const er = r as TextRef;
    return er ? [er.expInfo?.expImpArgs] : [];
  });
  expect(expImpArgs[2]).deep.eq([["X", "B"]]);
  expect(expImpArgs[3]).deep.eq([["Y", "B"]]);
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
    const er = r as TextRef;
    return er ? [{ name: er.elem.name, args: er.expInfo?.expImpArgs }] : [];
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
    "importing arg doesn't match export  module: moduleFile0 moduleFile0
        #export(C, D) importing bar(E)   Ln 2
                                ^
    reference not found: X  module: moduleFile1 moduleFile1
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
    "mismatched import and export params  module: main main
        #import foo(A, B)   Ln 2
        ^
     module: moduleFile0 moduleFile0
        #export(C)    Ln 2
        ^"
  `);
});

test("traverse var to rust style struct ref", () => {
  const main = `
     import foo::bar;
     module main
     var x: bar;
     fn main() { }
   `;
  const foo = `
      module foo
      export struct bar { f: f32 }
   `;

  const refs = traverseTest(main, foo);
  const structRef = refs.find(ref => ref.kind === "txt" && ref.elem.kind === "struct");
  expect(structRef).toBeDefined();
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
  expect(refs[1].kind).toBe("txt");
  expect(refName(refs[1])).toBe("AStruct");
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
  const exp = refs[1] as TextRef;
  expect(exp.kind).eq("txt");
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
  expect(refName(refs[1])).toBe("AStruct");
  expect(refName(refs[2])).toBe("BStruct");
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
  expect(refName(refs[2])).toBe("AStruct");
  expect(refName(refs[3])).toBe("BStruct");
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
  expect(refName(refs[1])).toBe("AStruct");
});

test("traverse #extends", () => {
  const src = `
    #extends A
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
  expect(refName(refs[1])).toBe("A");
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
  expect(refNames).deep.eq(["B", "b", "A", "B"]);
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
  expect(refNames).deep.eq(["b", "A"]);
});

test("traverse skips built in fn and type", () => {
  const src = `
    fn foo() {
      bar();
      min(3,4);
      vec3(u);
    }
    fn bar() {}
  `;

  const { refs, log } = traverseWithLog(src);
  const refNames = refs.map(refName);
  // refs.map(r => refLog(r));
  expect(refNames).deep.eq(["foo", "bar", "bar"]); // TODO is this right?
  expect(log).eq("");
});

test("type inside fn with same name as fn", () => {
  // this will fail wgsl compilation, but as long as it doesn't hang the linker, we're ok
  const src = `
    fn foo() {
      let a:foo;
    }
    fn bar() {}
  `;
  const { refs, log } = traverseWithLog(src);
  expect(log).is.empty;
  expect(refs).length(3);
});

test("call inside fn with same name as fn", () => {
  const src = `
    fn foo() {
      foo();
    }
  `;
  const { refs, log } = traverseWithLog(src);
  expect(refs).length(1);
  expect(log).is.empty;
});

test("call cross reference", () => {
  const src = `
    fn foo() {
      bar();
    }

    fn bar() {
      foo();
    }
  `;
  const { refs, log } = traverseWithLog(src);
  const refNames = refs.map((r) => (r as TextRef).elem.name);
  expect(refNames).contains("foo");
  expect(refNames).contains("bar");
  expect(refNames).length(4); // TODO is this right?
  expect(log).is.empty;
});

test("struct self reference", () => {
  const src = `
    struct A {
      a: A,
      b: B,
    }
    struct B {
      f: f32,
    }
  `;
  const { log } = traverseWithLog(src);
  expect(log).is.empty;
});

test("struct cross reference", () => {
  const src = `
    struct A {
      b: B,
    }
    struct B {
      a: A,
    }
  `;
  const { refs, log } = traverseWithLog(src);
  expect(log).is.empty;
  const refNames = refs.map((r) => (r as any).elem.name);
  expect(refNames).includes("A");
  expect(refNames).includes("B");
  expect(refNames).length(4);
});

test("parse texture_storage_2d with texture format in type position", () => {
  const src = `var t: texture_storage_2d<rgba8unorm, write>;`;
  const { log } = traverseWithLog(src);
  expect(log).is.empty;
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

/** run traverseRefs on the provided wgsl source strings
 * the first module is treated as the root
 */
function traverseTest(src: string, ...modules: string[]): FoundRef[] {
  const moduleFiles = Object.fromEntries(
    modules.map((m, i) => [`moduleFile${i}`, m])
  );
  const wgsl = { "./main": src, ...moduleFiles };
  const registry = new ModuleRegistry({ wgsl });
  const refs: FoundRef[] = [];
  const parsed = registry.parsed();
  const mainModule = parsed.findTextModule("./main")!;
  traverseRefs(mainModule, parsed, (ref) => {
    refs.push(ref);
    return true;
  });
  return refs;
}
