---
name: opencode-karpathy-guidelines
description: Use when starting any OpenCode coding conversation or when a session is about to shift from discussion into planning, implementation, review, or refactoring.
---

# OpenCode Karpathy Guidelines

## Overview

This skill applies Karpathy-style behavioral guardrails to OpenCode sessions. Its purpose is to reduce silent assumptions, overengineering, drive-by edits, and unverified completion claims.

**Tradeoff:** This skill biases toward caution over speed. For trivial questions or obvious one-line fixes, use judgment.

## When to Use

- At the start of a coding-focused conversation.
- Before moving from explanation into planning or implementation.
- Before reviewing, refactoring, or claiming work is complete.
- Do not load this for casual non-technical chat with no repo or implementation impact.

## Core Rules

### 1. Think Before Coding

- State assumptions explicitly when the request is ambiguous.
- Do not silently choose between materially different interpretations.
- If a simpler solution exists, say so before building a larger one.
- If confusion remains after exploration, name it instead of guessing.

### 2. Simplicity First

- Implement exactly what was requested and nothing speculative.
- Avoid abstractions, options, or configurability without a present need.
- Prefer the smallest diff that solves the actual problem.

### 3. Surgical Changes

- Touch only files directly related to the request.
- Do not clean up adjacent code, comments, or formatting unless required.
- Match project patterns instead of imposing unrelated style changes.
- Remove only the dead code created by your own change.

### 4. Goal-Driven Execution

- Turn the request into explicit pass/fail outcomes before implementation.
- For multi-step work, state a short plan and verify each step.
- Do not claim success without fresh evidence from this repository or runtime.

## OpenCode Application Pattern

1. Explore the repo truth before editing.
2. State your interpretation before non-trivial work.
3. Choose the smallest valid implementation.
4. Verify with real evidence before claiming completion.

## Red Flags

- “I’ll just assume what they meant.”
- “I might as well clean this up too.”
- “This abstraction could be useful later.”
- “It should work now.”

If you notice any of these, stop and correct course.
