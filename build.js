import fs from "fs";
import path from "path";
import browserify from "browserify";
import UglifyJS from "uglify-js";
import * as sass from "sass";
import tsify from "tsify";
const scriptRegex = /<script\s+?src="?bundle\.js"?>\s*?<\/script>/g
const cssRegex = /<link rel="stylesheet" href="style\.css" ?\/?>/g
const whitespaceRegex = /\s+/g;

try{fs.mkdirSync("./out", true);}catch(e){console.log(e);}

(async function() {
   await browserify("./src/js/main.ts")
   .plugin(tsify, { noImplicitAny: true, allowImportingTsExtensions: true })
   .transform("babelify", {presets: ["@babel/preset-env"]})
   .bundle(function(err, buff) {
      if (err) {
         console.error(err);
      } else {
         fs.writeFileSync("./out/bundle.html", fs.readFileSync("./src/index.html").toString().replace(whitespaceRegex, " ").replace(cssRegex, `<style>${
            sass.compile("./src/css/style.scss", {style: "compressed"}).css
         }</style>`).replace(scriptRegex, `<script>${
            UglifyJS.minify(buff.toString()).code
         }</script>`))
      }
   })
})()
