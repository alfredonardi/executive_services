# ADR-004: AI Provider Abstraction Layer

**Date:** 2026-04-07  
**Status:** Accepted  
**Deciders:** Tech Lead

---

## Context

The product relies on AI for the concierge chat and recommendation scoring. AI models and providers are evolving rapidly. Locking into a single provider (e.g., OpenAI) creates risk: pricing changes, availability issues, and capability gaps.

## Decision

Build a **provider-agnostic AI abstraction layer** in the backend.

The `AIModule` exposes a `AIService` interface that the rest of the system uses. The underlying provider (OpenAI, Anthropic, local model) is an implementation detail.

```typescript
interface AIProvider {
  chat(messages: ChatMessage[], options: ChatOptions): Promise<AIResponse>;
  chatStream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<string>;
  embed(text: string, options?: EmbedOptions): Promise<number[]>;
}
```

The active provider is selected via configuration (`AI_PROVIDER=openai|anthropic|local`).

All AI calls are:
- Rate-limited per user
- Cost-tracked (token usage logged)
- Audited (input/output stored in audit log)
- Timed out with fallback behavior
- Monitored for quality (optional human review flag)

## Rationale

- Provider lock-in is a strategic risk
- OpenAI is the default for MVP (best developer experience)
- Anthropic Claude is the fallback (different safety characteristics)
- Abstraction adds ~1 sprint of overhead but pays off in flexibility
- Business logic must not reference `openai`, `anthropic` etc. directly

## Alternatives Considered

- **Direct OpenAI SDK usage**: Faster initially. Rejected due to lock-in risk.
- **LangChain**: Feature-rich but heavy and opinionated. Adds complexity for MVP. Deferred.
- **LlamaIndex**: Better for RAG. May introduce later for document ingestion.

## Consequences

- All new AI features must use `AIService`, never a provider SDK directly
- Adding a new provider requires implementing `AIProvider` interface only
- Token cost monitoring requires provider-specific token counting logic
- Streaming must be handled generically (AsyncIterable)
- Context assembly (user profile + schedule) is the responsibility of the calling module, not AIModule
