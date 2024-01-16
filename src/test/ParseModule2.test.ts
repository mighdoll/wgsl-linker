import { expect, test } from "vitest";
import { parseModule2 } from "../ParseModule2.js";

test("simple fn export", () => {
  const src = `
    // #export
    fn one() -> i32 {
      return 1;
    }
  `;
  const module = parseModule2(src, "my.module");
  console.log(module.exports);
  expect(module.exports.length).toBe(1);
  expect(module).toMatchSnapshot();
});

test("simple fn import", () => {
  const src = `
    // #import foo
    fn bar() { foo(); }
  `;
  const module = parseModule2(src, "my.module");
  console.log(module);
  expect(module.imports.length).toBe(1);
  expect(module.imports[0].name).toBe("foo");
  expect(module).toMatchSnapshot();
});

// test("read simple struct export", () => {
//   const exportPrefix = `// #export`;
//   const src = `
//     struct Elem {
//       sum: f32;
//     }
//   `;
//   const module = parseModule(exportPrefix + "\n" + src);
//   expect(module.exports.length).toBe(1);
//   const firstExport = module.exports[0];
//   expect(firstExport.name).toBe("Elem");
//   expect(firstExport.params).deep.equals([]);
//   expect(firstExport.src).toBe(src);
// });

// test("read #module", () => {
//   const myModule = `
//     // #module myModule
//     // #export
//     fn foo() {}
//   `;
//   const textModule = parseModule(myModule);
//   expect(textModule.name).toBe("myModule");
// });

// test("parse #export log", () => {
//   const myModule = `
//     #export log(myVar)

//     _log(myVar)
//   `;
//   const textModule = parseModule(myModule);
//   expect(textModule.exports[0].name).toBe("log");
// });

// test("parse #export log with #endInsert", () => {
//   const myModule = `
//     #export log(myVar)
//     _log(myVar);
//     #endInsert

//     fn _log(myVar: i32) {}
//   `;
//   const textModule = parseModule(myModule);
//   const firstExport = textModule.exports[0];
//   expect(firstExport.name).toBe("log");
//   expect(firstExport.src.trim()).toBe("_log(myVar);");
//   expect(firstExport.rootSrc!.trim()).toBe("fn _log(myVar: i32) {}");
// });
