import { tokens } from "mini-parse";
import { expect, test } from "vitest";
import { argsTokens } from "../MatchWgslD.js";
import { rustImport } from "../RustDirective.js";
import { testAppParse } from "./TestUtil.js";
import { dlogOpt } from "berry-pretty";

const testRustImport = tokens(argsTokens, rustImport);

test("import my::lighting::pbr;", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 25,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SimpleSegment {
              "as": undefined,
              "name": "pbr",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import my::lighting::{ pbr };", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 29,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test(`import my::lighting::{ pbr, jelly };`, (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 36,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "jelly",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import my::lighting::{ pbr, jelly::jam };", (ctx) => {
  const { parsed, appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 41,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "pbr",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "jelly",
                    },
                    SimpleSegment {
                      "as": undefined,
                      "name": "jam",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `);
});

test("import my::lighting::{ pbr as lights }", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 38,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "my",
            },
            SimpleSegment {
              "as": undefined,
              "name": "lighting",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": "lights",
                      "name": "pbr",
                    },
                  ],
                },
              ],
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `)
});

test("import a::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 11,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "a",
            },
            Wildcard {
              "wildcard": "*",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `)
});

test("import a::{b, c}::*", (ctx) => {
  const { appState } = testAppParse(testRustImport, ctx.task.name);
  expect(appState).toMatchInlineSnapshot(`
    [
      {
        "end": 19,
        "imports": ImportTree {
          "segments": [
            SimpleSegment {
              "as": undefined,
              "name": "a",
            },
            SegmentList {
              "list": [
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "b",
                    },
                  ],
                },
                ImportTree {
                  "segments": [
                    SimpleSegment {
                      "as": undefined,
                      "name": "c",
                    },
                  ],
                },
              ],
            },
            Wildcard {
              "wildcard": "*",
            },
          ],
        },
        "kind": "treeImport",
        "start": 0,
      },
    ]
  `)
});