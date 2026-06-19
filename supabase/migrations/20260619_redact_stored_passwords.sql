-- Regulyze: redact any plaintext passwords already stored in the DB.
-- Run once in the Supabase SQL editor. Idempotent.
--
-- New accounts no longer store plaintext (admin-create-user now writes a marker),
-- but accounts created earlier may still have the real password saved. This finds
-- whatever table holds the `plain_password` column and replaces every real value
-- with the '__PASSWORD_SET__' marker, preserving the Google sign-in marker.

do $$
declare
  t record;
  n bigint;
begin
  for t in
    select table_schema, table_name
    from information_schema.columns
    where column_name = 'plain_password'
      and table_schema = 'public'
  loop
    execute format(
      'update %I.%I set plain_password = ''__PASSWORD_SET__'' ' ||
      'where plain_password is not null ' ||
      'and plain_password not in (''__GOOGLE_OAUTH__'', ''__PASSWORD_SET__'')',
      t.table_schema, t.table_name
    );
    get diagnostics n = row_count;
    raise notice 'Redacted % plaintext password(s) in %.%', n, t.table_schema, t.table_name;
  end loop;
end $$;
