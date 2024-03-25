import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "fs";
import { ModuleRegistry } from "wgsl-linker";
import glob from "fast-glob";
import {relative} from "path";

/* 
  link <srcFile> [moduleFiles...] 
    --details show details about parsed files
    --separate link each file separately (for parser validation)
    --glob <globSearc> search for module files using glob syntax
    --baseDir rm common prefix from file paths
*/

const argv = yargs(hideBin(process.argv))
  .command("$0 [files...]", "wgsl files to parse")
  .option("g", {
    alias: "glob",
    describe: "glob search string to find wgsl sources",
    requiresArg: true,
    type: "string",
  })
  .option("baseDir", {
    requiresArg: true,
    type: "string",
    describe: "rm common prefix from file paths",
  })
  .help()
  .parseSync();

run();

async function run(): Promise<void> {
  const files = argv.files as string[];
  files.slice(0,1).forEach((f) => {
    const wgsl = fs.readFileSync(f, { encoding: "utf8" });
    console.log("foo")
    const registry = new ModuleRegistry({ wgsl: { [f]: wgsl } });
    console.log(registry.modules.map(m => m.fileName))
    // const linked = registry.link(f)
  });
}
