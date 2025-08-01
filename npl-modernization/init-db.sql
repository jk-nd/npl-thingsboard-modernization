-- Create postgraphile user for NPL Read Model
-- This follows the NPL Read Model documentation examples
CREATE ROLE postgraphile LOGIN PASSWORD 'secret' NOINHERIT;
GRANT CONNECT ON DATABASE npl_engine TO postgraphile; 