# Secure P2P File Transfer

A lightweight, secure, ephemeral file transfer system using Python and Vanilla JS. (Supports chat too. The Chat does not have a user system, and this is intentional)

## Technical Details

- **Backend**: Python `http.server` (ThreadedTCPServer)
- **Frontend**: Vanilla JS, CSS
- **Security**: 4-digit PIN authentication (Bearer Token / Query Param)
- **Storage**: Ephemeral `temp_transfers` directory (wiped on exit)
- **Network**: Local LAN only (binds to `0.0.0.0`)

## Requirements

- Python 3.x
- Windows (for `.bat` launcher, script works cross-platform)

## Setup & Run

1.  **Launch**: Double-click `run_transfer.bat` (or run `python server.py`).
2.  **PIN**: Note the 4-digit PIN displayed in the console.

## Usage

1.  **Connect**:
    - Host: Open `http://localhost:8000`.
    - Peer: Scan QR code or enter IP URL.
2.  **Authenticate**: Enter the PIN from the console on both devices.
3.  **Transfer**: Upload files. They appear instantly on connected devices.
4.  **Chat**: Send messages/links in real-time.

## Cleanup

Closing the console/server execution automatically deletes all uploaded files and chat history.
