import { test, expect } from "vitest";
import { processConditionals } from "../Conditionals.js";
import { parseWgslD } from "../ParseWgslD.js";
import { ModuleRegistry } from "../ModuleRegistry.js";
import { replaceTemplate } from "../templates/Replacer.js";
import { parseModule } from "../ParseModule.js";
import { dlog } from "berry-pretty";

test("example", () => {
  const src = `
// #module stoneberry.ReduceWorkgroup

// #if typecheck
var <workgroup> work:array<Elem, 18>; 
struct Elem { sum: u32, }
fn binaryOp(a: Elem, b: Elem) -> Elem {}
// #endif

// #template replacer

// #export(work, Elem, threads) importing BinaryOp(Elem)
fn reduceWorkgroup(localId: u32) {
    let workDex = localId << 1u;
    for (var step = 1u; step < 4u; step <<= 1u) { // #replace 4=threads
        workgroupBarrier();
        if localId % step == 0u {
            work[workDex] = binaryOp(work[workDex], work[workDex + step]);
        }
    }
}
`;
//   const r = new ModuleRegistry();
//   r.registerTemplate(replaceTemplate);
    // const m = new ModuleRegistry(src);
  // const m = parseModule(src, { workgroupThreads: 256, blockArea: 4 });
  // dlog({
  //   fns: m.fns.map((f) => f.name),
  //   structs: m.structs.map((s) => s.name),
  //   vars: m.vars.map((v) => v.name),
  // });
});
