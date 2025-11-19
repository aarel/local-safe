#!/usr/bin/env node

/*
  RoleModel Init Bridge
  Version: 0.2.1
  Description:
    Loads a RoleModel YAML definition, initializes a Codex runtime context,
    and enables in-session commands: /run, /evaluate, /dispatch.
*/

const fs = require("fs");
const { spawn } = require("child_process");
const readline = require("readline");
const yaml = require("js-yaml");

// === Helper Functions ===
function loadYAML(filePath) {
  try {
    const doc = yaml.load(fs.readFileSync(filePath, "utf8"));
    return doc;
  } catch (e) {
    console.error("Error reading YAML:", e.message);
    process.exit(1);
  }
}

function startCodex(role) {
  console.clear();
  console.log(`🌐  Launching Codex runtime for ${role.RoleModel.Name}`);
  console.log("-------------------------------------------------------");
  console.log(`Type /run, /evaluate, or /dispatch to issue commands.`);
  console.log("Use Ctrl+C to exit.\n");

  const codex = spawn("codex", [], {
    stdio: ["pipe", "inherit", "inherit"],
  });

  // preload with initialization context
  const preload = `You are now acting as ${role.RoleModel.Name}, a ${role.RoleModel.Type} agent.\n${role.RoleModel.Description}\nObjectives:\n${role.Objectives.join(
    "\n"
  )}\n\nBegin in ready state.\n`;
  codex.stdin.write(preload);

  // === Interactive Prompt ===
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${role.RoleModel.Name}> `,
  });

  rl.prompt();

  rl.on("line", (line) => {
    const input = line.trim();

    if (!input) return rl.prompt();

    if (input.startsWith("/run")) {
      const cmd = input.replace("/run", "").trim();
      codex.stdin.write(`\nExecute: ${cmd}\n`);
    } else if (input.startsWith("/evaluate")) {
      const cmd = input.replace("/evaluate", "").trim();
      codex.stdin.write(`\nEvaluate: ${cmd}\n`);
    } else if (input.startsWith("/dispatch")) {
      const cmd = input.replace("/dispatch", "").trim();
      codex.stdin.write(
        `\nDispatch to secondary agent: ${cmd}\nIf unavailable, simulate response.\n`
      );
    } else if (input === "/exit") {
      console.log("Exiting Codex session.");
      rl.close();
      codex.kill();
      process.exit(0);
    } else {
      codex.stdin.write(`${input}\n`);
    }

    rl.prompt();
  });

  rl.on("SIGINT", () => {
    console.log("\nEnding session...");
    codex.kill();
    process.exit(0);
  });
}

// === Entry Point ===
const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: rolemodel-init <rolemodel.yaml>");
  process.exit(1);
}

// Require js-yaml if missing
try {
  require.resolve("js-yaml");
} catch {
  console.log("Installing js-yaml...");
  spawn("npm", ["install", "js-yaml"], { stdio: "inherit" }).on("close", () => {
    console.log("Re-run the script now.");
    process.exit(0);
  });
}

const role = loadYAML(filePath);
startCodex(role);
