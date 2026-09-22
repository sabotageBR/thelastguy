#!/usr/bin/env python3
"""Servidor estático de desenvolvimento para The Last Guy.

- Sem cache (Cache-Control: no-store), para nunca servir arquivos velhos.
- Tipos MIME explícitos para .js/.mjs/.webmanifest/.ttf/.svg.
- Escuta em 0.0.0.0 e mostra o endereço da rede local para testar no celular.

Uso: python3 tools/serve.py [porta]
"""
import http.server
import os
import socket
import socketserver
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json',
        '.ttf': 'font/ttf',
        '.woff2': 'font/woff2',
        '.svg': 'image/svg+xml',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '--quiet' not in sys.argv:
            super().log_message(fmt, *args)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8000
    with Server(('0.0.0.0', port), Handler) as httpd:
        print(f'The Last Guy em http://localhost:{port}  (rede local: http://{lan_ip()}:{port})')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
