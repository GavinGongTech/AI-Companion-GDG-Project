import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const rootDir = process.cwd();
const workspaceRoots = [
  "packages/shared",
  "packages/client",
  "web",
  "extension",
  "server",
];

const taskMatrix = {
  dev: {
    parallel: true,
    workspaces: ["server", "web", "extension"],
    longRunning: true,
  },
  build: {
    parallel: true,
    workspaces: ["web", "extension"],
  },
  lint: {
    parallel: true,
    workspaces: workspaceRoots,
  },
  typecheck: {
    parallel: true,
    workspaces: workspaceRoots,
  },
  test: {
    parallel: true,
    workspaces: workspaceRoots,
  },
};

const colorCodes = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
};

const palette = [
  colorCodes.blue,
  colorCodes.green,
  colorCodes.magenta,
  colorCodes.cyan,
  colorCodes.yellow,
];

function formatPrefix(label, index) {
  const color = palette[index % palette.length];
  return `${color}[${label}]${colorCodes.reset}`;
}

async function loadPackageJson(workspace) {
  const packageJsonPath = path.join(rootDir, workspace, "package.json");
  const content = await readFile(packageJsonPath, "utf8");
  return JSON.parse(content);
}

async function resolveWorkspacesForScript(scriptName, preferredWorkspaces) {
  const resolved = [];

  for (const workspace of preferredWorkspaces) {
    try {
      const packageJson = await loadPackageJson(workspace);
      if (packageJson.scripts?.[scriptName]) {
        resolved.push({
          workspace,
          label: packageJson.name ?? workspace,
        });
      }
    } catch {
      // Ignore missing or unreadable workspaces so the runner is resilient.
    }
  }

  return resolved;
}

function pipeOutput(stream, prefix) {
  if (!stream) {
    return;
  }

  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => {
    process.stdout.write(`${prefix} ${line}\n`);
  });
}

function spawnWorkspaceScript(workspace, label, scriptName, index) {
  const prefix = formatPrefix(label, index);
  const child = spawn(
    "bun",
    ["run", "--cwd", workspace, scriptName],
    {
      cwd: rootDir,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );

  pipeOutput(child.stdout, prefix);
  pipeOutput(child.stderr, `${colorCodes.dim}${prefix}`);

  return child;
}

async function runParallel(scriptName, workspaces, { longRunning = false } = {}) {
  if (workspaces.length === 0) {
    return;
  }

  await new Promise((resolve, reject) => {
    const children = workspaces.map(({ workspace, label }, index) =>
      spawnWorkspaceScript(workspace, label, scriptName, index),
    );
    let settled = false;
    let completed = 0;

    function stopOthers(exitedChild) {
      for (const child of children) {
        if (child !== exitedChild && child.exitCode == null) {
          child.kill("SIGTERM");
        }
      }
    }

    for (const child of children) {
      child.on("exit", (code, signal) => {
        completed += 1;

        if (settled) {
          return;
        }

        if (code !== 0) {
          settled = true;
          stopOthers(child);
          reject(
            new Error(
              `${scriptName} failed in a workspace with ${
                signal ? `signal ${signal}` : `exit code ${code}`
              }`,
            ),
          );
          return;
        }

        if (longRunning) {
          if (completed === children.length) {
            settled = true;
            resolve();
          }
          return;
        }

        if (completed === children.length) {
          settled = true;
          resolve();
        }
      });
    }
  });
}

async function runSequential(scriptName, workspaces) {
  for (const [index, { workspace, label }] of workspaces.entries()) {
    await new Promise((resolve, reject) => {
      const child = spawnWorkspaceScript(workspace, label, scriptName, index);
      child.on("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            `${scriptName} failed in ${workspace} with ${
              signal ? `signal ${signal}` : `exit code ${code}`
            }`,
          ),
        );
      });
    });
  }
}

async function runTask(scriptName) {
  const task = taskMatrix[scriptName];
  if (!task) {
    throw new Error(`Unsupported workspace task: ${scriptName}`);
  }

  const workspaces = await resolveWorkspacesForScript(scriptName, task.workspaces);
  if (task.parallel) {
    await runParallel(scriptName, workspaces, {
      longRunning: task.longRunning,
    });
    return;
  }

  await runSequential(scriptName, workspaces);
}

async function main() {
  const task = process.argv[2];
  if (!task) {
    throw new Error("Usage: bun run ./scripts/workspace-runner.mjs <task>");
  }

  if (task === "check") {
    for (const step of ["typecheck", "lint", "test", "build"]) {
      process.stdout.write(`\n== ${step} ==\n`);
      await runTask(step);
    }
    return;
  }

  await runTask(task);
}

await main();
