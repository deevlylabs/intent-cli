// Recursive-descent parser for policies/*.intent files.

import { tokenize, T } from "./lexer.mjs";
import { policySpec, policyNode, violationNode, andExpr, compareExpr, fieldRef, literal, nullLiteral } from "./ast.mjs";

export function parsePolicy(source, filename = "policy.intent") {
  const tokens = tokenize(source, filename);
  let pos = 0;

  function current() { return tokens[pos]; }

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

  // ── Predicate parser ──────────────────────────────────────────────

  function parseDottedField() {
    let path = "";
    if (current().type === T.IDENT || current().type === T.KEYWORD) {
      path = current().value;
      pos++;
    } else {
      throw error("Expected identifier in field reference");
    }
    while (current().type === T.DOT) {
      pos++;
      const part = current();
      if (part.type !== T.IDENT && part.type !== T.KEYWORD) {
        throw error("Expected identifier after '.'");
      }
      path += "." + part.value;
      pos++;
    }
    return fieldRef(path);
  }

  function parseAtom() {
    if (current().type === T.STRING) {
      return literal(eat(T.STRING).value);
    }
    if (current().type === T.NUMBER) {
      return literal(eat(T.NUMBER).value);
    }
    if (current().type === T.KEYWORD && current().value === "null") {
      eat(T.KEYWORD, "null");
      return nullLiteral();
    }
    return parseDottedField();
  }

  function parseComparison() {
    const left = parseAtom();
    if (current().type === T.EQ) {
      eat(T.EQ);
      return compareExpr("==", left, parseAtom());
    }
    if (current().type === T.NEQ) {
      eat(T.NEQ);
      return compareExpr("!=", left, parseAtom());
    }
    return left;
  }

  function parsePredicate() {
    let expr = parseComparison();
    while (current().type === T.AND) {
      eat(T.AND);
      expr = andExpr(expr, parseComparison());
    }
    return expr;
  }

  // ── Violation block ───────────────────────────────────────────────

  function parseViolation() {
    eat(T.KEYWORD, "violation");
    const code = eat(T.IDENT).value;
    eat(T.KEYWORD, "confidence");
    const confidence = eat(T.KEYWORD).value;
    if (!["high", "medium", "low"].includes(confidence)) {
      throw error(`Invalid confidence level: ${confidence}`);
    }
    skipNewlines();
    eat(T.LBRACE);
    skipNewlines();

    let predicate = null;
    let severity = null;
    let message = null;
    let suggest = null;
    let exceptWhenTagged = null;
    let requiresApproval = null;
    let autoFix = null;

    while (current().type !== T.RBRACE) {
      const kw = current();

      if (kw.type === T.KEYWORD && kw.value === "when") {
        eat(T.KEYWORD, "when");
        predicate = parsePredicate();
      } else if (kw.type === T.KEYWORD && kw.value === "severity") {
        eat(T.KEYWORD, "severity");
        severity = eat(T.KEYWORD).value;
        if (!["error", "warn", "info"].includes(severity)) {
          throw error(`Invalid severity: ${severity}`);
        }
      } else if (kw.type === T.KEYWORD && kw.value === "message") {
        eat(T.KEYWORD, "message");
        message = eat(T.STRING).value;
      } else if (kw.type === T.KEYWORD && kw.value === "suggest") {
        eat(T.KEYWORD, "suggest");
        suggest = eat(T.STRING).value;
      } else if (kw.type === T.KEYWORD && kw.value === "except_when") {
        eat(T.KEYWORD, "except_when");
        eat(T.KEYWORD, "tagged");
        exceptWhenTagged = eat(T.STRING).value;
        if (current().type === T.KEYWORD && current().value === "requires_approval") {
          eat(T.KEYWORD, "requires_approval");
          requiresApproval = eat(T.STRING).value;
        }
      } else if (kw.type === T.KEYWORD && kw.value === "requires_approval") {
        eat(T.KEYWORD, "requires_approval");
        requiresApproval = eat(T.STRING).value;
      } else if (kw.type === T.KEYWORD && kw.value === "auto_fix") {
        eat(T.KEYWORD, "auto_fix");
        autoFix = eat(T.STRING).value;
      } else {
        throw error(`Unexpected token in violation block`);
      }
      skipNewlines();
    }
    eat(T.RBRACE);
    skipNewlines();

    if (!predicate) throw error(`Violation '${code}' missing 'when' clause`);
    if (!severity) throw error(`Violation '${code}' missing 'severity'`);
    if (!message) throw error(`Violation '${code}' missing 'message'`);

    return violationNode({
      code,
      confidence,
      severity,
      when: predicate,
      message,
      suggest,
      exceptWhenTagged,
      requiresApproval,
      autoFix,
    });
  }

  // ── Policy block ──────────────────────────────────────────────────

  function parsePolicyBlock() {
    eat(T.KEYWORD, "policy");
    const name = eat(T.IDENT).value;
    skipNewlines();
    eat(T.LBRACE);
    skipNewlines();

    const violations = [];
    while (current().type !== T.RBRACE) {
      if (current().type === T.KEYWORD && current().value === "violation") {
        violations.push(parseViolation());
      } else {
        throw error("Expected 'violation' in policy block");
      }
    }
    eat(T.RBRACE);
    skipNewlines();

    return policyNode({ name, violations });
  }

  // ── Main ──────────────────────────────────────────────────────────

  skipNewlines();
  const intentVersion = (() => {
    eat(T.KEYWORD, "intent");
    const v = eat(T.NUMBER).value;
    skipNewlines();
    return v;
  })();

  const policies = [];
  while (current().type !== T.EOF) {
    if (current().type === T.KEYWORD && current().value === "policy") {
      policies.push(parsePolicyBlock());
    } else {
      throw error("Expected 'policy' declaration");
    }
  }

  return policySpec({ intentVersion, policies });
}
