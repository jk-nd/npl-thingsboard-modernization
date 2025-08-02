#!/bin/bash

set -e
set -u

function create_database() {
    local database=$1
    echo "Creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE $database;
EOSQL
}

function create_postgraphile_user() {
    echo "Creating postgraphile user"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE USER postgraphile WITH PASSWORD 'secret';
        GRANT CONNECT ON DATABASE npl_engine TO postgraphile;
        GRANT USAGE ON SCHEMA public TO postgraphile;
        GRANT CREATE ON SCHEMA public TO postgraphile;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgraphile;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgraphile;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgraphile;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO postgraphile;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database $db
    done
    echo "Multiple databases created"
    
    # Create postgraphile user after databases are created
    create_postgraphile_user
fi 