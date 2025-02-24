#!/bin/bash
set -x
set -e
set -o pipefail
# Update system
echo "Updating system packages..."
sudo apt update

# Add PostgreSQL repository
echo "Adding PostgreSQL repository..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import PostgreSQL signing key
echo "Importing PostgreSQL signing key..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package list
echo "Updating package list..."
sudo apt update

# Install PostgreSQL (latest version)
echo "Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Verify installation
echo "Verifying PostgreSQL installation..."
psql --version

# Start PostgreSQL service
echo "Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Print status
echo "PostgreSQL installation completed!"
echo "PostgreSQL service status:"
sudo systemctl status postgresql
# sudo -u postgres psql
