#!/usr/bin/env node
/**
 * 루트에서 로컬 개발 스택 전체를 한 번에 띄운다.
 *
 *   npm run dev                    # DB 기동 → 마이그레이션 → 백엔드 + 프론트
 *   npm run dev -- --no-db         # 이미 떠 있는 Postgres 를 그대로 쓴다
 *   npm run dev -- --no-migrate    # alembic upgrade 를 건너뛴다
 *   npm run dev -- --only=backend  # 한쪽만 (backend | frontend | none)
 *
 * 의존성 없이 Node 기본 모듈만 쓴다 — 루트에 npm install 이 필요 없다.
 * 백엔드는 반드시 backend/ 를 cwd 로 실행한다 (절대 경로 import 때문).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKEND = join(ROOT, "backend");
const FRONTEND = join(ROOT, "frontend");
const IS_WIN = process.platform === "win32";

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const only = (args.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] ?? "";

/** .exe 는 셸 없이 그대로 띄운다 — 셸을 끼면 경로에 공백이 있을 때 인용이 꼬인다. */
const needsShell = (cmd) => IS_WIN && !cmd.toLowerCase().endsWith(".exe");

const C = { reset: "\x1b[0m", dim: "\x1b[2m", red: "\x1b[31m", cyan: "\x1b[36m", magenta: "\x1b[35m", yellow: "\x1b[33m" };
const say = (msg) => console.log(`${C.dim}[dev]${C.reset} ${msg}`);
const fail = (...lines) => {
  for (const line of lines) console.error(`${C.red}[dev] ${line}${C.reset}`);
  process.exit(1);
};

/** backend/venv 의 python 을 찾는다. 없으면 안내하고 멈춘다. */
function resolvePython() {
  if (process.env.KIKHIPSTER_PYTHON) return process.env.KIKHIPSTER_PYTHON;
  const candidates = [join(BACKEND, "venv", "Scripts", "python.exe"), join(BACKEND, "venv", "bin", "python")];
  const found = candidates.find(existsSync);
  if (!found) {
    fail(
      "backend/venv 를 찾지 못했습니다.",
      "      cd backend && python -m venv venv && ./venv/Scripts/python.exe -m pip install -r requirements.txt",
      "      (다른 파이썬을 쓰려면 KIKHIPSTER_PYTHON 환경변수로 경로를 넘기세요)",
    );
  }
  return found;
}

/** frontend 는 pnpm-lock.yaml 을 쓴다 — pnpm 이 없는 환경에서만 npm 으로 떨어진다. */
function frontendPackageManager() {
  if (existsSync(join(FRONTEND, "pnpm-lock.yaml"))) {
    const probe = spawnSync("pnpm", ["--version"], { stdio: "ignore", shell: IS_WIN });
    if (!probe.error && probe.status === 0) return "pnpm";
    say(`${C.yellow}pnpm 을 찾지 못해 npm 으로 실행합니다 (frontend 는 pnpm-lock.yaml 기준입니다).${C.reset}`);
  }
  return "npm";
}

/** 동기 실행. 실패하면 그 자리에서 멈춘다. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", shell: needsShell(cmd), ...opts });
  if (r.error) fail(`${cmd} 실행 실패: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} ${cmdArgs.join(" ")} 가 ${r.status} 로 끝났습니다.`);
}

/** compose 의 healthcheck(pg_isready)가 통과할 때까지 기다린다. */
function waitForDb(timeoutMs = 90000) {
  const started = Date.now();
  for (;;) {
    const r = spawnSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", "kikhipster-db"], {
      encoding: "utf8",
      shell: IS_WIN,
    });
    const status = (r.stdout ?? "").trim();
    if (status === "healthy") return;
    if (Date.now() - started > timeoutMs) fail(`kikhipster-db 가 healthy 가 되지 않았습니다 (마지막 상태: ${status || "unknown"}).`);
    say(`DB 기다리는 중… (${status || "starting"})`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}

const children = [];
let shuttingDown = false;

/** 출력에 [be]/[fe] 를 붙여 어느 쪽 로그인지 구분한다. */
function start(label, color, cmd, cmdArgs, cwd) {
  const child = spawn(cmd, cmdArgs, {
    cwd,
    shell: needsShell(cmd),
    env: { ...process.env, FORCE_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = `${color}[${label}]${C.reset} `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(tag + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${C.yellow}[dev] ${label} 가 종료됐습니다 (code=${code}, signal=${signal}). 나머지도 내립니다.${C.reset}`);
    shutdown(code ?? 1);
  });
  children.push({ label, child });
}

/** Windows 의 uvicorn --reload 는 손자 프로세스를 만든다 — taskkill /T 로 트리째 죽인다. */
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (IS_WIN) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
if (IS_WIN) process.on("SIGBREAK", () => shutdown(0)); // Ctrl+Break

// ── 1. DB ────────────────────────────────────────────────────────────────
if (!has("--no-db")) {
  // 데몬이 기동 중일 땐 exit 0 인데 ServerVersion 이 비어 나온다 — 값이 찍혀야 준비된 것이다.
  const daemon = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", shell: IS_WIN });
  if (daemon.error || daemon.status !== 0 || !(daemon.stdout ?? "").trim()) {
    fail("Docker 데몬에 연결하지 못했습니다. Docker Desktop 을 먼저 켜세요.", "      다른 Postgres 를 이미 쓰고 있다면: npm run dev -- --no-db");
  }
  say("docker compose up -d");
  run("docker", ["compose", "up", "-d"], { cwd: ROOT });
  waitForDb();
  say("DB healthy");
}

// ── 2. 마이그레이션 ───────────────────────────────────────────────────────
let pythonPath = null;
const python = () => (pythonPath ??= resolvePython()); // 프론트만 띄울 땐 venv 가 없어도 된다
if (!has("--no-migrate")) {
  say("alembic upgrade head");
  run(python(), ["-m", "alembic", "upgrade", "head"], { cwd: BACKEND });
}

// ── 3. 서버 두 대 ─────────────────────────────────────────────────────────
if (only !== "frontend" && only !== "none") {
  say("backend  → http://localhost:8000 (docs: /docs)");
  start("be", C.cyan, python(), ["-m", "uvicorn", "main:app", "--reload", "--port", "8000"], BACKEND);
}
if (only !== "backend" && only !== "none") {
  say("frontend → http://localhost:3300");
  start("fe", C.magenta, frontendPackageManager(), ["run", "dev"], FRONTEND);
}
if (children.length) say("Ctrl+C 로 전부 내립니다.");
