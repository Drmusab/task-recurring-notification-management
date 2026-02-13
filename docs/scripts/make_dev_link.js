import minimist from "minimist";
import { createSymbolicLink } from "fs";
import path from "path";

const args = minimist(process.argv.slice(2));
const pluginName = args.name || "plugin-sample-shehab-note";
const distDir = path.resolve(process.cwd(), "dist");

// For SiYuan/Shehab-Note development
// Creates a symbolic link from workspace plugins directory to the plugin dist folder
const workspaceDir =
  args.workspace ||
  process.env.SIYUAN_WORKSPACE ||
  process.env.SHEHAB_NOTE_WORKSPACE;

if (workspaceDir) {
  const targetDir = path.join(workspaceDir, "data", "plugins", pluginName);
  console.log(`Creating symbolic link from ${targetDir} to ${distDir}`);

  createSymbolicLink(distDir, targetDir, "dir", (err) => {
    if (err) {
      console.error("Failed to create symbolic link:", err);
    } else {
      console.log("Symbolic link created successfully");
    }
  });
} else {
  console.log(
    "No workspace directory specified. Use --workspace=<path> or set SIYUAN_WORKSPACE/SHEHAB_NOTE_WORKSPACE"
  );
}
