import { _withBaseLogger } from "mini-parse";
import { logCatch } from "mini-parse/test-util";
import { expect, test } from "vitest";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { replaceTemplate } from "../templates/Replacer.js";
import { simpleTemplate } from "../templates/SimpleTemplate.js";
import { linkWgslTest } from "./TestUtil.js";
import { dlog } from "berry-pretty";

test("simple #import", () => {
  const myModule = `
    // #export
    fn foo() { /* fooImpl */ }
  `;

  const src = `
    // #import foo
    fn bar() {
      foo();
    }
  `;
  const linked = linkWgslTest(src, myModule);
  expect(linked).contains("fn bar()");
  expect(linked).includes("fooImpl");
  expect(linked).not.includes("#import");
  expect(linked).not.includes("#export");
});

test("copy root elements linked output", () => {
  const rootStruct = "struct Uniforms {\n  a: u32\n}";
  const rootVar = `@group(0) @binding(0) var<uniform> u: Uniforms;`;
  const rootFn = `fn main() { }`;
  const src = `
    // #module main
    ${rootStruct}
    ${rootVar}
    ${rootFn}
  `;
  const linked = linkWgslTest(src);
  expect(linked).includes(rootStruct);
  expect(linked).includes(rootVar);
  expect(linked).includes(rootFn);
});

test("#import with parameter", () => {
  const myModule = `
    // #export (Elem)
    fn foo(a: Elem) { /* fooImpl */ }
  `;

  const src = `
    struct MyElem {}

    // #import foo(MyElem)
    fn bar() {
      foo();
    }
  `;
  const linked = linkWgslTest(src, myModule);
  expect(linked).includes("a: MyElem");
});

test("transitive import", () => {
  const binOpModule = `
    // #export(Elem) 
    fn binaryOp(a: Elem, b: Elem) -> Elem {
        return a + b; // binOpImpl
    }`;
  const reduceModule = `
    #export(work, E) importing binaryOp(E)
    fn reduceWorkgroup(index:u32) {
        let combined = binaryOp(work[index], work[index + 1u]);
    }
    `;
  const src = `
    // #import reduceWorkgroup(myWork, u32)
  
    fn main() {
      reduceWorkgroup(localId); // call the imported function
    }`;
  const linked = linkWgslTest(src, binOpModule, reduceModule);
  expect(linked).includes("myWork[index]");
  expect(linked).not.includes("work[");
  expect(linked).includes("binOpImpl");
});

test("#import foo as bar", () => {
  const myModule = `
    #export
    fn foo() { /* fooImpl */ }
   `;

  const src = `
    #import foo as bar

    fn main() {
      bar();
    }
   `;
  const linked = linkWgslTest(src, myModule);
  expect(linked).contains("fn bar()");
});

test("#import twice doesn't get two copies", () => {
  const module1 = `
    #export
    fn foo() { /* fooImpl */ }
  `;
  const module2 = `
    #export
    fn bar() { foo(); }

    #import foo
  `;
  const src = `
    #import bar
    #import foo

    fn main() {
      foo();
      bar();
    }
  `;
  const linked = linkWgslTest(src, module1, module2);
  const matches = linked.matchAll(/fooImpl/g);
  expect([...matches].length).toBe(1);
});

test("import transitive conflicts with main", () => {
  const module1 = `
    #export
    fn grand() {
      /* grandImpl */
    }
  `;
  const module2 = `
    #import grand
    
    #export
    fn mid() { grand(); }
  `;
  const src = `
    #import mid

    fn main() {
      mid();
    }

    fn grand() {
      /* main impl */
    }
  `;
  const linked = linkWgslTest(src, module1, module2);
  expect(linked).includes("mid() { grand0(); }");
});

test("#import twice with different names", () => {
  const module1 = `
    #export(A)
    fn foo(a:A) { /* module1 */ }
  `;
  const src = `
    #import foo(b) as bar
    #import foo(z) as zap

    fn main() {
      bar();
      zap();
    }
  `;
  const linked = linkWgslTest(src, module1);
  const matches = linked.matchAll(/module1/g);
  expect([...matches].length).toBe(2);
});

test("#import foo from zap (multiple modules)", () => {
  const module1 = `
    // #module module1
    // #export
    fn foo() { /* module1 */ }
  `;
  const module2 = `
    // #module module2
    // #export
    fn foo() { /* module2 */ }
  `;

  const src = `
    #import foo as baz from module2

    fn main() {
      baz();
    }
  `;

  const linked = linkWgslTest(src, module1, module2);
  expect(linked).contains("/* module2 */");
});

test("multiple exports from the same module", () => {
  const module1 = `
    #export
    fn foo() { }
    #export
    fn bar() { }
  `;
  const src = `
    #import foo
    #import bar
    fn main() {
      foo();
      bar();
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked).toMatchSnapshot();
});

test("#import and resolve conflicting support function", () => {
  const module1 = `
    #export
    fn foo() {
      support();
    }

    fn support() { }
  `;
  const src = `
    #import foo as bar

    fn support() { 
      bar();
    }
  `;
  const linked = linkWgslTest(src, module1);
  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const barMatch = linked.matchAll(/\bbar\b/g);
  expect([...barMatch].length).toBe(2);
});

test("#import support fn that references another import", () => {
  const src = `
    #import foo 

    fn support() { 
      foo();
    }
  `;
  const module1 = `
    #import bar

    #export
    fn foo() {
      support();
      bar();
    }

    fn support() { }
  `;
  const module2 = `
    #export
    fn bar() {
      support();
    }

    fn support() { }
  `;

  const linked = linkWgslTest(src, module1, module2);

  const origMatch = linked.matchAll(/\bsupport\b/g);
  expect([...origMatch].length).toBe(1);
  const module1Match = linked.matchAll(/\bsupport0\b/g);
  expect([...module1Match].length).toBe(2);
  const module2Match = linked.matchAll(/\bsupport1\b/g);
  expect([...module2Match].length).toBe(2);
});

test("#import support fn from two exports", () => {
  const src = `
    #import foo
    #import bar 
    fn main() {
      foo();
      bar();
    }
  `;
  const module1 = `
    #export
    fn foo() {
      support();
    }

    #export
    fn bar() {
      support();
    }

    fn support() { }
  `;

  const linked = linkWgslTest(src, module1);
  const supportMatch = linked.matchAll(/\bsupport\b/g);
  expect([...supportMatch].length).toBe(3);
});

test("#export importing", () => {
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
  const linked = linkWgslTest(src, module1, module2);
  expect(linked).contains("fn bar(x:B)");
});

test("#import a struct", () => {
  const src = `
    #import AStruct 

    fn main() {
      let a = AStruct(1u); 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      x: u32,
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked).contains("struct AStruct {");
});

test("#extends a struct in the root src", () => {
  const src = `
    #extends AStruct 
    struct MyStruct {
      x: u32,
    }

    fn main() {
      let a: MyStruct; 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      y: u32,
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked.match(/struct MyStruct {/g)).toHaveLength(1);
  expect(linked).toContain(`struct MyStruct {\n  x: u32,\n  y: u32\n}`);
});

test("#extends an empty struct", () => {
  const src = `
    #extends AStruct 
    struct MyStruct {
    }

    fn main() {
      let a: MyStruct; 
    }
  `;
  const module1 = `
    #export
    struct AStruct {
      y: u32,
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked.match(/struct MyStruct {/g)).toHaveLength(1);
  expect(linked).toContain(`struct MyStruct {\n  y: u32\n}`);
});

test("#extends a struct in a module", () => {
  const src = `
    #import AStruct
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    struct AStruct {
      x: i32,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;

  const linked = linkWgslTest(src, module1, module2);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(`struct AStruct {\n  x: i32,\n  z: u32\n}`);
});

test("two #extends on the same struct", () => {
  const src = `
    #import AStruct
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    #extends CStruct
    struct AStruct {
      x: i32,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;
  const module3 = `
    #export 
    struct CStruct {
      d: f32 
    }
  `;

  const linked = linkWgslTest(src, module1, module2, module3);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: i32,\n  z: u32,\n  d: f32\n}`
  );
});

test("#extends struct with imp/exp param", () => {
  const src = `
    #import AStruct(i32)
    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export(X)
    #extends BStruct
    struct AStruct {
      x: X,
    }
  `;
  const module2 = `
    #export 
    struct BStruct {
      z: u32
    }
  `;

  const linked = linkWgslTest(src, module1, module2);
  expect(linked.match(/struct AStruct/g)).toHaveLength(1);
  expect(linked).toContain(`struct AStruct {\n  x: i32,\n  z: u32\n}`);
});

test("transitive #extends ", () => {
  const src = `
    #import AStruct 

    fn main() {
      let a: AStruct; 
    }
  `;
  const module1 = `
    #export
    #extends BStruct
    struct AStruct {
      x: u32,
    }

    #export
    #extends CStruct
    struct BStruct {
      y: u32
    }

    #export
    struct CStruct {
      z: u32
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked.match(/struct AStruct {/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: u32,\n  y: u32,\n  z: u32\n}`
  );
});

test("transitive #extends from root", () => {
  const src = `
    #extends BStruct
    struct AStruct {
      x: u32,
    }
  `;
  const module1 = `
    #export
    #extends CStruct
    struct BStruct {
      y: u32
    }
  `;
  const module2 = `
    #export
    struct CStruct {
      z: u32
    }
  `;
  const linked = linkWgslTest(src, module1, module2);
  expect(linked.match(/struct AStruct {/g)).toHaveLength(1);
  expect(linked).toContain(
    `struct AStruct {\n  x: u32,\n  y: u32,\n  z: u32\n}`
  );
});

test("import fn with support struct constructor", () => {
  const src = `
    #import elemOne 

    fn main() {
      let ze = elemOne();
    }
  `;
  const module1 = `
    struct Elem {
      sum: u32
    }

    #export 
    fn elemOne() -> Elem {
      return Elem(1u);
    }
  `;
  const linked = linkWgslTest(src, module1);
  expect(linked).contains("struct Elem {");
  expect(linked).contains("fn elemOne() ");
});

test("import a transitive struct", () => {
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
  const linked = linkWgslTest(src, module1, module2);
  expect(linked).contains("struct SrcStruct {");
  expect(linked).contains("struct AStruct {");
  expect(linked).contains("struct BStruct {");
});

test("'import as' a struct", () => {
  const src = `
    #import AStruct as AA

    fn foo (a: AA) { }
  `;

  const module1 = `
    #export 
    struct AStruct { x: u32 }
  `;

  const linked = linkWgslTest(src, module1);
  expect(linked).contains("struct AA {");
});

test("import a struct with imp/exp params", () => {
  const src = `
    #import AStruct(i32)

    fn foo () { b = AStruct(1); }
  `;

  const module1 = `
    #if typecheck
    alias elemType = u32;
    #endif

    #export (elemType)
    struct AStruct { x: elemType }
  `;

  const linked = linkWgslTest(src, module1);
  expect(linked).contains("x: i32");
});

test("import a struct with name conflicting support struct", () => {
  const src = `
    #import AStruct

    struct Base {
      b: i32
    }

    fn foo() -> AStruct {let a:AStruct; return a;}
  `;
  const module1 = `
    struct Base {
      x: u32
    }

    #export
    struct AStruct {
      x: Base
    }
  `;

  const linked = linkWgslTest(src, module1);
  expect(linked).contains("struct Base {");
  expect(linked).contains("struct Base0 {");
  expect(linked).contains("x: Base0"); // TBD
});

test("import with simple template", () => {
  const myModule = `
    #template simple
    #export
    fn foo() {
      for (var step = 0; step < WORKGROUP_SIZE; step++) { }
    }
  `;
  const src = `
    #module main
    #import foo
    fn main() { foo(); }
  `;
  const registry = new ModuleRegistry({
    rawWgsl: [myModule, src],
    templates: [simpleTemplate],
  });
  const linked = registry.link("main", { WORKGROUP_SIZE: "128" });
  expect(linked).includes("step < 128");
});

test("#import using replace template and ext param", () => {
  const src = `
    // #module main
    // #import foo

    fn main() { foo(); }
  `;

  const module1 = `
    // #template replace

    // #export
    fn foo () {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;

  const registry = new ModuleRegistry({
    rawWgsl: [module1, src],
    templates: [replaceTemplate],
  });
  const linked = registry.link("main", { threads: 128 });
  expect(linked).contains("step < 128");
});

test("#template in src", () => {
  const src = `
    #module main
    #template replace
    fn main() {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;
  const registry = new ModuleRegistry({
    rawWgsl: [src],
    templates: [replaceTemplate],
  });
  const linked = registry.link("main", { threads: 128 });
  expect(linked).includes("step < 128");
});

test("#import using replace template and imp/exp param", () => {
  const src = `
    // #module main
    // #import foo(128)

    fn main() { foo(); }
  `;

  const module1 = `
    // #template replace

    // #export(threads)
    fn foo () {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;

  const registry = new ModuleRegistry({
    rawWgsl: [src, module1],
    templates: [replaceTemplate],
  });
  const linked = registry.link("main");
  expect(linked).contains("step < 128");
});

test("#import using external param", () => {
  const src = `
    // #module main
    // #import foo(ext.workgroupSize)

    fn main() { foo(); }
  `;

  const module1 = `
    // #template replace

    // #export(threads)
    fn foo () {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;

  const registry = new ModuleRegistry({
    rawWgsl: [src, module1],
    templates: [replaceTemplate],
  });
  const linked = registry.link("main", { workgroupSize: 128 });
  expect(linked).contains("step < 128");
});

test("#import twice with different params", () => {
  const src = `
    #import foo(A)
    #import foo(B) as bar

    fn main() {
      bar();
      foo();
    }
  `;
  const module0 = `
    #export(X)
    fn foo() { /* X */ }
  `;

  const linked = linkWgslTest(src, module0);
  expect(linked).includes("fn bar() { /* B */ }");
  expect(linked).includes("fn foo() { /* A */ }");
});

test("external param applied to template", () => {
  const module1 = `
    #template replace

    #export(threads)
    fn foo() {
      for (var step = 0; step < 4; step++) { //#replace 4=threads
      }
    }
  `;
  const src = `
    #module main
    #import foo(workgroupThreads)

    fn main() {
      foo();
    }
  `;
  const registry = new ModuleRegistry({
    rawWgsl: [module1, src],
    templates: [replaceTemplate],
  });
  const linked = registry.link("main", { workgroupThreads: 128 });
  expect(linked).includes("step < 128");
});

test("warn on missing template", () => {
  const src = `
    #module test.missing.template
    // oops
    #template missing

    fn main() { }
  `;
  const { log, logged } = logCatch();
  _withBaseLogger(log, () => linkWgslTest(src));
  expect(logged()).toMatchInlineSnapshot(`
    "template 'missing' not found in ModuleRegistry  module: test.missing.template 
        #template missing   Ln 4
        ^"
  `);
});

test("extend struct with rename", () => {
  // TODO
  const src = `
    // #extends HasColor(fill) 
    struct Sprite {
        pos: vec2f,
    }
  `;
  const module1 = `
      // #export(color)
      struct HasColor {
         color: vec4f, 
      }
    `;

  const linked = linkWgslTest(src, module1);
  expect(linked).includes("fill: vec4f");
});
