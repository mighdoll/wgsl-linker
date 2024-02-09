## wgsl-linker

**wgsl-linker** enriches wgsl with with a module system for linking/bundling, 
struct inheritance, conditional compilation, templating, and code generation.

### Wgsl Extensions 

- **#import** / **#export** - combine functions and structs from other modules.
  * Linking is wgsl syntax aware, including import deduplication and token renaming. 
  It's used like import / export in TypeScript.
  (And internally, wgsl-linker works like a javascript module bundler.)

- **#export(arg, ..)** - parameterize exports with import specific arguments.
  - Imports and exports can take parameters, to enable code reuse.
    * Typically you'll use import parameters like you would use type parameters 
      in TypesScript, to write generic functions that can be reused in many ways.
    ```
    #import workgroupReduce(Elem) as reduceElem
    #import workgroupReduce(Histogram) as reduceHistogram
    ```

- **#if** / **#else** / **#endif** - compile differently depending on runtime variables.

- **#template**  - plug in a string template engine to tweak the wgsl with runtime variables.

- **#importMerge** - combine members from multiple structs.
  * Use it like you might use `extends` in TypesScript, to mix in member elements from
  a struct in another module.

- **#module** - organize exports semantically.

- **wgsl-linker** will also parse directives that are in line comments. 
So you can continue to use static wgsl tools like code formatters and wgsl-analyzer 
by simply prefixing the directives with `// `.

### Other Features
- The library is small, currently about 8kb (compressed). 
Call `linkWgsl()` at runtime to handle dynamic situations, 
and without needing to add any new steps into your build process.

- Code generation 
  * Typically write static wgsl (perhaps with some simple templates), but
  know that the escape hatch of arbitrary code generation is available for complex situations. 
  * You can register a function to generate wgsl text for an exported module function. 
  * Imports work identically on code generated exports.
  

#### Example

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

// #importMerge RandomXY from wgsl-utils
struct MyStruct {
  color: vec4<u32>
}

```


### Main API

`new ModuleRegistry(wgslFragment1, wgslFragment2)` register wgsl modules for imports to use.

`linkWgsl(src, registry, params?)` process wgsl, integrate imports, using runtime parameters environment.

`registry.registerTemplate()` register a string templating for transforming text.

`registry.registerGenerator(name, fn, params?, moduleName?)` register a code generation function to produce an export.

### Example

```
// load wgsl text
import randWgsl from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
import myShaderWgsl from "./myShader.wgsl?raw";

// register the linkable exports
const registry = new ModuleRegistry(randWgsl); 
registry.registerTemplate(simpleTemplate);

// link my shader code with imported modules, 
// using the provided variables for conditional compilation and string templates
const code = linkWgsl(myShaderWgsl, registry, {WorkgroupSize: 128, DEBUG: true}

// pass the linked wgsl to WebGPU as normal
device.createShaderModule({ code });           
```

### Syntax

#### Export

`#export` export the following fn or struct.

`#export (param1, param2, ...)` optional parameters to customize exported text.
The linker will globally string replace params in the exported text
with params provided by the importer.

`#export(param1) importing name(param1)` 

#### Import

`#import name`  import code, selected by export name.

`#import name from moduleName`  import code, selected by module and export name.

`#import name <from moduleName> as rename` and rewrite the imported fn or struct to a new name.

`#import name (arg1, arg2) <from moduleName> <as rename>` pass parameters to
an export with parameters.

#### Template
`#template name` specify a template function for additional processing
of exported text in this module.
The template function is passed any import parameters,
and runs prior to #export parameter string replacement.

- Two example template engines are published in `wgsl-linker/templates`: 
  * `"simple"` - replaces strings with values provided by a runtime dictionary. 
  * `"replacer"` - provides a **// #replace** directive for specifiying string 
  replacement in comments. 
  This allows for templating while keeping syntax compability with wgsl. 
  Replacements are of the form `srcText=runtimeVariable`.

    ```
    for (let i = 0; i < 4; i++) { // #replace '4'=workgroupSize
    ```

#### Module
`#module package.name` declare name of module.

### Build Support

You can put your wgsl into strings in your typescript source if you'd like.
Or you can store your shader and shader module templates as `.wgsl` files and load
them as strings with whatever build tool you use, e.g.:

- Vite: [import ?raw](https://vitejs.dev/guide/assets#importing-asset-as-string)
- Webpack: [Source Assets](https://webpack.js.org/guides/asset-modules/).
- Rollup: [rollup-plugin-string](https://github.com/TrySound/rollup-plugin-string)

### Current Limitations and Future Work

- Export parameter replacement and fn/struct renaming use global text substitution
  in the module, so best not to alias tokens that are used as export parameters 
  or function names. In the future, replacing text searching with a lightweight 
  wgsl parser should help. (This is underway)

- To enable static typechecking,
  currently the importer needs to manually add placeholder declarations.
  Extending `wgsl-analyzer` to typecheck imports would be better, these declarations
  should be provided by the exporter.

- Wrapping the linker into a command line tool to run the linker at build time 
rather than at runtime would be useful in some situations when the
environment is static.

- It'd be fun to publish wgsl modules as esm modules aka glslify.
