# Shared WGSL Texts for Testing

This package contains wgsl source texts to verify WGSL parsing
and linking.

## WGSL Texts

The source texts are an shared as an array of JSON / TypeScript
objects in the format described in
[TestSchema.ts](./src/test-cases/TestSchema.ts)

JSON version:
[import-tests.json](./src/test-cases/import-tests.json)

TypeScript version:
[ImportTests.ts](./src/test-cases/ImportTests.ts)

## Add Texts in TypeScript

Write tests in TypeScript rather than JSON.
(TypeScript is a little more convenient to author than JSON -
There's no need to quote keys, multiline strings are allowed.)

### Convert TypeScript Tests to JSON

A tool is available to convert the TypeScript version of the

#### Install dependencies and build the tool:

```sh
pnpm install
pnpm build
```

#### Generate JSON

```sh
./bin/tests-to-json
```
