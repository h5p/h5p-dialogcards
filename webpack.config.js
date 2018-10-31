const path = require('path');
const webpack = require('webpack');

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = (nodeEnv !== 'production');

const config = {
  mode: 'development',
  entry: './src/dialogcards.js',
  output: {
    filename: 'h5p-dialogcards.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015']
        }
      }
    ]
  },
  stats: {
    colors: true
  }
};

if (isDev) {
  config.devtool = 'inline-source-map';
}

module.exports = config;
