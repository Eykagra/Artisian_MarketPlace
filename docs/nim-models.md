# NVIDIA NIM models for Artisan Chat

Use **Category 1 — Large Language Models (General Chat / Reasoning)** for the conversational product-listing flow.

## Why this category

- **General chat / reasoning** fits natural-language messages like “I want to sell handmade wooden bowls” and follow-up questions (price, category, image).
- Coding, edge, multimodal, safety-only, embeddings, and other categories are not needed for this use case.

## Recommended models (Category 1)

| Model | NIM id (example) | Use when |
|-------|-------------------|----------|
| **Mistral Large 3 675B** | `mistralai/mistral-large-3-675b-instruct` | Default: strong chat and reasoning. |
| **DeepSeek v3.1** | `deepseek-ai/deepseek-v3.1` | You want speed and long context (128K). |
| **MiniMax M2.1** | `minimax/m2.1` | You need strong multilingual support. |
| **Qwen 3.5 122B** | `qwen3.5-122b-a10b` | Good balance of quality and cost. |

Set in `backend/.env`:

```env
NIM_MODEL=mistralai/mistral-large-3-675b-instruct
```

Use the **exact model id** from your NVIDIA NIM catalog (e.g. from the NVIDIA AI playground or API docs); the ids above may differ slightly by region or catalog version.

## Other categories (not used for this feature)

- **Coding** — for code generation, not product chat.
- **Small / Edge** — for low-resource environments; we run on the backend.
- **Multimodal** — for image/audio input; we only use text for listing.
- **Safety / Guardrails** — optional later; not required for basic chat.
- **Embeddings** — for RAG/search; not for conversational listing.
