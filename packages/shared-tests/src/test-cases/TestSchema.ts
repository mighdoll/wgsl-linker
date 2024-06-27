export interface WgslTestSrc {
  name: string;                 // human readable description of test
  src: Record<string, string>;  // source wgsl+ texts 
}