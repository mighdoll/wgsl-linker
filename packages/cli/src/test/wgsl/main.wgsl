// #import foo from ./util

fn main() {
  foo();
}

#if EXTRA
fn extra() { }
#endif

#if typecheck
fn foo() {}
#endif