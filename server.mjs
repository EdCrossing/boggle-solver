import { readFileSync } from "fs";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  has(word) {
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) return false;
      node = node.children[ch];
    }
    return node.isWord;
  }
}

// ── Dictionary ──────────────────────────────────────────────────────────────

const DICT_PATHS = [
  "/usr/share/dict/british-english",
  "/usr/share/dict/words",
  "/usr/share/dict/american-english",
];

function findDictionary() {
  for (const p of DICT_PATHS) {
    try { readFileSync(p, { flag: "r" }); return p; } catch {}
  }
  throw new Error("No dictionary found");
}

function loadDictionary(minLen = 3) {
  const raw = readFileSync(findDictionary(), "utf-8");
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

// ── Solver (supports sparse boards with null cells) ─────────────────────────

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
    if (Object.keys(current.children).length === 0) return;

    visited[r][c] = true;
    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
        board[nr][nc] !== null && !visited[nr][nc]
      ) {
        dfs(nr, nc, current, word);
      }
    }
    visited[r][c] = false;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== null) {
        dfs(r, c, trie.root, "");
      }
    }
  }
  return [...found];
}

function boggleScore(word) {
  const len = word.length;
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11;
}

// ── Plural filtering ────────────────────────────────────────────────────────

function filterPlurals(words, trie) {
  return words.filter((w) => {
    if (w.length <= 3) return true;
    // If word ends in 's' and the root (without 's') is a real dictionary word,
    // treat it as a plural and filter it out
    if (w.endsWith("s") && trie.has(w.slice(0, -1))) return false;
    // Also handle -es plurals (e.g. "watches" → "watch")
    if (w.endsWith("es") && trie.has(w.slice(0, -2))) return false;
    return true;
  });
}

// ── Server ──────────────────────────────────────────────────────────────────

console.log("Loading dictionary...");
const t0 = performance.now();
const { trie, count } = loadDictionary(3);
console.log(`Loaded ${count.toLocaleString()} words in ${(performance.now() - t0).toFixed(0)}ms`);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.post("/solve", (req, res) => {
  const { board, minLength = 3, noPlurals = false } = req.body;

  if (!board || !Array.isArray(board) || board.length === 0) {
    return res.status(400).json({ error: "Invalid board" });
  }

  // Normalise: lowercase letters, preserve nulls
  const normalised = board.map((row) =>
    row.map((c) => (c === null ? null : c.toLowerCase()))
  );

  const t1 = performance.now();
  let words = solve(normalised, trie, minLength);

  if (noPlurals) {
    words = filterPlurals(words, trie);
  }

  const elapsed = (performance.now() - t1).toFixed(1);

  // Sort by length desc, then alphabetically
  words.sort((a, b) => b.length - a.length || a.localeCompare(b));

  // Group by length
  const groups = {};
  let totalScore = 0;
  for (const w of words) {
    const len = w.length;
    if (!groups[len]) groups[len] = [];
    groups[len].push(w);
    totalScore += boggleScore(w);
  }

  res.json({
    wordCount: words.length,
    totalScore,
    solveTimeMs: parseFloat(elapsed),
    groups,
  });
});

const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Boggle solver running at http://localhost:${PORT}`);
});
