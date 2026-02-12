#!/bin/bash
# Auto-launch Chrome in fullscreen after boot

# Wait for MITI service to be ready
sleep 5

# Wait for localhost:3000 to be available
echo "Waiting for MITI to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "MITI is ready!"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Launch Chrome in fullscreen kiosk mode
if command -v google-chrome &> /dev/null; then
    google-chrome --kiosk --noerrdialogs --disable-infobars --no-first-run --fast --fast-start --disable-features=TranslateUI http://localhost:3000 &
elif command -v chromium-browser &> /dev/null; then
    chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:3000 &
elif command -v chromium &> /dev/null; then
    chromium --kiosk --noerrdialogs --disable-infobars --no-first-run http://localhost:3000 &
else
    echo "Chrome/Chromium not found!"
    # Try Firefox as fallback
    if command -v firefox &> /dev/null; then
        firefox --kiosk http://localhost:3000 &
    fi
fi
