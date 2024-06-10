export interface WgslExtensionsLinkTest {
  name: string;     // human readable description of test
  src: string[][];  // source wgsl+ texts split by line, first is root text
  linked: string[]; // expected linked result split by line
}

export interface ParsedElement {
  start: number;
  end: number;
}

export interface WgslExtensionsParseTest {
  name: string;                         // description of test
  src: string[];                        // wgsl+ source text, split by line
  fnCalls?: ParsedElement[];            // function calls in the source text, not including builtins like sin()
  fnDeclarations?: ParsedElement[];     // function declarations in the source text
  structReferences?: ParsedElement[];   // references to a struct (in a variable )
  structDeclarations?: ParsedElement[]; // struct declarations
}

