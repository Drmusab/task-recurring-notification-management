import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import zipPack from "vite-plugin-zip-pack";
import { resolve } from "path";

const isWatch = process.argv.includes("--watch");
const mode = process.env.NODE_ENV || "production";
const isTest = !!process.env.VITEST;

// Custom plugin to handle SVG imports as URLs
function svgUrlPlugin() {
  return {
    name: 'svg-url',
    transform(code: string, id: string) {
      if (id.endsWith('.svg')) {
        // Return the SVG content as a data URL
        // Use btoa instead of Buffer to avoid Node.js dependency in browser
        const svgContent = code;
        const base64 = typeof Buffer !== 'undefined' 
          ? Buffer.from(svgContent).toString('base64')
          : btoa(unescape(encodeURIComponent(svgContent)));
        const dataUrl = `data:image/svg+xml;base64,${base64}`;
        return {
          code: `export default ${JSON.stringify(dataUrl)}`,
          map: null
        };
      }
    }
  };
}

export default defineConfig({
  plugins: [
    svgUrlPlugin(),
    svelte({
      compilerOptions: {
        generate: isTest ? "dom" : undefined,
        dev: isTest || mode === "development",
      },
    }),
    viteStaticCopy({
      targets: [
        { src: "plugin.json", dest: "./" },
        { src: "README.md", dest: "./" },
        { src: "icon.png", dest: "./" },
        { src: "preview.png", dest: "./" },
        { src: "i18n", dest: "./" },
        { src: "assets", dest: "./" },
        { src: "src/assets/icons", dest: "./assets" },
      ],
    }),
    ...(!isWatch
      ? [
          zipPack({
            inDir: "./dist",
            outDir: "./",
            outFileName: "package.zip",
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@backend": resolve(__dirname, "src/backend"),
      "@frontend": resolve(__dirname, "src/frontend"),
      "@shared": resolve(__dirname, "src/shared"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@components": resolve(__dirname, "src/frontend/components"),
      "@stores": resolve(__dirname, "src/frontend/stores"),
      "@hooks": resolve(__dirname, "src/frontend/hooks"),
      "@modals": resolve(__dirname, "src/frontend/modals"),
      "@views": resolve(__dirname, "src/frontend/views"),
      "path": "path-browserify",
      ...(isTest
        ? {
            siyuan: resolve(__dirname, "src/__tests__/siyuan-stub.ts"),
            // Use real rrule library in tests
          }
        : {}),
    },
    ...(isTest ? { conditions: ["browser"] } : {}),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: mode === "production",
    sourcemap: mode === "development" ? "inline" : false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["siyuan", "express", "http", "https", "net", "tls", "fs", "os", "crypto"],
      output: {
        entryFileNames: "index.js",
        format: "cjs",
        exports: "default",
        footer: "if (typeof module !== 'undefined' && module.exports) { module.exports = module.exports.default || module.exports; }",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "style.css") {
            return "index.css";
          }
          return assetInfo.name;
        },
      },
    },
  },
});
