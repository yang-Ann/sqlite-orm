import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";

import pkg from "./package.json";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// https://www.rollupjs.com/
export default defineConfig({
  input: resolve(__dirname, "./src/index.ts"),
  output: [
    {
      file: pkg.module,
      format: "es",
    },
    {
      file: pkg.main,
      format: "cjs",
    },
    {
      file: pkg.amd,
      format: "amd",
    },
    {
      file: pkg.browser,
      format: "umd",
      // "umd" 和 "iife" 格式必须指定name, 需要通过 name 访问到 export 的内容
      name: pkg.name,
    }
  ],
  plugins: [
    typescript(),
    babel({ // 忽略 node_modules 下的转译
      babelHelpers: "bundled",
      exclude: "node_modules/**"
    }),
    commonjs(), // 转换 commonjs
    terser(), // 代码压缩
    replace({ // 字符串替换
      preventAssignment: true,
      __VERSION__: pkg.version, 
    }),
  ],
});