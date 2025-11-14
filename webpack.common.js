const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/scripts/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.bundle.js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: './src/public',
          to: './',
          globOptions: {
            ignore: ['**/sw.js'],
          },
        },
        {
          from: './src/public/sw.js',
          to: './sw.js',
        },
        {
          from: './manifest.json',
          to: './manifest.json',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.json'],
  },
};

