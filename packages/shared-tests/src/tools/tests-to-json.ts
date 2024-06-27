#!/usr/bin/env node
import fs from "fs";
import { importTests } from "../test-cases/ImportTests.js";

main();

async function main(): Promise<void> {
  const json = JSON.stringify(importTests, null, 2);
  fs.writeFileSync("./src/test-cases/import-tests.json", json);
}
