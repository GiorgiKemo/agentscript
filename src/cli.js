import fs from "node:fs";
import path from "node:path";
import { decodeProgram } from "./compiler/bytecode.js";
import { checkSources, compileSources } from "./compiler/compile.js";
import { formatLayoutSource, formatStyleSource } from "./compiler/format.js";
import { describeProgramIr } from "./compiler/ir.js";

function printUsage() {
  console.log("Usage:");
  console.log("  node src/cli.js compile <layout.agent> <style.style> <outDir>");
  console.log("  node src/cli.js check <layout.agent> <style.style>");
  console.log("  node src/cli.js format <layout.agent> <style.style>");
  console.log("  node src/cli.js inspect <app.awuib>");
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function compile(layoutPath, stylePath, outDir) {
  const layoutSource = readTextFile(layoutPath);
  const styleSource = readTextFile(stylePath);
  const result = compileSources(layoutSource, styleSource);

  ensureDir(outDir);
  const bytecodePath = path.join(outDir, "app.awuib");
  const htmlPath = path.join(outDir, "index.html");
  const cssPath = path.join(outDir, "app.css");
  const jsPath = path.join(outDir, "app.js");

  fs.writeFileSync(bytecodePath, result.bytecode);
  fs.writeFileSync(htmlPath, result.rendered.html, "utf8");
  fs.writeFileSync(cssPath, result.rendered.css, "utf8");
  fs.writeFileSync(jsPath, result.rendered.js, "utf8");

  console.log(`Compiled ${result.nodes.length} nodes and ${result.rules.length} style blocks.`);
  console.log(`Bytecode: ${bytecodePath} (${result.bytecode.length} bytes)`);
  console.log(`Preview: ${htmlPath}`);
  console.log(`Styles: ${cssPath}`);
  console.log(`Runtime: ${jsPath}`);
}

function check(layoutPath, stylePath) {
  const layoutSource = readTextFile(layoutPath);
  const styleSource = readTextFile(stylePath);
  const result = checkSources(layoutSource, styleSource);

  console.log(`Check passed for page "${result.root.pageName}".`);
  console.log(`Nodes: ${result.nodes.length}`);
  console.log(`States: ${result.states.length}`);
  console.log(`Handlers: ${result.handlers.length}`);
  console.log(`Style blocks: ${result.rules.length}`);
}

function inspect(bytecodePath) {
  const buffer = fs.readFileSync(bytecodePath);
  const program = decodeProgram(buffer);
  console.log(JSON.stringify(describeProgramIr(program), null, 2));
}

function format(layoutPath, stylePath) {
  const layoutSource = readTextFile(layoutPath);
  const styleSource = readTextFile(stylePath);
  const formattedLayout = formatLayoutSource(layoutSource);
  const formattedStyle = formatStyleSource(styleSource);

  fs.writeFileSync(layoutPath, formattedLayout, "utf8");
  fs.writeFileSync(stylePath, formattedStyle, "utf8");

  console.log(`Formatted ${layoutPath}`);
  console.log(`Formatted ${stylePath}`);
}

const [, , command, ...args] = process.argv;

if (!command) {
  printUsage();
  process.exit(1);
}

try {
  if (command === "compile") {
    if (args.length !== 3) {
      printUsage();
      process.exit(1);
    }

    compile(args[0], args[1], args[2]);
  } else if (command === "check") {
    if (args.length !== 2) {
      printUsage();
      process.exit(1);
    }

    check(args[0], args[1]);
  } else if (command === "format") {
    if (args.length !== 2) {
      printUsage();
      process.exit(1);
    }

    format(args[0], args[1]);
  } else if (command === "inspect") {
    if (args.length !== 1) {
      printUsage();
      process.exit(1);
    }

    inspect(args[0]);
  } else {
    printUsage();
    process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
