import { WgslTestSrc } from "./TestSchema.js";

export const linkerTests: WgslTestSrc[] = [
  {
    name: "#import foo",
    src: {
      "./main.wgsl": `
          #import foo
          fn main() {
            foo();
          }
       `,
      "./bar.wgsl": `
          #export 
          fn foo() { }
       `,
    },
  },
];

export default linkerTests;
