import os
import http.server
import socketserver
import socket
import json
import random
import threading
import sys
import shutil
import atexit

PORT = 8000

UPLOAD_DIR = os.path.join(os.getcwd(), 'temp_transfers')
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

def cleanup():
    if os.path.exists(UPLOAD_DIR):
        try:
            shutil.rmtree(UPLOAD_DIR)
            print(f"\n[CLEANUP] Deleted temporary files in {UPLOAD_DIR}")
        except Exception as e:
            print(f"Error cleaning up: {e}")

atexit.register(cleanup)

MESSAGES = []

PIN = str(random.randint(1000, 9999))
print("="*30)
print(f"  SECURITY PIN: {PIN}")
print(f"  Enter this on your device")
print("="*30)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    # Allow cleanup on KeyboardInterrupt
    pass

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ['/', '/index.html', '/style.css', '/manifest.json', '/app.js', '/sw.js', '/SE1.jpg', '/qrcode.min.js', '/favicon.ico'] or self.path.startswith('/api/login'):

             super().do_GET()
             return

        if not self.check_auth():
            return

        if self.path == '/api/ip':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            hostname = socket.gethostname()
            ip_address = socket.gethostbyname(hostname)
            self.wfile.write(json.dumps({'ip': ip_address}).encode())
        elif self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            files = [f for f in os.listdir(UPLOAD_DIR) if os.path.isfile(os.path.join(UPLOAD_DIR, f)) and not f.startswith('.')]
            data = {'files': files, 'messages': MESSAGES}
            self.wfile.write(json.dumps(data).encode())
        else:

            token_valid = False
            if 'token=' + PIN in self.path:
                 token_valid = True
            elif self.headers.get('Authorization') == f'Bearer {PIN}':
                 token_valid = True
            
            if not token_valid:
                 self.send_error(401, "Unauthorized")
                 return

            try:
                clean_path = self.path.split('?')[0]
                filename = clean_path.lstrip('/')
                
                filepath = os.path.join(UPLOAD_DIR, filename)
                
                if os.path.exists(filepath) and os.path.isfile(filepath):
                    with open(filepath, 'rb') as f:
                        self.send_response(200)
                        self.send_header("Content-Type", 'application/octet-stream')
                        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                        fs = os.fstat(f.fileno())
                        self.send_header("Content-Length", str(fs.st_size))
                        self.end_headers()
                        shutil.copyfileobj(f, self.wfile)
                    return
                else:
                    self.send_error(404, "File not found")
            except Exception as e:
                print(e)
                self.send_error(500)

    def do_POST(self):
        if self.path == '/api/login':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                if data.get('pin') == PIN:
                     self.send_response(200)
                     self.end_headers()
                     self.wfile.write(b'{"status": "success"}')
                else:
                     self.send_error(401, "Invalid PIN")
            except:
                self.send_error(400)
            return

        if not self.check_auth():
            return

        if self.path == '/api/chat':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                msg_data = json.loads(post_data.decode('utf-8'))
                if 'text' in msg_data and msg_data['text'].strip():
                    MESSAGES.append(msg_data['text'].strip())
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status": "success"}')
            except:
                self.send_error(400)
            return

        if self.path == '/api/upload':
            content_type = self.headers.get('Content-Type')
            if not content_type:
                self.send_error(400, "Content-Type header missing")
                return
            
            boundary_bytes = None
            if 'boundary=' in content_type:
                boundary_str = content_type.split('boundary=')[1].strip()
                if boundary_str.startswith('"') and boundary_str.endswith('"'):
                    boundary_str = boundary_str[1:-1]
                boundary_bytes = boundary_str.encode('utf-8')
            
            if not boundary_bytes:
                 self.send_error(400, "Multipart boundary missing")
                 return

            remainbytes = int(self.headers['content-length'])
            line = self.rfile.readline()
            remainbytes -= len(line)
            
            if not boundary_bytes in line:
                self.send_error(400, "Content does not begin with boundary")
                return

            while remainbytes > 0:
                line = self.rfile.readline()
                remainbytes -= len(line)
                
                if b'Content-Disposition' in line:
                    line_str = line.decode('utf-8')
                    if 'filename="' in line_str:
                        fn = line_str.split('filename="')[1].split('"')[0]
                        fn = os.path.basename(fn)
                        while True:
                            line = self.rfile.readline()
                            remainbytes -= len(line)
                            if line in (b'\r\n', b'\n', b''):
                                break
                        pre_content = self.rfile.read(remainbytes)
                        search_boundary = b'\r\n--' + boundary_bytes
                        idx = pre_content.find(search_boundary)
                        if idx > 0:
                            file_content = pre_content[:idx]
                            with open(os.path.join(UPLOAD_DIR, fn), 'wb') as f:
                                f.write(file_content)
                            self.send_response(200)
                            self.end_headers()
                            self.wfile.write(b'{"status": "success"}')
                            return
                        else:
                             pass

            self.send_response(400)
            self.end_headers()
            self.wfile.write(b'{"status": "fail"}')
            
    def check_auth(self):
        auth_header = self.headers.get('Authorization')
        if auth_header and auth_header == f'Bearer {PIN}':
            return True
        self.send_error(401, "Unauthorized")
        return False

socketserver.TCPServer.allow_reuse_address = True

with ThreadedHTTPServer(("", PORT), Handler) as httpd:
    print(f"Serving securely at: http://localhost:{PORT}")
    print("Press Ctrl+C to stop the server")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()
