// #module main2
// #import bar from ./util2

fn main() { bar(); }

#if typecheck
fn bar() {}
#endif