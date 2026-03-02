import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";
import zipPack from "vite-plugin-zip-pack";
import livereload from "rollup-plugin-livereload";
import fg from "fast-glob";
import { resolve } from "path";

const isWatch = process.argv.includes("--watch");
const isDev = process.env.NODE_ENV === "development";
const mode = process.env.NODE_ENV || "production";
const isTest = !!process.env.VITEST;
const outputDir = isDev ? "dev" : "dist";

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

  ],
  define: {
    "process.env.DEV_MODE": JSON.stringify(isDev),
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),

      /* ── Target architecture (flat) ─────────────────── */
      "@domain": resolve(__dirname, "src/domain"),
      "@application": resolve(__dirname, "src/application"),
      "@infrastructure": resolve(__dirname, "src/infrastructure"),
      "@runtime": resolve(__dirname, "src/runtime"),
      "@services": resolve(__dirname, "src/services"),
      "@query": resolve(__dirname, "src/query"),
      "@cache": resolve(__dirname, "src/cache"),
      "@engine": resolve(__dirname, "src/engine"),
      "@reminders": resolve(__dirname, "src/reminders"),
      "@dependencies": resolve(__dirname, "src/dependencies"),
      "@escalation": resolve(__dirname, "src/escalation"),
      "@integrations": resolve(__dirname, "src/integrations"),
      "@events": resolve(__dirname, "src/events"),
      "@parsers": resolve(__dirname, "src/parsers"),
      "@models": resolve(__dirname, "src/models"),
      "@stores": resolve(__dirname, "src/stores"),
      "@mounts": resolve(__dirname, "src/mounts"),
      "@components": resolve(__dirname, "src/components"),
      "@styles": resolve(__dirname, "src/styles"),
      "@utils": resolve(__dirname, "src/utils"),

      /* ── Legacy aliases (backward compat during migration) ── */
      "@backend": resolve(__dirname, "src/backend"),
      "@frontend": resolve(__dirname, "src/frontend"),
      "@shared": resolve(__dirname, "src/shared"),
      "@hooks": resolve(__dirname, "src/frontend/hooks"),
      "@modals": resolve(__dirname, "src/frontend/modals"),
      "@views": resolve(__dirname, "src/frontend/views"),
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
    outDir: outputDir,
    emptyOutDir: !isWatch,
    minify: !isDev,
    sourcemap: isDev ? "inline" : false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      plugins: [
        ...(isDev
          ? [
              livereload(outputDir),
              {
                name: "watch-external",
                async buildStart() {
                  const files = await fg([
                    "i18n/**",
                    "./README*.md",
                    "./plugin.json",
                  ]);
                  for (const file of files) {
                    this.addWatchFile(file);
                  }
                },
              },
            ]
          : [
              zipPack({
                inDir: "./dist",
                outDir: "./",
                outFileName: "package.zip",
              }),
            ]),
      ],
      external: ["siyuan", "process"],
      output: {
        entryFileNames: "[name].js",
        format: "cjs",
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
