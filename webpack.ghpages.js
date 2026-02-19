const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = merge(common, {
  mode: "production",
  devtool: "source-map",
  entry: {
    demo: "./demo/demo.ts",
  },
  output: {
    filename: "[name].[contenthash:8].js",
    path: path.resolve(__dirname, "dist-demo"),
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./demo/index.html",
      chunks: ["musescore-display", "demo"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "demo/*.mscz",
          to: "samples/[name][ext]",
        },
        {
          from: "demo/*.mscx",
          to: "samples/[name][ext]",
        },
      ],
    }),
  ],
});
