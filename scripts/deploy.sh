#!/bin/bash
# MITI Deployment Script

echo "🚀 Building MITI for deployment..."

# Method 1: Docker (recommended)
build_docker() {
    echo "📦 Building Docker image..."
    docker build -t miti:latest .
    
    echo "💾 Saving Docker image..."
    docker save miti:latest -o miti-docker.tar
    
    echo "✅ Done! Transfer 'miti-docker.tar' to Ubuntu and run:"
    echo "   docker load -i miti-docker.tar"
    echo "   docker run -d -p 3000:3000 --name miti miti:latest"
}

# Method 2: Standalone build
build_standalone() {
    echo "🔨 Building standalone version..."
    bun run build
    
    echo "📦 Creating deployment package..."
    mkdir -p deploy
    cp -r .next/standalone/* deploy/
    cp -r .next/static deploy/.next/static
    cp -r public deploy/public
    
    tar -czf miti-standalone.tar.gz deploy/
    rm -rf deploy
    
    echo "✅ Done! Transfer 'miti-standalone.tar.gz' to Ubuntu and run:"
    echo "   tar -xzf miti-standalone.tar.gz"
    echo "   cd deploy"
    echo "   PORT=3000 HOSTNAME=0.0.0.0 bun server.js"
}

# Choose method
echo "Choose deployment method:"
echo "1) Docker (recommended)"
echo "2) Standalone build"
read -p "Enter choice [1-2]: " choice

case $choice in
    1) build_docker ;;
    2) build_standalone ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "📊 File sizes:"
ls -lh miti-* 2>/dev/null || echo "No deployment files found"
