// @ts-check
// SessionStart 훅에서 실행한다: 열린 이슈(done 제외)를 한 줄씩 보여주고, upstream 보다 뒤처졌으면 경고한다.
//
// 지켜야 할 것:
//  - 어떤 에러가 나도 메시지만 출력하고 exit 0 — 훅 실패가 세션 시작을 막으면 안 된다.
//  - 형식이 깨진 파일 하나가 전체를 막지 않는다 — 건너뛰고 끝에 모아 보고한다.
//  - 읽기 전용. 자동 pull 하지 않는다.
//  - node 내장 모듈만 쓴다(루트는 "의존성 없음" 원칙). 타입은 JSDoc 이고 `tsc -p .claude/skills/issues` 로 검증한다.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @typedef {'doing' | 'todo' | 'later' | 'done'} Status */
/** @typedef {'high' | 'medium' | 'low'} Priority */
/** @typedef {{ id: string, title: string, status: Status, priority: Priority, created: string, external: string }} Issue */
/** @typedef {{ file: string, reason: string }} ParseError */

/** @type {readonly Status[]} */
const STATUSES = ['doing', 'todo', 'later', 'done'];
/** @type {readonly Priority[]} */
const PRIORITIES = ['high', 'medium', 'low'];
/** @type {Record<Status, number>} */
const STATUS_RANK = { doing: 0, todo: 1, later: 2, done: 3 };
/** @type {Record<Priority, number>} */
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const ID_PATTERN = /^\d{8}-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const FETCH_TIMEOUT_MS = 3000;

const here = dirname(fileURLToPath(import.meta.url));
const projectDir = process.env.CLAUDE_PROJECT_DIR || resolve(here, '..', '..', '..');
const issuesDir = join(projectDir, 'docs', 'issues');

/** @param {unknown} e */
function messageOf(e) {
  return e instanceof Error ? e.message : String(e);
}

/**
 * `---` 로 둘러싼 단순 `key: value` frontmatter 만 읽는다(중첩·배열 없음).
 * @param {string} raw
 * @returns {Record<string, string>}
 */
function parseFrontmatter(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) throw new Error('frontmatter 시작(---)이 없음');
  const end = text.indexOf('\n---', 4);
  if (end === -1) throw new Error('frontmatter 끝(---)이 없음');

  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of text.slice(4, end).split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`"key: value" 형식이 아닌 줄: ${line.trim()}`);
    const key = line.slice(0, colon).trim();
    const value = line
      .slice(colon + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2');
    fields[key] = value;
  }
  return fields;
}

/**
 * @param {string} file 파일명(확장자 포함)
 * @param {string} raw
 * @returns {Issue}
 */
function toIssue(file, raw) {
  const f = parseFrontmatter(raw);
  for (const key of ['id', 'title', 'status', 'priority', 'created']) {
    if (!f[key]) throw new Error(`필수 필드 누락: ${key}`);
  }
  const id = /** @type {string} */ (f.id);
  const status = /** @type {string} */ (f.status);
  const priority = /** @type {string} */ (f.priority);
  const created = /** @type {string} */ (f.created);

  if (!ID_PATTERN.test(id)) throw new Error(`id 형식 오류(YYYYMMDD-HHmm-slug): ${id}`);
  if (id !== basename(file, '.md')) throw new Error(`id(${id})가 파일명과 다름`);
  if (!isStatus(status)) throw new Error(`status 값 오류: ${status} (${STATUSES.join('|')})`);
  if (!isPriority(priority)) throw new Error(`priority 값 오류: ${priority} (${PRIORITIES.join('|')})`);
  if (!DATE_PATTERN.test(created)) throw new Error(`created 형식 오류(YYYY-MM-DD): ${created}`);

  return { id, title: /** @type {string} */ (f.title), status, priority, created, external: f.external ?? '' };
}

/**
 * @param {string} s
 * @returns {s is Status}
 */
function isStatus(s) {
  return STATUSES.some((v) => v === s);
}

/**
 * @param {string} s
 * @returns {s is Priority}
 */
function isPriority(s) {
  return PRIORITIES.some((v) => v === s);
}

/** @returns {{ issues: Issue[], errors: ParseError[] }} */
function loadIssues() {
  /** @type {Issue[]} */
  const issues = [];
  /** @type {ParseError[]} */
  const errors = [];

  /** @type {string[]} */
  let files = [];
  try {
    files = readdirSync(issuesDir).filter((n) => n.endsWith('.md') && n.toLowerCase() !== 'readme.md');
  } catch {
    return { issues, errors }; // docs/issues 가 아직 없다
  }

  for (const file of files) {
    try {
      issues.push(toIssue(file, readFileSync(join(issuesDir, file), 'utf8')));
    } catch (e) {
      errors.push({ file, reason: messageOf(e) });
    }
  }
  return { issues, errors };
}

/**
 * @param {Issue} a
 * @param {Issue} b
 */
function compareIssues(a, b) {
  return (
    STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.id.localeCompare(b.id)
  );
}

/**
 * git 을 조용히 실행한다. 실패(오프라인·upstream 없음·타임아웃)는 null.
 * @param {string[]} args
 * @param {number} timeout
 * @returns {string | null}
 */
function git(args, timeout) {
  try {
    return execFileSync('git', args, {
      cwd: projectDir,
      timeout,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch {
    return null;
  }
}

/** @returns {string | null} 뒤처졌을 때만 경고 문구 */
function behindWarning() {
  // upstream 이 없으면 비교할 게 없으니 fetch 도 건너뛴다.
  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 2000);
  if (!upstream) return null;
  // fetch 가 실패하면(오프라인·타임아웃) 오래된 추적 정보로 경고하지 않고 조용히 로컬 기준으로 간다.
  if (git(['fetch', '--quiet'], FETCH_TIMEOUT_MS) === null) return null;
  const behind = Number(git(['rev-list', '--count', 'HEAD..@{u}'], 2000));
  if (!Number.isInteger(behind) || behind <= 0) return null;
  return `⚠ ${upstream} 보다 ${behind}커밋 뒤처져 있음 — 이슈가 최신이 아닐 수 있다. 작업 전에 git pull 을 고려할 것(자동 pull 안 함).`;
}

function main() {
  const warning = behindWarning();
  if (warning) console.log(warning);

  const { issues, errors } = loadIssues();
  const open = issues.filter((i) => i.status !== 'done').sort(compareIssues);

  if (open.length === 0) {
    console.log('열린 이슈 없음 (docs/issues)');
  } else {
    console.log(`열린 이슈 ${open.length}건 (docs/issues, doing→todo→later / high→low):`);
    for (const i of open) {
      console.log(`[${i.status}][${i.priority}] ${i.id}  ${i.title}`);
    }
  }

  if (errors.length > 0) {
    console.log(`형식 오류 ${errors.length}건 (목록에서 제외됨):`);
    for (const e of errors) console.log(`  - ${e.file}: ${e.reason}`);
  }
}

try {
  main();
} catch (e) {
  console.log(`이슈 목록을 읽지 못했다: ${messageOf(e)}`);
}
process.exit(0);
