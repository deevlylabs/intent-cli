# INTENT for Humans (No Architecture PhD Required)

If you’re confused, this guide is for you.

This explains INTENT like you're five.

---

# 1. What Problem Does INTENT Solve?

You have a codebase.

You have folders like:

```
src/
  identity/
  billing/
  shared/
```

You (or AI agents) keep making Pull Requests.

Sometimes those PRs:

- Touch multiple folders.
- Modify things they shouldn’t.
- Accidentally mix unrelated features.
- Slowly destroy your architecture.

INTENT is a guard.

It checks every PR and asks:

> “You said you’re working on Identity… so why did you touch Billing?”

That’s it.

---

# 2. What Do I Actually Need To Do?

You only need to do two things once.

## Step 1 — Install

```
npm install -g @intent/cli
```

---

## Step 2 — Initialize in Your Repo

Go to your repo root and run:

```
intent init
```

This creates:

```
system.intent
policies/default.intent
```

Done.

Now INTENT exists in your repo.

---

# 3. What Are These Files?

## system.intent = The Map

This file says:

- What domains exist.
- Which folders belong to which domain.

Example:

```
domain Identity {
  paths allow "src/identity/**"
}

domain Billing {
  paths allow "src/billing/**"
}
```

This means:

- Everything inside `src/identity/` belongs to Identity.
- Everything inside `src/billing/` belongs to Billing.

That’s it.

---

## policies/default.intent = The Rules

This file says what is NOT allowed.

Example:

```
violation CrossDomainTouch confidence high {
  when file.domain != null && task.domain != null && file.domain != task.domain
  severity error
  message "Cross-domain modification detected."
}
```

Translation:

> If a PR says it works on Identity, but touches Billing files → block it.

---

# 4. What Is INTENT-SCOPE?

This is the most important concept.

Every PR must say:

> “I am working on THIS domain.”

You declare it inside the Pull Request description:

```
INTENT-SCOPE: Identity
```

That’s just a line of text in the PR body.

Nothing fancy.

---

# 5. What Happens During a PR?

Let’s say someone (or an AI agent) opens a PR.

In the PR description they write:

```
INTENT-SCOPE: Identity
```

Now CI runs:

```
intent plan
```

INTENT checks:

1. What files changed?
2. Which domains do those files belong to?
3. Does that match the declared scope?

---

## Case A — Everything matches

PR touches only:

```
src/identity/*
```

Result:

PASS ✅

---

## Case B — Cross-domain change

PR touches:

```
src/identity/*
src/billing/invoice.ts
```

Result:

BLOCKED 🚨

INTENT says:

> “You said Identity. Why are you touching Billing?”

---

# 6. What If I Forget to Declare Scope?

If no `INTENT-SCOPE` is written:

INTENT tries to guess by counting which domain appears most.

But guessing is bad.

Best practice:

Always include:

```
INTENT-SCOPE: <DomainName>
```

---

# 7. What If AI Agents Are Writing Code?

Perfect.

INTENT is built for that.

The AI does:

1. Generate code.
2. Run `intent plan --json`.
3. If blocked → fix only the violation.
4. Re-run.
5. Repeat until pass.

No human needs to manually police architecture.

---

# 8. What If I Have Multiple Agents?

Doesn’t matter.

INTENT works per PR.

Each PR declares its scope.

INTENT doesn’t care who wrote the code.

---

# 9. What If I Actually Need to Touch Two Domains?

Then you have options:

Option 1 — Split into two PRs. (Recommended)

Option 2 — Declare an exception tag if your policy allows it.

But default rule:

One PR = One domain.

---

# 10. Do I Need To Configure This Per Agent?

No.

You configure INTENT once per repo.

Agents just follow the rules.

---

# 11. Minimal Adoption Checklist

To start using INTENT:

- [ ] Run `intent init`
- [ ] Adjust `system.intent` to match your folders
- [ ] Keep default policy
- [ ] Require `INTENT-SCOPE` in PRs
- [ ] Add `intent plan` to CI

That’s it.

---

# 12. What INTENT Is NOT

INTENT is not:

- A linter.
- A code formatter.
- An AI.
- A magic refactoring engine.
- A replacement for tests.

INTENT only checks:

> “Did this PR stay inside its declared domain?”

Nothing more.

---

# 13. The Entire System in One Sentence

You declare your architecture once.

Every PR must declare its intention.

INTENT makes sure the code change matches that intention.

That’s the whole idea.

---

If this still feels confusing:

Think of INTENT as a security guard at the door.

The PR says:
“I’m here to visit Identity.”

INTENT checks the building log and says:
“Then why are you inside Billing?”

Blocked.