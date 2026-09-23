#!/usr/bin/env python3
"""
Android Box - Linux Worker Agent
Vazifasi: Mac Master Server'dan yuborilgan Linux buyruqlarini (docker, bash, tizim holati) bajarish.
Hech qanday qo'shimcha kutubxona (pip) talab qilmaydi - standart Python 3 bilan ishlaydi.
"""

import sys
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 5550

class AgentHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/exec':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body)
                command = data.get('command', '')
            except Exception as e:
                self.send_error(400, f"Invalid JSON: {str(e)}")
                return

            if not command:
                self.send_error(400, "Empty command")
                return

            print(f"[Agent] Buyruq bajarilmoqda: {command}")
            try:
                proc = subprocess.run(
                    command,
                    shell=True,
                    executable='/bin/bash',
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=30,
                    text=True
                )
                response = {
                    "success": True,
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "code": proc.returncode
                }
            except subprocess.TimeoutExpired:
                response = {
                    "success": False,
                    "stdout": "",
                    "stderr": "Buyruq vaqti tugadi (30s timeout)",
                    "code": 124
                }
            except Exception as err:
                response = {
                    "success": False,
                    "stdout": "",
                    "stderr": str(err),
                    "code": 1
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def main():
    port = PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])

    server = HTTPServer(('0.0.0.0', port), AgentHandler)
    print("======================================================")
    print(f"  Android Box Linux Worker Agent ishga tushdi!")
    print(f"  Port: {port}")
    print("  Mac Master Server orqali Linux buyruqlarini qabul qiladi.")
    print("======================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAgent to'xtatildi.")
        server.server_close()

if __name__ == '__main__':
    main()
