const REGEX_ESCAPE = /[.+^${}()|[\]\\]/g;

/**
 * Convert a glob pattern (as used in system.intent paths allow) to a RegExp.
 * Supports **, *, and ? wildcards.
 */
export function globToRegex(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; ) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        re += "(?:.+/)?";
        i += 3;
      } else {
        re += ".*";
        i += 2;
      }
    } else if (ch === "*") {
      re += "[^/]*";
      i++;
    } else if (ch === "?") {
      re += "[^/]";
      i++;
    } else {
      re += ch.replace(REGEX_ESCAPE, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Resolve which domain a file belongs to.
 * Uses most-specific-match (longest glob pattern). Ties broken by domain name (lexicographic).
 */
export function resolveDomain(filePath, domains) {
  let best = null;
  let bestLen = -1;
  for (const domain of domains) {
    for (const pattern of domain.allowGlobs) {
      if (globToRegex(pattern).test(filePath) && pattern.length > bestLen) {
        best = domain.name;
        bestLen = pattern.length;
      } else if (globToRegex(pattern).test(filePath) && pattern.length === bestLen) {
        if (domain.name < best) {
          best = domain.name;
        }
      }
    }
  }
  return best;
}
