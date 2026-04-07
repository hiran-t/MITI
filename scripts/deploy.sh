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

# Method 3: Electron desktop app
build_electron() {
    echo "🖥️  Building Electron desktop app..."

    echo "Choose platform:"
    echo "  a) Current platform only"
    echo "  b) Windows (.exe)"
    echo "  c) Linux (.deb + .AppImage)"
    echo "  d) macOS (.dmg)"
    echo "  e) All platforms"
    read -p "Enter choice [a-e]: " platform

    case $platform in
        a) npm run electron:build ;;
        b) npm run electron:build:win ;;
        c) npm run electron:build:linux ;;
        d) npm run electron:build:mac ;;
        e) npm run electron:build:all ;;
        *) echo "Invalid choice"; exit 1 ;;
    esac

    echo "✅ Done! Installers are in the 'dist-electron/' folder"
}

# Choose method
echo "Choose deployment method:"
echo "1) Docker (recommended for server)"
echo "2) Standalone build (Node.js server)"
echo "3) Electron desktop app (installable software)"
read -p "Enter choice [1-3]: " choice

case $choice in
    1) build_docker ;;
    2) build_standalone ;;
    3) build_electron ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

echo ""
echo "📊 File sizes:"
ls -lh miti-* dist-electron/*.{exe,deb,dmg,AppImage} 2>/dev/null || echo "No deployment files found"
