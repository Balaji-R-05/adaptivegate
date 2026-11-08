#!/bin/bash
# Runs once, the first time the database starts up. The Postgres image
# includes a "supabase_auth_admin" role for GoTrue to use, but it has no
# password set yet - this gives it one so GoTrue can actually log in.
set -e
psql -v ON_ERROR_STOP=1 --username "supabase_admin" --dbname "postgres" <<-EOSQL
  ALTER ROLE supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD';
EOSQL
