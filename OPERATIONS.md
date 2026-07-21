# Operations

Copy `.env.example` to `.env`, replace secrets, then explicitly run `scripts/bootstrap.sh` and `scripts/migrate.sh`. `start.sh` is non-destructive. Synthetic records require `CONFIRM_DEMO_SEED=yes scripts/seed-demo.sh`.

`/api/governance-cases` is the durable governed-data workflow. It requires classification, lineage, versioned jurisdiction policy, optimistic versioning, independent review, fulfillment evidence, legal-hold enforcement, and append-only history. Generated `gap-*` routes are quarantined. Catalog, warehouse, IAM, ticketing, consent, and deletion/export adapters require real provider credentials and test systems.

