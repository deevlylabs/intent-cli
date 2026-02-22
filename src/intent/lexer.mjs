// Tokenizer for .intent files.
// Produces a flat token stream consumed by the recursive-descent parsers.

const KEYWORDS = new Set([
  "intent", "system", "domain", "import", "paths", "allow", "depends_on",
  "policy", "violation", "confidence", "when", "severity", "message",
  "suggest", "except_when", "tagged", "requires_approval", "auto_fix",
  "type", "contract", "stability", "fields", "operations",
  "null", "high", "medium", "low", "error", "warn", "info",
  "stable", "unstable", "experimental",
]);

export const T = Object.freeze({
  KEYWORD:  "KEYWORD",
  IDENT:    "IDENT",
  STRING:   "STRING",
  NUMBER:   "NUMBER",
  LBRACE:   "LBRACE",
  RBRACE:   "RBRACE",
  LPAREN:   "LPAREN",
  RPAREN:   "RPAREN",
  COMMA:    "COMMA",
  COLON:    "COLON",
  DOT:      "DOT",
  ARROW:    "ARROW",
  QUESTION: "QUESTION",
  EQ:       "EQ",
  NEQ:      "NEQ",
  AND:      "AND",
  NEWLINE:  "NEWLINE",
  EOF:      "EOF",
});

export function tokenize(source, filename = "<unknown>") {
  const tokens = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  function error(msg) {
    return new SyntaxError(`${filename}:${line}:${col} — ${msg}`);
  }

  function peek() { return source[pos]; }
  function advance() {
    const ch = source[pos++];
    if (ch === "\n") { line++; col = 1; } else { col++; }
    return ch;
  }

  function push(type, value) {
    tokens.push({ type, value, line, col: col - String(value).length });
  }

  while (pos < source.length) {
    const ch = peek();

    if (ch === "/" && source[pos + 1] === "/") {
      while (pos < source.length && peek() !== "\n") advance();
      continue;
    }

    if (ch === "\n") {
      advance();
      if (tokens.length > 0 && tokens[tokens.length - 1].type !== T.NEWLINE) {
        push(T.NEWLINE, "\\n");
      }
      continue;
    }

    if (ch === "\r" || ch === " " || ch === "\t") {
      advance();
      continue;
    }

    if (ch === "{") { advance(); push(T.LBRACE, "{"); continue; }
    if (ch === "}") { advance(); push(T.RBRACE, "}"); continue; }
    if (ch === "(") { advance(); push(T.LPAREN, "("); continue; }
    if (ch === ")") { advance(); push(T.RPAREN, ")"); continue; }
    if (ch === ",") { advance(); push(T.COMMA, ","); continue; }
    if (ch === ":") { advance(); push(T.COLON, ":"); continue; }
    if (ch === ".") { advance(); push(T.DOT, "."); continue; }
    if (ch === "?") { advance(); push(T.QUESTION, "?"); continue; }

    if (ch === "-" && source[pos + 1] === ">") {
      advance(); advance();
      push(T.ARROW, "->");
      continue;
    }

    if (ch === "=" && source[pos + 1] === "=") {
      advance(); advance();
      push(T.EQ, "==");
      continue;
    }
    if (ch === "!" && source[pos + 1] === "=") {
      advance(); advance();
      push(T.NEQ, "!=");
      continue;
    }
    if (ch === "&" && source[pos + 1] === "&") {
      advance(); advance();
      push(T.AND, "&&");
      continue;
    }

    if (ch === '"') {
      advance();
      let str = "";
      while (pos < source.length && peek() !== '"') {
        if (peek() === "\\") { advance(); str += advance(); }
        else { str += advance(); }
      }
      if (pos >= source.length) throw error("Unterminated string literal");
      advance();
      push(T.STRING, str);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let num = "";
      while (pos < source.length && /[0-9.]/.test(peek())) num += advance();
      push(T.NUMBER, num);
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let word = "";
      while (pos < source.length && /[a-zA-Z0-9_]/.test(peek())) word += advance();
      push(KEYWORDS.has(word) ? T.KEYWORD : T.IDENT, word);
      continue;
    }

    throw error(`Unexpected character: '${ch}'`);
  }

  push(T.EOF, "");
  return tokens;
}
