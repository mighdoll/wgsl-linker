import { WgslTestSrc } from "./TestSchema.js";

export const importCases: WgslTestSrc[] = [
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
         fn main() { foo(); }
       `,
      "./bar.wgsl": `
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
         fn main() { foo::bar(); }
       `,
      "./foo.wgsl": `
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
         var x: bar;
         fn main() { }
       `,
      "./foo.wgsl": `
          export struct bar { f: f32 }
       `,
    },
  },
  {
    name: `var y: foo::bar;`,
    notes: "struct reference with module path",
    src: {
      "./main.wgsl": `
         import foo::bar;
         var y: foo::bar;
         fn main() { }
       `,
      "./foo.wgsl": `
          export struct bar { f: f32 }
       `,
    },
  },
  {
    name: `import foo::{bar, zah}`,
    src: {
      "./main.wgsl": `
         import foo::{bar, zah};
         fn main() { bar(); zah(); }
       `,
      "./foo.wgsl": `
          export fn bar() { }
          export fn zah() { }
       `,
    },
  },
  {
    name: `import foo::{bar::jan::zah, doo}`,
    src: {
      "./main.wgsl": `
         import foo::{bar::jan::zah, doo}
         fn main() { zah(); doo(); }
       `,
      "./foo.wgsl": `
          export fn doo() { }
       `,
      "./foo/bar/jan.wgsl": `
          export fn zah() { }
       `,
    },
  },
];

export default importCases;
