// Compile the browser engine without installing or starting a development server.
const webpack = require('webpack');
const config = require('./webpack.config.js');
delete config.devServer;
config.mode = 'production';
webpack(config,(error,stats) => {
  if(error) {console.error(error);process.exitCode=1;return;}
  console.log(stats.toString({colors:false,modules:false,children:false}));
  if(stats.hasErrors()) process.exitCode=1;
});
