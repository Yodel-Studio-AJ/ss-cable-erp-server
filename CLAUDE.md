# Database Migrations

**IMPORTANT: Whenever you change any file in `src/db/schema/`, you MUST immediately run the migration commands before doing anything else:**

```bash
npm run db:generate
npm run db:migrate
```

This applies to:
- Adding new tables
- Adding, removing, or renaming columns
- Changing column types or constraints
- Adding or removing indexes or foreign keys
- Any other schema modification

Do not leave schema changes without a corresponding migration.
