# wgsl-linker

**wgsl-linker** enriches the WGSL shader language to support 
linking code modules via import and export statements.
Linking can be done entirely at runtime.

For those in the JavaScript/Typescript world, think 'bundling'.
The **wgsl-linker** is a module bundler for WGSL.

As with other programming languages,
module linking becomes useful when your WGSL code grows
large enough to be split into separate reusable files (aka modules).
Linking integrates the code modules together while solving for:

* renaming - Two functions with the same name?
The linker will rename one of them, and all the calls to the renamed function.
* deduplication - Two modules import the same function? You get only one copy.
* recursion - Importing a function that references another import? You get all references, recursively.
* dead code - Importing a function from a big module?
You get only that function and its references, not the whole file.

In addition to linking, the **wgsl-linker** adds some other features useful
as your WGSL code scales in size and complexity:

* struct inheritance
* `import` parameters for generic programming
* conditional compilation `#if #else #endif`
* templating for runtime code rewriting
* transparent imports from code generation

A simple demo of the **wgsl-linker** is available [on StackBlitz](https://stackblitz.com/~/github.com/mighdoll/wgsl-linker-rand-example).

## WGSL extensions

* **import** &ensp; **export** &emsp; _Combine functions and structs from other modules._

  * import / export functionality is roughly similar to TypeScript / JavaScript.
    Linking is wgsl syntax aware, including import deduplication and token renaming.
    Internally, wgsl-linker works like a javascript module bundler.

* **import foo(arg, ...)** &ensp; **export(arg, ...)** &emsp; _Imports and exports can take parameters_
  * Unlike JavaScript, imports and exports can take parameters.
    * Typically you'll use import parameters like you would use type parameters
      in TypesScript, to write generic functions that can be reused.

    ```wgsl
    import workgroupReduce(Histogram) as reduceHistogram
    ```

  * You can import a function twice with different parameters.

* **#if** &ensp; **#else** &ensp; **#endif** &emsp; _Compile differently depending on runtime variables_

  * Preprocessing works on full lines, similarly to languages like C.
    **#if** clauses may nest.
    **#if** parameters are simple Javascript values provided by the caller at runtime.
    `0`, `null`, and `undefined` are considered `false`.
    Negation is also allowed with a `!`, e.g. `#if !mySetting`.

* **template** &emsp; _Each module can specify its own string templating engine_

  * Tweak the wgsl based on runtime variables you provide.

* **extends** &emsp; _Combine members from multiple structs_

  * Use it wher you might use `extends` in TypesScript, to mix in member elements from
    a struct in another module. The syntax is like `import`.

* **module** &emsp; _Organize exports semantically_

* **wgsl syntax compatible** &emsp; _The **wgsl-linker** will parse directives inside line comments_

  * Continue to use static wgsl tools like code formatters and `wgsl-analyzer`
    by simply prefixing the directives with `//`.  
    e.g. use `// export` instead of `export`.

### Other Features

* **Runtime Linking** &emsp; _Link at runtime rather than at build time if you like_

  * Choose different wgsl modules depending on runtime reported detected gpu features, or based on user application settings.
  * Keep integration into web development easy - no need to add any new steps into your build process or IDE.
  * To enable runtime linking, **wgsl-linker** is small, Currently about 10kb (compressed).

* **Code generation**
  * Typically it's best to write static wgsl,
    perhaps with some simple templates.
    But the escape hatch of arbitrary code generation is available for complex situations.
  * You can register a function to generate wgsl text for an exported module function.
  * Imports work identically on code generated exports.

### WGSL Example

Export functions and structs:

```wgsl
module demo.utils

export fn rand() -> u32 { /* .. */ }

export struct RandomXY {
  x: i32,
  y: i32
}

```

Import functions and structs

```wgsl
import rand from demo.utils

fn myFn() {
  let x:u32 = rand();
}

extends RandomXY from wgsl-utils
struct MyStruct {
  color: vec4<u32>
}

```

### Main API

`new ModuleRegistry({wgsl, templates?, generators?})` - register wgsl source, wgsl code generators, and wgsl template engines.

`registry.link("main", runtimeParams?)` - preprocess wgsl, apply templates,
merge imported code.
The result is a raw wgsl string suitable for WebGPU's `createShaderModule`.

### API Example

```wgsl
// load wgsl text (using vite syntax. see Build Support below.)
const wgsl = import.meta.glob("./shaders/*.wgsl", {
  query: "?raw",
  eager: true,
  import: "default",
});

// register the linkable exports
const registry = new ModuleRegistry({ wgsl });

// link my main shader wgsl with imported modules,
// using the provided variables for import parameters or string templates
const code = registry.link("main", { WorkgroupSize: 128 });

// pass the linked wgsl to WebGPU as normal
device.createShaderModule({ code });
```

### WGSL Syntax extensions

#### Export

`export` export the following fn or struct.

`export (param1, param2, ...)` optional parameters to customize exported text.
The linker will globally string replace params in the exported text
with params provided by the importer.

`export(param1) importing name(param1)`

#### Import

`import name` import code, selected by export name (e.g. function or struct name).
The export can be in any registered module.

For larger code bases, specify the module name with imports as well.
This provides better encapsulation:

`import name from moduleName` import code, selected by module and export name.

`import name from ./moduleFile` import code, selected by
module filename and exported name within the module.
Module filenames also match with suffixes removed.

`import name <from moduleName> as rename` rewrite the imported fn or struct to a new name.

`import name (arg1, arg2) <from moduleName> <as rename>` pass parameters to
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

* One example template engine is published in `wgsl-linker/templates`
* `#template simple` - replaces strings with values provided by a runtime dictionary.

#### Module

`#module package.name` declare a name for the module.
Module names are arbitrary. It's a good practice to use
your npm package name as a prefix to avoid potential
future conflicts with other packages modules.

### Build Support

You can simply put your wgsl modules in strings in your TypeScript/JavaScript source
if you'd like.

For runtime linking, the easiest way to load all the `.wgsl` files at once is to use your
bundler's glob import mechanism:

* Vite: [import.meta.glob](https://vitejs.dev/guide/features#glob-import)
* Rollup: [rollup-plugin-glob-import](https://github.com/gjbkz/rollup-plugin-glob-import)
* Parcel: [glob-specifiers](https://parceljs.org/features/dependency-resolution/#glob-specifiers)

You can also load `.wgsl` files individually with your favorite bundler:

* Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
* Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
* Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

#### Command Line Linking

The linker is also packaged as a command line tool if you'd like to link at build time
rather than at runtime.

By linking at build time,
you can save about 10kb of bundled code size
and shave a few milliseconds of shader linking time.

The main disadvantage of linking at build time is that you can't detect the runtime
environment to customize the shader code for a particular GPU.
(You'll also need to complicate your build process slightly to support a wgsl linker stage before javascript bundling.)

If you want to get fancy for speed but aren't squeezed for size,
you could build time link and bundle for several common GPU configurations.
Then select the appropiate version or fallback at runtime.

See [wgsl-link](https://www.npmjs.com/package/wgsl-link).

### Known Limitations

* Static typechecking is possible with some effort
  (typically by manualy adding placeholder declarations
  inside an `#if typecheck` clause).
  But extending `wgsl-analyzer` to typecheck imports would be much better.

* wgsl global variables, aliases, and wgsl directives from outside
  the main module are not linked in to the final result.

* non-ascii wgsl identifiers aren't yet supported.

### Future Work

* It'd be fun to publish wgsl modules as esm modules aka glslify.

* The linker already shows _linking errors_ 
  from wgsl-linker in the original unlinked source locations.
  _Linking errors_ point to the original the source
  even if the source has been rewritten by preprocessing.

  But WebGPU _shader compilation errors_ don't point
  to the original source
  (compilation errors refer to the linked wgsl text instead).
  We could use the linker's internal source maps
  to fix that.
