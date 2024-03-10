## wgsl-linker

**wgsl-linker** enriches the wgsl shader language to support linking.
Linking can be done entirely at runtime.

The **wgsl-linker** also supports struct inheritance,
conditional compilation, pluggable templating and code generation.

The linker is brand new, and not robust or fully featured. Contributions are welcome.

### WGSL extensions

- **#import** &ensp; **#export** &emsp; _Combine functions and structs from other modules._

  - import / export functionality is roughly similar to TypeScript / JavaScript.
    Linking is wgsl syntax aware, including import deduplication and token renaming.
    Internally, wgsl-linker works like a javascript module bundler.

- **#import foo(arg, ...)** &ensp; **#export(arg, ...)** &emsp; _Imports and exports can take parameters_
  - Unlike JavaScript, imports and exports can take parameters.
    - Typically you'll use import parameters like you would use type parameters
      in TypesScript, to write generic functions that can be reused.
    ```
    #import workgroupReduce(Histogram) as reduceHistogram
    ```
- **#if** &ensp; **#else** &ensp; **#endif**  &emsp; _Compile differently depending on runtime variables_

  - Preprocessing works on full lines, similarly to languages like C.
    **#if** clauses may nest.
    **#if** parameters are simple Javascript values provided by the caller at runtime.
    `0`, `null`, and `undefined` are considered `false`.
    Negation is also allowed with a `!`, e.g. `#if !mySetting`.

- **#template** &emsp; _Each module can specify its own string templating engine_
   - Tweak the wgsl based on runtime variables you provide.

- **#extends** &emsp; _Combine members from multiple structs_

  - Use it wher you might use `extends` in TypesScript, to mix in member elements from
    a struct in another module. The syntax is like `#import`.

- **#module** &emsp; _Organize exports semantically_

- **wgsl syntax compatible** &emsp; _The **wgsl-linker** will parse directives inside line comments_

  - Continue to use static wgsl tools like code formatters and `wgsl-analyzer`
    by simply prefixing the directives with `//`.  
    e.g. use `// #export` instead of `#export`.

### Other Features

- **Runtime Linking** &emsp; _Link at runtime rather than at build time if you like_ 

  - Choose different wgsl modules depending on runtime reported detected gpu features, or based on user application settings.
  - Keep integration into web development easy - no need to add any new steps into your build process or IDE.
  - To enable runtime linking, **wgsl-linker** is small, currently about 10kb (compressed).

- **Code generation**
  - Typically write static wgsl (perhaps with some simple templates), but
    know that the escape hatch of arbitrary code generation is available for complex situations.
  - You can register a function to generate wgsl text for an exported module function.
  - Imports work identically on code generated exports.

### WGSL Example

Export functions and structs:

```
#module wgsl-utils

#export
fn rand() -> u32 { /* .. */ }

#export
struct RandomXY {
  x: i32,
  y: i32
}

```

Import functions and structs

```
// #import rand from wgsl-utils

fn myFn() {
  let x:u32 = rand();
}

// #extends RandomXY from wgsl-utils
struct MyStruct {
  color: vec4<u32>
}

```

### Main API

`new ModuleRegistry(wgslFragment1, wgslFragment2)` - register wgsl modules for imports to use.

`linkWgsl(src, registry, params?)` - process wgsl extensions, merge in imports, producing a
raw wgsl string suitable for WebGPU's `createShaderModule`.

#### Additional APIs

`registry.registerTemplate()` -
register string templating for modules to that use additional text transformation.

`registry.registerGenerator(name, fn, params?, moduleName?)` -
register a code generation function to produce an export.

### API Example

```
// load wgsl text
import randWgsl from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
import myShaderWgsl from "./myShader.wgsl?raw";

// register the linkable exports
const registry = new ModuleRegistry(randWgsl);

// link my shader code with imported modules,
// using the provided variables for conditional compilation and string templates
const code = linkWgsl(myShaderWgsl, registry, {WorkgroupSize: 128, DEBUG: true}

// pass the linked wgsl to WebGPU as normal
device.createShaderModule({ code });
```

### WGSL Syntax extensions

#### Export

`#export` export the following fn or struct.

`#export (param1, param2, ...)` optional parameters to customize exported text.
The linker will globally string replace params in the exported text
with params provided by the importer.

`#export(param1) importing name(param1)`

#### Import

`#import name` import code, selected by export name, from any registered module.

[This short import syntax is convenient for small/moderate size codebases.
But perhaps we should disallow imports w/o module specifiers... It
breaks module encapsulation - 
if a third module later changes to export a function with the same name, 
then the original import will no longer work..]

`#import name from moduleName` import code, selected by module and export name.

`#import name <from moduleName> as rename` and rewrite the imported fn or struct to a new name.

`#import name (arg1, arg2) <from moduleName> <as rename>` pass parameters to
an export with parameters.

#### Extends

`#extends` is roughly equivalent to TypeScript `extends` with an `import`'ed struct.

Use `#extends` to merge fields into your struct from a struct that has been tagged for
`#export` in another module.

`#extends` clauses should be placed immediately before a struct. 

`#extends name` import fields from the named struct, exported from any registere module.

`#extends name from moduleName` import fields, selected by module and export name.

Multiple `#extends` clauses may be attached to the same struct.


#### Template

`#template name` specify a template function for additional processing
of exported text in this module.
The template function is passed any import parameters,
and runs prior to #export parameter string replacement.

- Two example template engines are published in `wgsl-linker/templates`:

- `"simple"` - replaces strings with values provided by a runtime dictionary.
- `"replacer"` - provides a **// #replace** directive for specifiying string
  replacement in comments.
  This allows for templating while keeping syntax compability with wgsl.
  Replacements are of the form `srcText=runtimeVariable`.

  ```
  for (let i = 0; i < 4; i++) { // #replace "4"=workgroupSize
  ```

#### Module

`#module package.name` declare a name for the module.
Module names are arbitrary. It's a good practice to use
your npm package name as a prefix to avoid potential 
future conflicts with other packages modules.

### Build Support

You can simply put your wgsl modules in strings in your TypeScript/JavaScript source
if you'd like.

Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.:

- Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
- Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
- Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

### Known Limitations 

- fn/struct renaming currently uses text find and replace in the module,
  so avoid aliasing global names for now. e.g. don't have a
  `fn foo` and also a variable named `foo` in the same module.
  In the future, replacing text replacement with a lightweight
  wgsl parser should fix this. (This is underway)

- Importing the same function twice with different parameters doesn't work yet.

- Static typechecking is possible with some effort (e.g. put declaration
  statements for typechecking inside a clause that's removed by #if -
  visible for typechecking but removed before compilation). But
  extending `wgsl-analyzer` to typecheck imports would be much better.

- wgsl global variables are not yet linked.

- wgsl alias statements are not yet used in linking.

- non-ascii wgsl identifiers aren't yet supported.

### Future Work

- Wrapping the linker into a command line tool to run the linker at build time
  rather than at runtime would be useful in some situations when the
  environment is static and code size is constrained.

- It'd be fun to publish wgsl modules as esm modules aka glslify.

- An internal mapping shows linker parsing errors in the original
  source locations even if the source has been rewritten by **#if #else #endif**.
  Wgsl compilation compile errors from the browser could also be mapped to
  the original unliked source modules by passing a [Source Map](https://sourcemaps.info/spec.html)
  to WebGPU's `createShaderModule()`.
