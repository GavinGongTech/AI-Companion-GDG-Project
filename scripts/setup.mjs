import { access, copyFile, constants } from "node:fs/promises";
import path from "node:path";
import { runDoctor } from "./doctor.mjs";

const rootDir = process.cwd();
const envCopies = [
  {
    source: "server/.env.example",
    destination: "server/.env",
  },
  {
    source: "web/.env.example",
    destination: "web/.env.local",
  },
  {
    source: "extension/.env.example",
    destination: "extension/.env.local",
  },
];

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function copyIfMissing(source, destination) {
  const sourcePath = path.join(rootDir, source);
  const destinationPath = path.join(rootDir, destination);

  if (await fileExists(destinationPath)) {
    return { destination, created: false };
  }

  await copyFile(sourcePath, destinationPath);
  return { destination, created: true };
}

const results = [];
for (const entry of envCopies) {
  results.push(await copyIfMissing(entry.source, entry.destination));
}

for (const result of results) {
  process.stdout.write(
    `${result.created ? "created" : "kept"} ${result.destination}\n`,
  );
}

const doctorResult = await runDoctor({ strict: false });
if (doctorResult.errors.length > 0 || doctorResult.warnings.length > 0) {
  process.stdout.write("\nSetup review:\n");
  for (const message of [...doctorResult.errors, ...doctorResult.warnings]) {
    process.stdout.write(`- ${message}\n`);
  }
}
