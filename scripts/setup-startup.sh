#!/bin/bash

# This script creates a systemd service to run a custom startup script
# It will run the script at /home/ubuntu/onstartup.sh as the ubuntu user on system boot
# The service will be named 'custom-startup' and will start after network is available

set -xeo pipefail

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root or with sudo"
    exit 1
fi

STARTUP_SCRIPT="/home/ubuntu/onstartup.sh"
SERVICE_NAME="custom-startup"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

# Check if startup script exists
if [ ! -f "$STARTUP_SCRIPT" ]; then
    echo "Error: $STARTUP_SCRIPT does not exist"
    exit 1
fi

# Make startup script executable
sudo chmod +x "$STARTUP_SCRIPT"

# Create systemd service file
sudo cat > "$SERVICE_PATH" << EOL
[Unit]
Description=Custom Startup Script
After=network.target

[Service]
Type=forking
ExecStart=$STARTUP_SCRIPT
User=ubuntu
RemainAfterExit=yes
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable the service
sudo systemctl enable "$SERVICE_NAME"

# Start the service
sudo systemctl start "$SERVICE_NAME"

# Verify configuration
echo "Verifying configuration..."

# Check if service file exists
if [ -f "$SERVICE_PATH" ]; then
    echo "Service file created: OK"
else
    echo "Service file creation: FAILED"
fi

# Check if service is enabled
if sudo systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
    echo "Service enabled: OK"
else
    echo "Service enabled: FAILED"
fi

# Check if service is running
if sudo systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
    echo "Service running: OK"
else
    echo "Service running: FAILED"
fi

# Display service status
echo -e "\nDetailed service status:"
sudo systemctl status "$SERVICE_NAME"

echo -e "\nUseful commands for monitoring the service:"
echo "Check service status:    sudo systemctl status $SERVICE_NAME"
echo "View service logs:       sudo journalctl -u $SERVICE_NAME"
echo "Follow service logs:     sudo journalctl -u $SERVICE_NAME -f"
echo "Restart service:         sudo systemctl restart $SERVICE_NAME"
echo "Stop service:           sudo systemctl stop $SERVICE_NAME"
echo "Start service:          sudo systemctl start $SERVICE_NAME"
echo "View startup script:     cat $STARTUP_SCRIPT"
echo "Edit startup script:     sudo nano $STARTUP_SCRIPT"
