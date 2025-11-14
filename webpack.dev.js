const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 8080,
    open: true,
    historyApiFallback: true,
    proxy: {
      '/v1': {
        target: 'https://story-api.dicoding.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

