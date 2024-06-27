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
];

export default importTests;
