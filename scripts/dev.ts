// Starts the PHP API and the Expo web app together; stopping one stops both.
const root = `${import.meta.dir}/..`;

const processes = [
  Bun.spawn(["sh", "-c", "php bin/init-db.php && php -S 0.0.0.0:8080 -t public public/index.php"], {
    cwd: `${root}/packages/api`,
    stdout: "inherit",
    stderr: "inherit",
  }),
  Bun.spawn(["bunx", "expo", "start", "--port", "8081"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
];

const stopAll = () => processes.forEach((p) => p.kill());
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

await Promise.race(processes.map((p) => p.exited));
stopAll();
