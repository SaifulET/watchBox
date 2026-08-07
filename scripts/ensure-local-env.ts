import { copyFileSync, existsSync } from "node:fs";
import { Socket } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { expand } from "dotenv-expand";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const envExamplePath = join(root, ".env.example");

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example");
}

expand(loadDotenv({ path: envPath }));

type LocalDependency = {
  name: string;
  url: string | undefined;
  defaultPort: number;
};

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const parseLocalDependency = (
  dependency: LocalDependency
): { name: string; host: string; port: number } | undefined => {
  if (!dependency.url) {
    return undefined;
  }

  try {
    const parsed = new URL(dependency.url);
    if (!localHosts.has(parsed.hostname)) {
      return undefined;
    }
    return {
      name: dependency.name,
      host: parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname,
      port: parsed.port ? Number(parsed.port) : dependency.defaultPort
    };
  } catch {
    return undefined;
  }
};

const canConnect = ({ host, port }: { host: string; port: number }): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new Socket();
    socket.setTimeout(750);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });

const dependencies = [
  parseLocalDependency({
    name: "MongoDB",
    url: process.env.MONGODB_URI,
    defaultPort: 27017
  }),
  parseLocalDependency({
    name: "Redis",
    url: process.env.REDIS_URL,
    defaultPort: 6379
  }),
  parseLocalDependency({
    name: "RabbitMQ",
    url: process.env.RABBITMQ_URL,
    defaultPort: 5672
  })
].filter((dependency): dependency is { name: string; host: string; port: number } => Boolean(dependency));

const missing: string[] = [];
for (const dependency of dependencies) {
  if (!(await canConnect(dependency))) {
    missing.push(`${dependency.name} (${dependency.host}:${dependency.port})`);
  }
}

if (missing.length > 0) {
  console.error(`Local dependencies are not reachable: ${missing.join(", ")}`);
  console.error("Start Docker Desktop, then run: npm run dev:deps");
  process.exit(1);
}
