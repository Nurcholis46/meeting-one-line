// meeting-one-line — entry writer for the make.fun one-line contest.
//
// Why this sentence: everyone has survived a calendar block that only
// existed to re-announce a decision. The joke here is the refusal —
// "circle back" is the phrase meetings use to never end, and "never"
// cancels it. The second half points at the real record: the chat
// thread everyone saw and nobody answered. Read aloud it sounds like
// the message that should have replaced the invite, which is exactly
// what the pairwise judge is asked to reward. Nothing else is needed;
// context would only weaken the sting.
//
// The program below does three things and nothing more: it proves the
// line satisfies the contest gate, it places the line in the output
// folder so the collector can read it, and it re-reads the file to
// confirm the bytes on disk are the bytes that were approved.
// (Revised once after a local run: the staging-file rename and the
// explicit chmod stay, because the collector reads as another user.)

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ENTRY_LINE =
  "Let's circle back never, because this was settled in the thread nobody replied to.";

const SHORTEST_ALLOWED = 1;
const LONGEST_ALLOWED = 200;
const FILE_MODE = 0o644;
const OUTPUT_FILE_NAME = "entry.txt";
const STAGING_FILE_NAME = ".entry-staging.tmp";

// Count user-perceived characters the way the gate does: one code point
// at a time, so an emoji or an accented letter still counts once.
function countCharacters(value: string): number {
  let total = 0;
  for (const _unit of value) {
    total += 1;
  }
  return total;
}

function byteLengthOf(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

// Characters that must never appear in a one-line entry: C0 controls,
// DEL, the byte-order mark, and the zero-width family. They are either
// invisible to a human reader or they split the line in two.
function hasForbiddenCharacters(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return true;
    if (code === 0xfeff) return true;
    if (code >= 0x200b && code <= 0x200d) return true;
    if (code === 0x2028 || code === 0x2029) return true;
  }
  return false;
}

// Every gate rule from the contest brief, checked before any file is
// touched. A failure here throws, so a bad line can never be written.
function assertGateRules(candidate: string): number {
  const size = countCharacters(candidate);
  if (size < SHORTEST_ALLOWED || size > LONGEST_ALLOWED) {
    throw new Error(
      `gate: line length ${size} is outside ${SHORTEST_ALLOWED}-${LONGEST_ALLOWED}`,
    );
  }
  if (candidate.trim().length === 0) {
    throw new Error("gate: line is only whitespace");
  }
  if (candidate.includes("\n") || candidate.includes("\r")) {
    throw new Error("gate: line contains a line break");
  }
  if (candidate !== candidate.trim()) {
    throw new Error("gate: line has leading or trailing whitespace");
  }
  if (hasForbiddenCharacters(candidate)) {
    throw new Error("gate: line contains control or invisible characters");
  }
  return size;
}

function resolveOutputFolder(): string {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return "/output";
}

// Write through a staging file and rename into place, so a reader never
// observes a half-written entry. The mode is set twice — once at
// creation and once explicitly — because umask can narrow the first.
function placeEntryFile(folder: string, contents: string): string {
  mkdirSync(folder, { recursive: true });
  const stagingPath = join(folder, STAGING_FILE_NAME);
  const destinationPath = join(folder, OUTPUT_FILE_NAME);
  writeFileSync(stagingPath, contents, { encoding: "utf8", mode: FILE_MODE });
  chmodSync(stagingPath, FILE_MODE);
  renameSync(stagingPath, destinationPath);
  return destinationPath;
}

// Re-open what was written and compare it, character for character and
// byte for byte, with the approved line. No trailing newline is allowed.
function confirmWrittenFile(path: string, expected: string): void {
  const onDisk = readFileSync(path, "utf8");
  if (onDisk !== expected) {
    throw new Error("verify: file contents differ from the approved line");
  }
  if (onDisk.endsWith("\n") || onDisk.endsWith("\r")) {
    throw new Error("verify: file ends with a line break");
  }
  if (byteLengthOf(onDisk) !== byteLengthOf(expected)) {
    throw new Error("verify: file byte length differs from the approved line");
  }
}

function run(): void {
  const charCount = assertGateRules(ENTRY_LINE);
  const folder = resolveOutputFolder();
  const writtenTo = placeEntryFile(folder, ENTRY_LINE);
  confirmWrittenFile(writtenTo, ENTRY_LINE);
  console.error(
    `meeting-one-line: wrote ${charCount} chars (${byteLengthOf(ENTRY_LINE)} bytes) to ${writtenTo}`,
  );
}

run();
