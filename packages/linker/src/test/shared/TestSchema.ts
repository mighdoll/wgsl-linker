export interface WgslExtensionsLinkTest {
  name: string;   // human readable description of test
  src: string[];  // source wgsl+ texts, first is root text
  linked: string; // expected linked result
}

export interface ParsedElement {
  start: number;
  end: number;
}

export interface WgslExtensionsParseTest {
  name: string;                         // description of test
  src: string;                          // wgsl+ source text
  fnCalls?: ParsedElement[];            // function calls in the source text, not including builtins like sin()
  fnDeclarations?: ParsedElement[];     // function declarations in the source text
  structReferences?: ParsedElement[];   // references to a struct (in a variable )
  structDeclarations?: ParsedElement[]; // struct declarations
}

