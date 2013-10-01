exports.setupPipeline = function(pipeline) {
  console.log('testmodule', __dirname);
  pipeline.registerAssets(__dirname+'/assets', 'testmodule');
  pipeline.registerBundle(__dirname+'/assets', 'testmodule-bundle', ["b.js", "c.css"]);
}