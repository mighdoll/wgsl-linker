## wgsl-linker

wgsl-linker adds features to wgsl to support engineering larger wgsl code bases, 
starting with combining modules (linking/bundling), but also struct inheritance, preproocessing, etc.

Features include the following

- #import / #export support in wgsl 
  * linking is wgsl syntax aware, including import deduplication and token renaming. 
  (Think typescript import/export + bundling more than #include in c.)
  * Integrated support for writing typescript functions that generating wgsl at runtime, 
  transparently to the importer. 
  (mostly write wgsl, but the escape hatch is there for complex cases)
  
- syntax compatible with static wgsl tools like code formatters and wgsl-analyzer
  * all the directives may be placed in comments. e.g. ```// #import```

- **#if** / **#else** / **#endif** to compile differently depending on use case, or runtime environment.

- pick your own string template engine. 
  * Use {{mustache}} or regex, or whatever you'd like.
  * (a **// #replace** template engine is available if you want to keep 
  compability with current wgsl tools like wgsl-analyzer.)

- parameterized imports and exports, for reuse.
  * typically you'll use 'em like type parameters to export generic functions.
  
- **#importMerge** to combine structs 
  * aka traits/inheritance. Like 'extends' in typescript.

- only 10kb compressed, so it's OK to link at runtime with no build step required.

#### Example

Export functions and structs:

```
#export
fn rand() -> u32 { /* .. */ }

#export 
struct CoolStruct {
  coolMember: i32;
}

```

Importing a wgsl functions, structs and random

```
#import rand

fn myFn() {
  let x:u32 = rand();
}


```


Linking at runtime. 
```
import randWgsl from "./randModule.wgsl?raw";  // ?raw is vite syntax. See Build Support.
import myShaderWgsl from "./myShader.wgsl?raw";
const registry = new ModuleRegistry(randWgsl); // register the linkable exports

const code = linkWgsl(myShaderWgsl, registry); // link my code with imports

device.createShaderModule({ code });           // pass the linked wgsl to WebGPU as normal
```

### Main API

`new ModuleRegistry(wgslFragment1, wgslFragment2)` register wgsl modules for imports to use.

`linkWgsl(src, registry, params?)` merge any imported wgsl fragments into src with optional dynamic parameters.

#### Advanced features
`registry.registerTemplate()` register a templating function for transforming text.

`registry.registerGenerator(name, fn, params?, moduleName?)` register a code generation function
that can be imported.

### Syntax

#### Export

`#export` export the following fn or struct.

`#export (param1, param2, ...)` optional parameters to customize exported text.
The linker will globally string replace params in the exported text
with params provided by the importer.

`#template name` specify a template function for additional processing
of exported text in this module.
The template function is passed any import parameters,
and runs prior to #export parameter string replacement.

`#module package.name` declare name of module.

#### Import

`#import name` import code, selected by export name.

`#import name from moduleName` import code, selected by module and export name.

`#import name <from moduleName> as rename` rewrite the imported fn or struct to a new name.

`#import name (arg1, arg2) <from moduleName> <as rename>` pass parameters to
match export parameters.

### Dynamic Code
An export can be customized by the importing code:
1. **`#export` parameters** export parameters are replaced with the corresponding `#import` parameters in the exported text. Useful e.g. to map types to the importer's environment.

Users can also provide runtime parameters to `linkWgsl` for templates or code generation.
1. **template parameters** exports can specify a template engine to process their text 
via the `#template` directive. 

    The available `replacer` engine processes `#replace` directives to find and replace text on a line with dynamic variables.
1. **code generation functions** `#import`s can be fulfilled by javascript/typescript 
functions that generate wgsl.
Just register a function with the `ModuleRegistry` along with a name so that it can be `#import`ed.

The `#import` syntax is the same for all types of exports, 
so the developer of exports can switch transparently between different generation techniques
without requiring the importer to make any changes.

#### Support for Static WGSL Tools.

`// #<directive>` all directives may be placed inside comments
so wgsl code formatters and other tools won't get confused.

`#if typecheck 
fn foo(){} 
#endif` place static declarations in an `#if <false>` clause. The declarations will be visible to static wgsl typecheckers during development, and safely removed at runtime.

### Build Support

Linking and parsing happens entirely at runtime, no additional build step is required.

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

- A command line tool or build tool plugin to register all relevant module files would 
  be convenient for linking at build time rather than runtime.

- It'd be fun to publish wgsl modules as esm modules aka glslify.
