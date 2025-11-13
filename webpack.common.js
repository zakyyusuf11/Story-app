// webpack.common.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: path.resolve(__dirname, 'src/scripts/index.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/', // pastikan serve dari root
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.html$/i,
        use: ['html-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[hash][ext][query]',
        },
      },
      {
        test: /\.js$/i,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/index.html'),
      filename: 'index.html',
      favicon: path.resolve(__dirname, 'src/public/favicon.png'),
    }),

    // CopyWebpackPlugin: salin seluruh folder public ke root dist/
    // Pastikan sw.js hanya disalin ke root dist/ (bukan ke subfolder)
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/public'),
          to: path.resolve(__dirname, 'dist'),
          // Jika ada file yang tidak ingin disalin, tambahkan di ignore
          globOptions: {
            ignore: [
              // contoh: 'ignored-file.txt'
            ],
          },
          noErrorOnMissing: true,
        },
        // Pastikan sw.js (jika ada di src/public) ada di root dist/
        {
          from: path.resolve(__dirname, 'src/public/sw.js'),
          to: path.resolve(__dirname, 'dist/sw.js'),
          noErrorOnMissing: true,
        },
        // Copy manifest.json ke dist
        {
          from: path.resolve(__dirname, 'manifest.json'),
          to: path.resolve(__dirname, 'dist/manifest.json'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js'],
  },
};
