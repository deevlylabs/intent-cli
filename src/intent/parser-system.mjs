// Recursive-descent parser for system.intent files.

import { tokenize, T } from "./lexer.mjs";
import { systemSpec, domainNode } from "./ast.mjs";

export function parseSystem(source, filename = "system.intent") {
  const tokens = tokenize(source, filename);
  let pos = 0;

  function current() { return tokens[pos]; }
  function peek() { return tokens[pos]; }

  function error(msg) {
    const t = current();
    return new SyntaxError(`${filename}:${t.line}:${t.col} — ${msg} (got ${t.type} '${t.value}')`);
  }

  function eat(type, value) {
    const t = current();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      const expected = value ? `${type} '${value}'` : type;
      throw error(`Expected ${expected}`);
    }
    pos++;
    return t;
  }

  function tryEat(type, value) {
    const t = current();
    if (t.type === type && (value === undefined || t.value === value)) {
      pos++;
      return t;
    }
    return null;
  }

  function skipNewlines() {
    while (current().type === T.NEWLINE) pos++;
  }

  // intent 2.0
  function parseVersion() {
    eat(T.KEYWORD, "intent");
    const ver = eat(T.NUMBER);
    skipNewlines();
    return ver.value;
  }

  // system <Name>
  function parseSystemName() {
    eat(T.KEYWORD, "system");
    const name = current().type === T.IDENT ? eat(T.IDENT) : eat(T.KEYWORD);
    skipNewlines();
    return name.value;
  }

  // import "<path>"
  function parseImports() {
    const imports = [];
    while (current().type === T.KEYWORD && current().value === "import") {
      eat(T.KEYWORD, "import");
      imports.push(eat(T.STRING).value);
      skipNewlines();
    }
    return imports;
  }

  // domain <Name> { ... }
  function parseDomain() {
    eat(T.KEYWORD, "domain");
    const name = eat(T.IDENT).value;
    skipNewlines();
    eat(T.LBRACE);
    skipNewlines();

    const allowGlobs = [];
    const dependsOn = [];

    while (current().type !== T.RBRACE) {
      if (current().type === T.KEYWORD && current().value === "paths") {
        eat(T.KEYWORD, "paths");
        eat(T.KEYWORD, "allow");
        allowGlobs.push(eat(T.STRING).value);
        while (tryEat(T.COMMA)) {
          allowGlobs.push(eat(T.STRING).value);
        }
      } else if (current().type === T.KEYWORD && current().value === "depends_on") {
        eat(T.KEYWORD, "depends_on");
        dependsOn.push(eat(T.IDENT).value);
      } else {
        throw error(`Unexpected token in domain block`);
      }
      skipNewlines();
    }
    eat(T.RBRACE);
    skipNewlines();

    return domainNode({ name, allowGlobs, dependsOn });
  }

  // ── Main ────────────────────────────────────────────────────────────

  skipNewlines();
  const intentVersion = parseVersion();
  const systemName = parseSystemName();
  const imports = parseImports();

  const domains = [];
  while (current().type !== T.EOF) {
    if (current().type === T.KEYWORD && current().value === "domain") {
      domains.push(parseDomain());
    } else {
      throw error("Expected 'domain' declaration");
    }
  }

  return systemSpec({ intentVersion, systemName, imports, domains });
}
