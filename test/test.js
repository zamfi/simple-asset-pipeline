var http = require('http');
var assert = require('assert');
var express = require('express');
var pipeline = require('../index');
var testmodule = require('./testmodule');

var app = express();
var port = 0;

var defaultHandler;

app.configure(function() {
  pipeline.registerAssets(__dirname+'/module1', 'jmod');
  pipeline.registerAssets(__dirname+'/module2', 'cmod');
  testmodule.setupPipeline(pipeline);

  this.use(pipeline.expressPipeline());
  this.get('/', function(req, res, next) {
    defaultHandler(req, res, next);
  });
  this.use(this.router);
  this.use(function(req, res, next) {
    res.status(404);
  })
});

function expectResponse(code) {
  return function(res, cb) {
    assert.equal(res.statusCode, code, 'expected status code '+code+' but got '+res.statusCode);
    cb();
  }
}

function expectData(code, data) {
  return function(res, cb) {
    assert.equal(res.statusCode, code, 'expected status code '+code+' but got '+res.statusCode);
    var d = [];
    res.on('data', function(chunk) {
      d.push(chunk);
    });
    res.on('end', function() {
      assert.equal(data, d.join(''), 'expected data '+data+' but got '+d.join(''));
      cb();
    });
    res.on('error', function(err) {
      cb(err);
    })
  }
}

function singleTest(path, setup, responseHandler, cb) {
  if (setup) { setup(); }
  var url = 'http://localhost:'+port+path;
  http.get(url, function(res) {
    responseHandler(res, cb);
  });
}

function runTests(tests) {
  function runTest(i) {
    if (i < tests.length) {
      singleTest(tests[i][0], tests[i][1], tests[i][2], function(err) { 
        if (err) {
          process.exit(1);
        }
        console.log('TEST '+(i+1)+'...OK');
        runTest(i+1); 
      });
    } else {
      console.log('All done!');
      process.exit(0);
    }
  }
  runTest(0);
}

app.listen(0, function(err) {
  port = this.address().port;
  console.log("Testing server on", port);
  runTests([
    // linkJs
    [ '/', 
      function() { 
        defaultHandler = function(req, res, next) {
          res.locals.linkJs('jmod/test.js');
          assert.equal(res.locals.jsLinks(), '<script type="text/javascript">window.SAPprefix = \'/\';</script>\n<script type="text/javascript" src="/js/jmod/test.js"></script>', "linkJs didn't include JS: "+res.locals.jsLinks());
          res.end('ok');
        }
      }, expectResponse(200) ],
    // linkJs
    [ '/js/jmod/a.js', null, expectData(200, '// a') ],
    // serve img
    [ '/img/jmod/test.jpg', null, expectData(200, 'not a real jpeg.')],
    // linkJs
    [ '/js/testmodule/b.js', null, expectData(200, '// b') ],

    // linkBundle
    [ '/',
      function() { 
        defaultHandler = function(req, res, next) {
          res.locals.linkBundle('testmodule-bundle');
          assert.equal(res.locals.jsLinks(), '<script type="text/javascript">window.SAPprefix = \'/\';</script>\n<script type="text/javascript" src="/js/testmodule-bundle/b.js"></script>', "linkBundle didn't include JS: "+res.locals.jsLinks());
          assert.equal(res.locals.cssLinks(), '<link rel="stylesheet" type="text/css" href="/css/testmodule-bundle/c.css" />', "linkBundle didn't include css: "+res.locals.cssLinks());
          assert.equal(res.locals.templateContents(), '<div>hi</div>', "linkBundle didn't include HTML: "+res.locals.templateContents());
          res.end('ok');
        }
      }, expectResponse(200)],
    // linkBundle
    [ '/js/testmodule-bundle/b.js', null, expectData(200, '// b') ],
    // linkBundle
    [ '/css/testmodule-bundle/c.css', null, expectData(200, '/* c */') ]
  ]);
});

process.on('uncaughtException', function(e) {
  console.log('FAILURE:', e.message);
  process.exit(1);
})