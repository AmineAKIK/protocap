# Céline provider cost guard

Céline is designed so routine operational interactions are resolved by the deterministic domain engine before any external model call. The DeepSeek adapter is a fallback language-classification boundary, not the default execution path.

This document defines the runtime guardrails that keep that boundary economically bounded.

## Defaults

- provider calls: maximum 8 per rolling minute for the running process;
- provider tokens: maximum 100,000 reported tokens per rolling hour for the running process;
- aggregate Céline classifier system prompt: maximum 32 KiB UTF-8 at configuration/build time;
- provider history: maximum four semantic turns;
- operator message sent to the provider path: maximum 2,000 characters;
- provider-history characters: maximum 12,000 characters;
- provider completion cap: 160 tokens by default.

`CELINE_PROVIDER_CALLS_PER_MINUTE` and `CELINE_PROVIDER_TOKENS_PER_HOUR` can tune the two runtime provider budgets. They are server-only settings and must never use the `VITE_` prefix.

## Request lifecycle

1. The server authenticates the ShiftGuide session and applies the normal chat request limits.
2. The Céline domain engine attempts to resolve the operator interaction deterministically.
3. If the domain engine handles the interaction, DeepSeek is not called and provider budgets are untouched.
4. Only an unresolved semantic interaction reaches the provider adapter.
5. Before network work starts, the provider cost guard checks prompt/history size, the rolling provider-call rate and rolling provider-token consumption.
6. A blocked request never reaches DeepSeek.
7. After a successful provider response, DeepSeek-reported token usage is added to the rolling hourly budget.

The call-rate budget is independent from the general `/api/celine/chat` rate limiter. This prevents a regression in language routing from converting normal chat capacity directly into model spend.

## Telemetry and privacy

Existing provider telemetry records provider outcome, duration, model, finish reason, prompt/completion/total tokens and prompt-cache hit/miss tokens when DeepSeek reports them. The provider adapter also computes structural input metrics (`systemPromptBytes`, history message count and history character count) without retaining or logging prompt text.

Never log:

- operator message content;
- the system prompt;
- ShiftGuide protected procedure content;
- auth/session tokens;
- API keys.

## Why the guard is process-local

ProtoCap is currently an advanced single-process demonstrator and Railway runs one replica. A process-local provider budget therefore matches the current runtime model and keeps the implementation auditable.

If ProtoCap later becomes multi-replica or a client product, provider budgets must move to a shared store or provider-side quota system before horizontal scaling is enabled.

## Failure semantics

A burst that exceeds the local provider-call rate or the rolling hourly provider-token budget is exposed through the existing provider `rate_limited` path. Oversized prompt/history input is rejected as a local `budget_exceeded` provider failure. In every case the blocked DeepSeek request is not sent.

The guard is deliberately conservative. It is a last-resort safety boundary; product quality should still come primarily from keeping deterministic interactions on the domain-engine path.
