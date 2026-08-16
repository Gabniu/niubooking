import { spawnSync } from "node:child_process";

const compose = ["compose", "-f", "docker-compose.test.yml"];
const suppliedDatabase = process.env.TEST_DATABASE_URL;

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, { stdio: "inherit", shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(" ")} exited ${result.status}`);
}

if (suppliedDatabase) {
  run(process.execPath, ["--test", "--test-concurrency=1", "packages/database/dist/migrations.integration.test.js", "packages/database/dist/occurrences.concurrency.integration.test.js"]);
} else if (process.env.CI === "true") {
  // CI owns its ephemeral Docker runner. A developer workstation never starts a database implicitly.
  try {
    run("docker", [...compose, "up", "--detach", "--wait"]);
    run(process.execPath, ["--test", "--test-concurrency=1", "packages/database/dist/migrations.integration.test.js", "packages/database/dist/occurrences.concurrency.integration.test.js"], {
      env: {
        ...process.env,
        TEST_DATABASE_URL: "postgresql://bookingapp_test:bookingapp_test@127.0.0.1:55432/bookingapp_test",
      },
    });
  } finally {
    spawnSync("docker", [...compose, "down"], { stdio: "inherit", shell: false });
  }
} else {
  console.warn("Database integration lane skipped: set TEST_DATABASE_URL to an approved test server.");
  console.warn("DEPLOYMENT.md currently records no deployed Booking database; no local Docker process was started.");
}
