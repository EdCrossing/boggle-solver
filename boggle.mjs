#!/usr/bin/env node

import { readFileSync } from "fs";
import { createInterface } from "readline";

// ── Trie ────────────────────────────────────────────────────────────────────

class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) node.children[ch] = new TrieNode();
      node = node.children[ch];
    }
    node.isWord = true;
  }
}

// ── Dictionary ──────────────────────────────────────────────────────────────

function loadDictionary(minLen = 3) {
  const raw = readFileSync("/usr/share/dict/words", "utf-8");
  const trie = new Trie();
  let count = 0;
  for (const line of raw.split("\n")) {
    const word = line.trim().toLowerCase();
    if (word.length >= minLen && /^[a-z]+$/.test(word)) {
      trie.insert(word);
      count++;
    }
  }
  return { trie, count };
}

// ── Solver ──────────────────────────────────────────────────────────────────

function solve(board, trie, minLen = 3) {
  const rows = board.length;
  const cols = board[0].length;
  const found = new Set();
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));

  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  function dfs(r, c, node, path) {
    const letter = board[r][c];

    // Handle "qu" — in Boggle, Q is always followed by U
    const chars = letter === "q" ? ["q", "u"] : [letter];
    let current = node;
    for (const ch of chars) {
      if (!current.children[ch]) return;
      current = current.children[ch];
    }

    const word = path + chars.join("");

    if (current.isWord && word.length >= minLen) {
      found.add(word);
    }

    // Prune: if no children, no further words possible
    if (Object.keys(current.children).length === 0) return;

    visited[r][c] = true;
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, current, word);
      }
    }
    visited[r][c] = false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dfs(r, c, trie.root, "");
    }
  }

  return [...found];
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function boggleScore(word) {
  const len = word.length;
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11; // 8+
}

// ── Board parsing ───────────────────────────────────────────────────────────

function parseBoard(input) {
  const rows = input
    .trim()
    .split("\n")
    .map((row) => row.trim().toLowerCase().split(/[\s,]+/));

  const cols = rows[0].length;
  for (const row of rows) {
    if (row.length !== cols) {
      throw new Error(
        `Inconsistent row lengths: expected ${cols} columns, got ${row.length}`
      );
    }
  }
  return rows;
}

function randomBoard(rows, cols) {
  // Standard Boggle dice distribution (weighted towards common letters)
  const dice16 = [
    "aaeegn", "abbjoo", "achops", "affkps",
    "aoottw", "cimotu", "deilrx", "delrvy",
    "distty", "eeghnw", "eeinsu", "ehrtvw",
    "eiosst", "elrtty", "himnqu", "hlnnrz",
  ];
  // For larger boards, use letter frequency distribution
  const freq =
    "aaaaaaaaabbccddddeeeeeeeeeeeeffggghhiiiiiiiiijkllllmmnnnnnnooooooooppqrrrrrrssssssttttttuuuuvvwwxyyz";

  const total = rows * cols;
  const board = [];

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < dice16.length && total <= 16) {
        // Use standard dice for 4x4
        const die = dice16[idx];
        row.push(die[Math.floor(Math.random() * die.length)]);
      } else {
        row.push(freq[Math.floor(Math.random() * freq.length)]);
      }
    }
    board.push(row);
  }
  return board;
}

// ── Display ─────────────────────────────────────────────────────────────────

function displayBoard(board) {
  const cols = board[0].length;
  const sep = "+" + "---+".repeat(cols);
  console.log("\n" + sep);
  for (const row of board) {
    const cells = row.map((c) => ` ${c === "q" ? "Qu" : c.toUpperCase()} `).join("|");
    console.log("|" + cells + "|");
    console.log(sep);
  }
}

function displayResults(words) {
  // Sort by length (descending), then alphabetically
  words.sort((a, b) => b.length - a.length || a.localeCompare(b));

  const totalScore = words.reduce((sum, w) => sum + boggleScore(w), 0);

  // Group by length
  const groups = {};
  for (const w of words) {
    const len = w.length;
    if (!groups[len]) groups[len] = [];
    groups[len].push(w);
  }

  console.log(`\n Found ${words.length} words — Total score: ${totalScore}\n`);

  const lengths = Object.keys(groups)
    .map(Number)
    .sort((a, b) => b - a);

  for (const len of lengths) {
    const g = groups[len].sort();
    const pts = boggleScore(g[0]);
    console.log(
      ` ${len}-letter (${pts}pt${pts !== 1 ? "s" : ""} each) — ${g.length} word${g.length !== 1 ? "s" : ""}:`
    );
    // Print in columns
    const colWidth = len + 3;
    const termCols = process.stdout.columns || 80;
    const numCols = Math.max(1, Math.floor(termCols / colWidth));
    for (let i = 0; i < g.length; i += numCols) {
      const slice = g.slice(i, i + numCols);
      console.log("   " + slice.map((w) => w.padEnd(colWidth)).join(""));
    }
    console.log();
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printUsage() {
  console.log(`
  Boggle Solver — finds all valid words on an MxN board

  Usage:
    node boggle.mjs                        Interactive mode
    node boggle.mjs --random [ROWS] [COLS] Random board (default 4x4)
    node boggle.mjs --board "A B C D        Enter board inline
                             E F G H        (one row per line)
                             I J K L
                             M N O P"
    node boggle.mjs --min-length 4         Minimum word length (default 3)
    node boggle.mjs --help                 Show this help

  Interactive mode:
    Enter letters row by row (space-separated), then a blank line to solve.
    Type "random MxN" for a random board (e.g. "random 4x8").
    Type "quit" to exit.
  `);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { mode: "interactive", rows: 4, cols: 4, minLen: 3, boardText: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      case "--random":
      case "-r":
        opts.mode = "random";
        if (args[i + 1] && !args[i + 1].startsWith("-")) {
          opts.rows = parseInt(args[++i], 10);
        }
        if (args[i + 1] && !args[i + 1].startsWith("-")) {
          opts.cols = parseInt(args[++i], 10);
        }
        break;
      case "--board":
      case "-b":
        opts.mode = "board";
        opts.boardText = args[++i];
        break;
      case "--min-length":
      case "-m":
        opts.minLen = parseInt(args[++i], 10);
        break;
    }
  }
  return opts;
}

async function interactive(trie, minLen) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const prompt = (q) => new Promise((res) => rl.question(q, res));

  console.log("\n  Boggle Solver — Interactive Mode");
  console.log('  Enter board rows (space-separated letters), blank line to solve.');
  console.log('  "random MxN" for random board, "quit" to exit.\n');

  while (true) {
    const lines = [];
    let first = true;

    while (true) {
      const line = await prompt(first ? "  Board> " : "       > ");
      first = false;

      if (line.trim().toLowerCase() === "quit") {
        rl.close();
        return;
      }

      const randomMatch = line.trim().match(/^random\s+(\d+)\s*x\s*(\d+)$/i);
      if (randomMatch) {
        const board = randomBoard(
          parseInt(randomMatch[1]),
          parseInt(randomMatch[2])
        );
        displayBoard(board);
        const t0 = performance.now();
        const words = solve(board, trie, minLen);
        const elapsed = (performance.now() - t0).toFixed(1);
        displayResults(words);
        console.log(`  Solved in ${elapsed}ms\n`);
        first = true;
        lines.length = 0;
        break;
      }

      if (line.trim() === "") {
        if (lines.length > 0) break;
        continue;
      }

      lines.push(line);
    }

    if (lines.length > 0) {
      try {
        const board = parseBoard(lines.join("\n"));
        displayBoard(board);
        const t0 = performance.now();
        const words = solve(board, trie, minLen);
        const elapsed = (performance.now() - t0).toFixed(1);
        displayResults(words);
        console.log(`  Solved in ${elapsed}ms\n`);
      } catch (e) {
        console.error(`  Error: ${e.message}\n`);
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log("  Loading dictionary...");
  const t0 = performance.now();
  const { trie, count } = loadDictionary(opts.minLen);
  const elapsed = (performance.now() - t0).toFixed(0);
  console.log(`  Loaded ${count.toLocaleString()} words in ${elapsed}ms`);

  if (opts.mode === "random") {
    const board = randomBoard(opts.rows, opts.cols);
    displayBoard(board);
    const t1 = performance.now();
    const words = solve(board, trie, opts.minLen);
    const solveTime = (performance.now() - t1).toFixed(1);
    displayResults(words);
    console.log(`  Solved in ${solveTime}ms`);
  } else if (opts.mode === "board") {
    const board = parseBoard(opts.boardText);
    displayBoard(board);
    const t1 = performance.now();
    const words = solve(board, trie, opts.minLen);
    const solveTime = (performance.now() - t1).toFixed(1);
    displayResults(words);
    console.log(`  Solved in ${solveTime}ms`);
  } else {
    await interactive(trie, opts.minLen);
  }
}

main();
