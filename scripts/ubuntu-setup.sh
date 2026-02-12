#!/bin/bash
# MITI Ubuntu Setup Script

echo "🚀 MITI Setup for Ubuntu"
echo ""

# Check if running on Ubuntu
if [ ! -f /etc/os-release ] || ! grep -q "ubuntu\|Ubuntu" /etc/os-release; then
    echo "⚠️  Warning: This script is designed for Ubuntu"
fi

# Function to install Docker
install_docker() {
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "✅ Docker installed! Please log out and back in for group changes to take effect."
}

# Function to install Bun
install_bun() {
    echo "📦 Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    source ~/.bashrc
    echo "✅ Bun installed!"
}

# Check what's needed
echo "Choose installation type:"
echo "1) Docker (recommended) - Run from Docker image"
echo "2) Standalone - Run from standalone build"
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        if ! command -v docker &> /dev/null; then
            echo "Docker not found."
            read -p "Install Docker? [y/N]: " install
            if [ "$install" = "y" ]; then
                install_docker
            fi
        else
            echo "✅ Docker already installed"
        fi
        
        # Find docker image file
        DOCKER_FILE=$(ls miti-docker*.tar.gz 2>/dev/null | head -n 1)
        if [ -n "$DOCKER_FILE" ]; then
            echo "📦 Loading Docker image from $DOCKER_FILE..."
            docker load -i "$DOCKER_FILE"
            
            # Extract tag name from filename or use latest
            TAG=$(echo "$DOCKER_FILE" | grep -oP 'v\d+\.\d+\.\d+' || echo "latest")
            IMAGE_NAME="miti:${TAG}"
            
            echo "🚀 Starting MITI..."
            docker run -d \
              -p 3000:3000 \
              -e NEXT_PUBLIC_ROSBRIDGE_URL=ws://localhost:9090 \
              --name miti \
              --restart unless-stopped \
              "$IMAGE_NAME"
            
            echo ""
            echo "✅ MITI is running!"
            echo "🌐 Access at: http://localhost:3000"
            echo ""
            echo "Useful commands:"
            echo "  docker logs -f miti        # View logs"
            echo "  docker stop miti           # Stop container"
            echo "  docker start miti          # Start container"
            echo "  docker restart miti        # Restart container"
        else
            echo "❌ Docker image file (miti-docker*.tar.gz) not found in current directory"
        fi
        ;;
        
    2)
        if ! command -v bun &> /dev/null; then
            echo "Bun not found."
            read -p "Install Bun? [y/N]: " install
            if [ "$install" = "y" ]; then
                install_bun
            else
                echo "You can also use Node.js instead of Bun"
                exit 1
            fi
        else
            echo "✅ Bun already installed"
        fi
        
        # Find standalone package file
        STANDALONE_FILE=$(ls miti-standalone*.tar.gz 2>/dev/null | head -n 1)
        if [ -n "$STANDALONE_FILE" ]; then
            echo "📦 Extracting files from $STANDALONE_FILE..."
            tar -xzf "$STANDALONE_FILE"
            
            # Check if extraction created expected directory structure
            if [ -d "miti" ]; then
                cd miti
            elif [ -d "deploy/miti" ]; then
                cd deploy/miti
            else
                echo "❌ Unexpected package structure"
                exit 1
            fi
            
            echo "🚀 Starting MITI..."
            
            # Get paths
            MITI_DIR=$(pwd)
            BUN_PATH=$(which bun)
            
            # Find service template (could be in scripts/ or same directory as extracted)
            if [ -f "scripts/auto-startapp.service" ]; then
                SERVICE_TEMPLATE="scripts/auto-startapp.service"
            elif [ -f "../scripts/auto-startapp.service" ]; then
                SERVICE_TEMPLATE="../scripts/auto-startapp.service"
            elif [ -f "auto-startapp.service" ]; then
                SERVICE_TEMPLATE="auto-startapp.service"
            else
                SERVICE_TEMPLATE=""
            fi
            
            SERVICE_FILE="/etc/systemd/system/miti.service"
            
            # Check if service template exists
            if [ -z "$SERVICE_TEMPLATE" ] || [ ! -f "$SERVICE_TEMPLATE" ]; then
                echo "❌ Service template (auto-startapp.service) not found"
                echo "   Searched in: scripts/, ../, and current directory"
                echo "Falling back to direct execution..."
                nohup bun server.js > miti.log 2>&1 &
                echo $! > miti.pid
                echo "✅ MITI started with PID: $(cat miti.pid)"
                echo "⚠️  Will NOT auto-start after reboot"
                exit 0
            fi
            
            echo "Creating systemd service from template..."
            echo "Using template: $SERVICE_TEMPLATE"
            
            # Create service file with substitutions
            sed -e "s|__USER__|$USER|g" \
                -e "s|__WORKDIR__|$MITI_DIR|g" \
                -e "s|__BUN_PATH__|$BUN_PATH|g" \
                "$SERVICE_TEMPLATE" | sudo tee "$SERVICE_FILE" > /dev/null

            # Enable and start the service
            sudo systemctl daemon-reload
            sudo systemctl enable miti.service
            sudo systemctl start miti.service
            
            # Wait a moment and check status
            sleep 2
            if sudo systemctl is-active --quiet miti.service; then
                echo ""
                echo "✅ MITI is running as systemd service!"
                echo "🌐 Access at: http://localhost:3000"
                echo ""
                echo "📝 The application will auto-start after reboot"
                echo ""
                echo "Useful commands:"
                echo "  sudo systemctl status miti     # Check status"
                echo "  sudo systemctl stop miti       # Stop application"
                echo "  sudo systemctl start miti      # Start application"
                echo "  sudo systemctl restart miti    # Restart application"
                echo "  sudo journalctl -u miti -f     # View logs"
            else
                echo ""
                echo "❌ Service failed to start. Check logs:"
                echo "  sudo journalctl -u miti -n 50"
            fi
        else
            echo "❌ Standalone package file (miti-standalone*.tar.gz) not found in current directory"
        fi
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
