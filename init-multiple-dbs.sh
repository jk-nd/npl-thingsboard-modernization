#!/bin/bash

set -e
set -u

function create_user_and_database() {
	local database=$1
	echo "  Creating user and database '$database'"
	psql --username "$POSTGRES_USER" <<-EOSQL
	    DO \$\$
	    BEGIN
	        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$database') THEN
	            CREATE USER $database;
	        END IF;
	    END
	    \$\$;
	    CREATE DATABASE $database;
	    GRANT ALL PRIVILEGES ON DATABASE $database TO $database;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
	echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
	for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
		create_user_and_database $db
	done
	echo "Multiple databases created"
fi

# Create postgraphile user for NPL Read Model
echo "Creating postgraphile user for NPL Read Model"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER postgraphile WITH PASSWORD 'secret';
    GRANT ALL PRIVILEGES ON DATABASE npl_engine TO postgraphile;
    GRANT ALL PRIVILEGES ON SCHEMA public TO postgraphile;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgraphile;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgraphile;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgraphile;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgraphile;
EOSQL
echo "postgraphile user created successfully" 