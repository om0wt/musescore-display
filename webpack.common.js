const path = require("path");

module.exports = {
  entry: {
    "musescore-display": "./src/index.ts",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "[name].min.js",
    path: path.resolve(__dirname, "build"),
    library: "musescoreDisplay",
    libraryTarget: "umd",
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
};
