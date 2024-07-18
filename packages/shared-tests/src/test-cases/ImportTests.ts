import { WgslTestSrc } from "./TestSchema.js";

export const importTests: WgslTestSrc[] = [
  {
    name: `import { foo } from "./bar";`,
    src: {
      "./main.wgsl": `
          import { foo } from "./bar";
          fn main() {
            foo();
          }
       `,
      "./bar.wgsl": `
          export fn foo() { }
       `,
    },
  },
  {
    name: `import { foo, boo } from "./bar";`,
    src: {
      "./main.wgsl": `
          import { foo, boo } from "./bar";
          fn main() {
            foo();
            boo();
          }
       `,
      "./bar.wgsl": `
          export fn foo() { }
          export fn boo() { }
       `,
    },
  },
  {
    name: `import foo, boo from ./bar`,
    notes: "optional braces, quote marks, and semicolon",
    src: {
      "./main.wgsl": `
          import foo, boo from ./bar
          fn main() {
            foo();
            boo();
          }
       `,
      "./bar.wgsl": `
          export fn foo() { }
          export fn boo() { }
       `,
    },
  },
  {
    name: `import bar::foo`,
    notes: "simple rust style import",
    src: {
      "./main.wgsl": `
         import bar::foo;
         module main
         fn main() { foo(); }
       `,
      "./bar.wgsl": `
          module bar
          export fn foo() { }
       `,
    },
  },
  {
    name: `call foo::bar()`,
    notes: "module path at call site",
    src: {
      "./main.wgsl": `
         import foo::bar;
         module main
         fn main() { foo::bar(); }
       `,
      "./bar.wgsl": `
          module foo
          export fn bar() { }
       `,
    },
  },
  {
    name: `import foo::bar; var x:bar;`,
    notes: "struct reference",
    src: {
      "./main.wgsl": `
         import foo::bar;
         module main
         var x: bar;
         fn main() { }
       `,
      "./bar.wgsl": `
          module foo
          export struct bar { f: f32 }
       `,
    },
  },
  {
    name: `var x: foo::bar;`,
    notes: "struct reference with module path",
    src: {
      "./main.wgsl": `
         import foo::bar;
         module main
         var x: foo::bar;
         fn main() { }
       `,
      "./bar.wgsl": `
          module foo
          export struct bar { f: f32 }
       `,
    },
  },
];

export default importTests;
