import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs";
import { ModuleRegistry, normalize } from "wgsl-linker";
import { createTwoFilesPatch } from "diff";
import { TypeRefElem } from "../../linker/src/AbstractElems.js";

const argv = yargs(hideBin(process.argv))
  .command("$0 [files...]", "wgsl files to parse")
  .option("separate", {
    type: "boolean",
    default: false,
    describe: "link each file separately (for parser testing)",
  })
  .option("baseDir", {
    requiresArg: true,
    type: "string",
    describe: "rm common prefix from file paths",
  })
  .option("details", {
    type: "boolean",
    default: false,
    describe: "show details about parsed files",
  })
  .option("diff", {
    type: "boolean",
    default: false,
    describe: "show comparison with src file",
  })
  .option("emit", {
    type: "boolean",
    default: true,
    describe: "emit linked result",
  })
  .help()
  .parseSync();

run();

async function run(): Promise<void> {
  const files = argv.files as string[];
  argv.separate ? linkSeparately(files) : linkNormally(files);
}

function linkNormally(paths: string[]): void {
  const pathAndTexts = paths.map((f) => {
    const text = fs.readFileSync(f, { encoding: "utf8" });
    const basedPath = normalize(rmBaseDirPrefix(f));
    return [basedPath, text];
  });
  const wgsl = Object.fromEntries(pathAndTexts);
  const registry = new ModuleRegistry({ wgsl });
  const [srcPath, srcText] = pathAndTexts[0];
  doLink(srcPath, registry, srcText);
}

function linkSeparately(paths: string[]): void {
  paths.forEach((f) => {
    const srcText = fs.readFileSync(f, { encoding: "utf8" });
    const basedPath = normalize(rmBaseDirPrefix(f));
    const registry = new ModuleRegistry({ wgsl: { [basedPath]: srcText } });
    doLink(basedPath, registry, srcText);
  });
}

function doLink(
  srcPath: string,
  registry: ModuleRegistry,
  origWgsl: string
): void {
  const linked = registry.link(srcPath);
  argv.emit && console.log(linked);
  argv.diff && printDiff(srcPath, origWgsl, linked);
  argv.details && printDetails(srcPath, registry);
}

function printDiff(modulePath: string, src: string, linked: string): void {
  if (src !== linked) {
    const patch = createTwoFilesPatch(modulePath, "linked", src, linked);
    console.log(patch);
  } else {
    console.log(`${modulePath}: linked version matches original source`);
  }
}

function printDetails(modulePath: string, registry: ModuleRegistry): void {
  console.log(modulePath, ":");
  const m = registry.findModule(modulePath)!;
  m.fns.forEach((f) => {
    console.log(`  fn ${f.name}`);
    const calls = f.calls.map((c) => c.name).join("  ");
    console.log(`    calls: ${calls}`);
    printTypeRefs(f);
  });
  m.vars.forEach((v) => {
    console.log(`  var ${v.name}`);
    printTypeRefs(v);
  });
  m.structs.forEach((s) => {
    console.log(`  struct ${s.name}`);
    const members = (s.members ?? []).map((m) => m.name).join("  ");
    console.log(`    members: ${members}`);
    printTypeRefs(s);
  });
  console.log();
}

function printTypeRefs(hasTypeRefs: { typeRefs: TypeRefElem[] }): void {
  const typeRefs = hasTypeRefs.typeRefs.map((t) => t.name).join("  ");
  console.log(`    typeRefs: ${typeRefs}`);
}

function rmBaseDirPrefix(path: string): string {
  const baseDir = argv.baseDir;
  if (baseDir) {
    const found = path.indexOf(baseDir);
    if (found !== -1) {
      return path.slice(found + baseDir.length);
    }
  }
  return path;
}
