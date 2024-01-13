
import { expect, test } from "vitest";
import { ModuleRegistry2 } from "../ModuleRegistry2.js";
import { linkWgsl3 } from "../Linker3.js";

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
  const registry = new ModuleRegistry2(myModule);
  const linked = linkWgsl3(src, registry);
  console.log(linked);
  expect(linked).includes("fooImpl");
  expect(linked).not.includes("#import");
  expect(linked).not.includes("#export");
});