# node-simple-asset-pipeline

NSAP: A module to make it easier to write node modules that include client-side code.



## Interface

This module has two interfaces: one for module authors, and one for users.


### For module authors

`registerAssets(assetsFolder, moduleName, options)`

Call `registerAssets` in your initialization code to register your module or modules and their assets. Use `__dirname` to refer to the directory of the currently-running file. E.g.:

    registerAssets(__dirname + '/assets/clientJs', 'myModuleName');

NSAP assumes that javascript assets are stored in a folder called `js` within `assetsFolder`, and CSS assets similarly in a folder called `css` within `assetsFolder`.

`registerAssetBundle(assetsFolder, bundleName, assets, options)`

Call `registerAssetBundle` in your initialization code to register a bundle with the given `moduleName`. All files listed in `assets` (rooted by `js` and `css` subfolders of `assetsFolder`) will be included when users call `includeBundle`.

### For module users

Use `expressPipeline(options)` to create a `connect`-style handler that adds helper funtions to `res.locals`. Specifically, this grants access to `jsLinks()`, `cssLinks()`, `includeJs(path)`, `includeCss(path)`, and `includeBundle(name)`.

`jsLinks()` and `cssLinks()` each return a string consisting of `<script type="text/javascript" src="XXX"></script>` repeated for each `XXX` JS file included using `includeJs(path)`. (`<link ...>` for CSS.) The path should look like `moduleName/asset.js`; the included file is served from `/js/moduleName/asset.js`, or specify a prefix by passing `{ prefix: '/your/prefix/here' }` to `expressPipeline` -- your files will then be served at `/your/prefix/here/js/moduleName/asset.js`.

`expressPipeline` also sets up a static file server for serving those files; you can turn off this behavior by passing `{ serveStatic: false }` to `expressPipeline`.