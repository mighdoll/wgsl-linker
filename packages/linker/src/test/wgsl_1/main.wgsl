// #module main
// #import bar from util

fn main() { bar(); }

#if typecheck
fn bar() {}
#endif