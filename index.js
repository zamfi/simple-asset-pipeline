var S = require('string');
var send = require('send');
var url = require('url');
var fs = require('fs');

var staticPaths = {};
var templatePaths = {};
var DEFAULT_MODULE_NAME = '__default';

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
          module = DEFAULT_MODULE_NAME;
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
      css: [],
      tpl: []
    };
    res.locals.includeJs = function(js) {
      pipelineData.js.push(js);
    }
    res.locals.includeCss = function(css) {
      pipelineData.css.push(css);
    }
    res.locals.includeTemplate = function(template) {
      pipelineData.tpl.push(template);
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
        if (S(asset).endsWith('.html')) {
          res.locals.includeTemplate(bundle+'/'+asset);
        }
      });
    }
    res.locals.jsLinks = function() {
      return pipelineData.js.map(function(js) { return '<script type="text/javascript" src="/js/'+js+'"></script>'; }).join("\n");
    }
    res.locals.cssLinks = function() {
      return pipelineData.css.map(function(css) { return '<link rel="stylesheet" type="text/css" href="/css/'+css+'" />'; }).join("\n");
    }
    res.locals.templateContents = function() {
      return pipelineData.tpl.map(function(tmpl) {
        var module = tmpl.split('/', 1)[0];
        var path = tmpl.split('/').slice(1).join('/');
        if (! (module in staticPaths)) {
          module = DEFAULT_MODULE_NAME;
          path = module+'/'+path;
        }
        if (! (module in staticPaths)) {
          return '<!-- module '+tmpl.split('/', 1)[0]+' not found; default module also not found -->';
        }
        var paths = staticPaths[module].templates;
        return paths[path] || '<!-- no data for path '+path+' -->';
      }).join('\n');
    }
    next();
  }
}

// unfortunately these have to be static templates for now.
function readTemplates(dir, options) {
  if (dir in templatePaths) {
    return templatePaths[dir];
  }
  if (! fs.existsSync(dir) || ! fs.statSync(dir).isDirectory()) {
    return {};
  }
  var allFiles = {};
  function readdir(path) {
    var files = fs.readdirSync(dir+(path ? '/'+path : '')).filter(function(fname) { return S(fname).endsWith('.html') && ! S(fname).startsWith('.'); });
    files.forEach(function(fname) {
      var fullName = (path ? '/'+path : '')+'/'+fname;
      var stat = fs.statSync(dir+fullName);
      if (stat.isDirectory()) {
        readdir((path ? path+'/' : '')+fname);
      } else if (stat.isFile()) {
        allFiles[fullName.substr(1)] = fs.readFileSync(dir+fullName, {encoding: 'utf8'});
      }
    });
  }
  readdir();
  templatePaths[dir] = allFiles;
  return allFiles;
}

exports.registerAssets = function(dir, name, options) {
  dir = dir.replace(/\/+$/, '');  
  staticPaths[name || DEFAULT_MODULE_NAME] = { d: dir, o: options, templates: readTemplates(dir+'/html') };
}

exports.registerBundle = function(dir, name, assets, options) {
  dir = dir.replace(/\/+$/, '');  
  staticPaths[name] = { d: dir, o: options, templates: readTemplates(dir+'/html'), a: assets};
}