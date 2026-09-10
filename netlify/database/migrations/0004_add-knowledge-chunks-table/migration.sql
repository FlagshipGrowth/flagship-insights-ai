-- Knowledge tier (SPEC.md §4/§7). Deferred out of the initial migration (0001) because it
-- needs pgvector and wasn't in scope until Phase 4 started — see CLAUDE.md.
--
-- embedding is vector(1024) for Voyage AI's voyage-3 model (netlify/functions/lib/knowledge/
-- embeddings.ts) — change the dimension here (and re-embed) if the embedding model changes;
-- there's no data yet, so nothing to migrate today.
create extension if not exists vector;

-- scope ∈ {'house', 'client'}. brand_id is null for house-tier chunks (shared across all
-- clients). Enforce at the retrieval layer, not just here: a client-tier query must always
-- filter by brand_id — see get_relevant_chunks in lib/knowledge/retrieval.ts.
create table knowledge_chunks (
    id          uuid primary key default gen_random_uuid(),
    scope       text not null check (scope in ('house', 'client')),
    brand_id    uuid references brands(id) on delete cascade,
    source      text not null,
    content     text not null,
    embedding   vector(1024),
    created_at  timestamptz not null default now(),
    constraint client_scope_requires_brand check (scope = 'house' or brand_id is not null)
);
create index knowledge_chunks_brand_id_idx on knowledge_chunks(brand_id);
create index knowledge_chunks_embedding_idx on knowledge_chunks using ivfflat (embedding vector_cosine_ops);
