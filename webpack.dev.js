const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  entry: {
    demo: "./demo/demo.ts",
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./demo/index.html",
      chunks: ["musescore-display", "demo"],
    }),
  ],
  devServer: {
    static: [
      { directory: path.join(__dirname, "build") },
      { directory: path.join(__dirname, "demo"), publicPath: "/samples" },
    ],
    port: 8001,
    open: true,
    hot: true,
  },
});
