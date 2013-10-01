var S = require('string');
var send = require('send');
var url = require('url');
var fs = require('fs');

var staticPaths = {};

function defaultOptions(options) {
  if (options === undefined) {
    options = {};
  }
  if (options.prefix === undefined) {
    options.prefix = '/';
  }
  if (options.serveStatic !== false) {
    options.serveStatic = true;
  }
  return options;
}

exports.serveStatic = function(options) {
  options = defaultOptions(options);

  return function(req, res, next) {
    var path = url.parse(req.url).pathname;
    var handled = ['js', 'css'].some(function(type) {
      var prefix = options.prefix+type
      if (S(path).startsWith(prefix)) {
        var staticPath = path.substr(prefix.length+1);
        var module = staticPath.split('/', 1)[0];
        if (! (module in staticPaths)) {
          module = '_default';
          if (! (module in staticPaths)) {
            return;
          }
        }
        send(req, staticPath.substr(module.length+1))
          .root(staticPaths[module].d+'/'+type)
          .on('error', function(err) {
            res.statusCode = err.status || 500;
            res.send(err.message);
          })
          .pipe(res);
        return true;
      }
    });
    if (! handled) {
      next();
    }
  }
}

exports.expressPipeline = function(options) { 
  options = defaultOptions(options);
  var staticServer = exports.serveStatic(options);
  return function(req, res, next) {
    var path = url.parse(req.url).pathname;
    if (options.serveStatic && (S(path).startsWith(options.prefix+'js') || S(path).startsWith(options.prefix+'css'))) {
      staticServer(req, res, next);
      return;
    }
    var pipelineData = res.locals._pipelineData = {
      js: [],
      css: []
    };
    res.locals.includeJs = function(js) {
      pipelineData.js.push(js);
    }
    res.locals.includeCss = function(css) {
      pipelineData.css.push(css);
    }
    res.locals.includeBundle = function(bundle) {
      var bundleData = staticPaths[bundle];
      if (! bundleData) { return; }
      bundleData.a.forEach(function(asset) {
        if (S(asset).endsWith('.js')) {
          res.locals.includeJs(bundle+'/'+asset);
        }
        if (S(asset).endsWith('.css')) {
          res.locals.includeCss(bundle+'/'+asset);
        }
      });
    }
    res.locals.jsLinks = function() {
      return pipelineData.js.map(function(js) { return '<script type="text/javascript" src="/js/'+js+'"></script>'; }).join("\n");
    }
    res.locals.cssLinks = function() {
      return pipelineData.css.map(function(css) { return '<link rel="stylesheet" type="text/css" href="/css/'+css+' />'; }).join("\n");
    }
    next();
  }
}

exports.registerAssets = function(dir, name, options) {
  staticPaths[name || '_default'] = { d: dir, o: options };
}

exports.registerBundle = function(dir, name, assets, options) {
  staticPaths[name] = { d: dir, o: options, a: assets};
}