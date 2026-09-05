-- Expose the practice schema through PostgREST so the practice deployment can
-- read and write it with Accept-Profile / Content-Profile: practice.
--
-- Supabase reads PostgREST settings from the authenticator role (in-database
-- config). Before this change the role carried no pgrst.* setting, so the
-- platform default applied: 'public, graphql_public'. This keeps that list and
-- appends practice. `public` stays first, so it remains the default schema and
-- live behaviour is unchanged. Equivalent dashboard click, if this is ever
-- overridden: Project Settings → API → Exposed schemas → add `practice`.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, practice';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
