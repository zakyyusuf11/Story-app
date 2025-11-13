// webpack.dev.js
const path = require('path');
const common = require('./webpack.common.js');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'eval-cheap-module-source-map',
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'dist'),
      publicPath: '/',
    },
    historyApiFallback: true,
    port: 9000,
    open: true,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    // Proxy konfigurasi — pastikan target adalah backend Anda, bukan dev server sendiri
    proxy: [
      {
        context: ['/v1'],
        target: 'https://story-api.dicoding.dev',
        changeOrigin: true,
        secure: true,
        ws: true,
        logLevel: 'debug'
      },
    ],
  },
});
