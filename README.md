# This is a primitive file transfer purely built to suit my personal requirements/needs. It is not recommended to use this unless you know what is happening.

# 🔗 P2P Transfer - Direct File & Message Transfer

**True peer-to-peer file transfer with NO server hosting required!**

This app creates direct connections between devices using WebRTC, allowing files and messages to transfer directly without going through any server.

## Quick Start

### Step 1: Open the App

Simply open `index.html` in a web browser on both devices.

**For local testing:**

```bash
# Using Python 3
python3 -m http.server 8080

# or

npx http-server -p 8080
```

Then visit `http://localhost:8080` in your browser.

### Step 2: Choose Roles

**On Device 1 (Creator):**

1. Click "Create Connection"
2. Enter a unique keyword (e.g., "transfer-abc-123")
3. Click "Connect"
4. You'll get a connection code - copy it

**On Device 2 (Joiner):**

1. Click "Join Connection"
2. Enter the SAME keyword
3. Click "Connect"
4. Paste the connection code from Device 1
5. You'll get an answer code - share it with Device 1

**Back on Device 1:**

1. Enter the answer code from Device 2
2. Connection established!

### Step 3: Transfer!

Once connected, you can:

- Send messages instantly
- Drag & drop files to transfer
- Download received files.
