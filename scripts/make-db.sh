set -xeo pipefail
source server/.env
echo PGUSER=$PGUSER PGPASSWORD=$PGPASSWORD PGDATABASE=$PGDATABASE

# Drop database if it exists
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $PGDATABASE;"

# Drop user if exists and create new user
sudo -u postgres psql -c "DROP USER IF EXISTS $PGUSER;"
sudo -u postgres psql -c "CREATE USER $PGUSER WITH PASSWORD '$PGPASSWORD';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE $PGDATABASE WITH OWNER $PGUSER;"

# Grant privileges
sudo -u postgres psql -d $PGDATABASE -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $PGUSER;"
sudo -u postgres psql -d $PGDATABASE -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $PGUSER;"
sudo -u postgres psql -d $PGDATABASE -c "GRANT CREATE ON SCHEMA public TO $PGUSER;"

# test:
. server/.env && psql postgresql://$PGUSER:$PGPASSWORD@localhost/$PGDATABASE -c "SELECT 1;"
