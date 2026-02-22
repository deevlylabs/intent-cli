// Validation for parsed INTENT specs.

export function validateSystem(spec) {
  const errors = [];

  if (!spec.intentVersion) {
    errors.push("Missing 'intent' version declaration.");
  }
  if (!spec.systemName) {
    errors.push("Missing 'system' name declaration.");
  }
  if (spec.domains.length === 0) {
    errors.push("At least one domain must be declared.");
  }

  const names = new Set();
  for (const d of spec.domains) {
    if (names.has(d.name)) {
      errors.push(`Duplicate domain name: '${d.name}'.`);
    }
    names.add(d.name);

    if (d.allowGlobs.length === 0) {
      errors.push(`Domain '${d.name}' has no 'paths allow' globs.`);
    }
    for (const dep of d.dependsOn) {
      if (!spec.domains.some((dd) => dd.name === dep)) {
        errors.push(`Domain '${d.name}' depends on unknown domain '${dep}'.`);
      }
    }
  }

  return errors;
}

export function validatePolicy(spec) {
  const errors = [];

  if (!spec.intentVersion) {
    errors.push("Missing 'intent' version declaration.");
  }

  for (const p of spec.policies) {
    const codes = new Set();
    for (const v of p.violations) {
      if (codes.has(v.code)) {
        errors.push(`Policy '${p.name}': duplicate violation code '${v.code}'.`);
      }
      codes.add(v.code);
    }
  }

  return errors;
}
