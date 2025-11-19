const readline = require("node:readline");
const { Writable } = require("node:stream");

function assertTty(io) {
  const stdin = io.stdin || process.stdin;
  const stdout = io.stdout || process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Interactive terminal required for prompts. Provide the value via flags instead.");
  }

  return { stdin, stdout };
}

async function promptHidden(io = {}, message = "Passphrase: ") {
  const { stdin, stdout } = assertTty(io);

  const silentOutput = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: stdin,
      output: silentOutput,
      terminal: true,
    });

    stdout.write(message);
    rl.question("", (answer) => {
      rl.close();
      stdout.write("\n");
      resolve(answer);
    });

    rl.on("error", (error) => {
      rl.close();
      reject(error);
    });
  });
}

async function promptInput(io = {}, message = "> ") {
  const { stdin, stdout } = assertTty(io);
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on("error", (error) => {
      rl.close();
      reject(error);
    });
  });
}

module.exports = { promptHidden, promptInput };
