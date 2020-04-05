#!/usr/bin/env python
from __future__ import print_function
import sys
import os

if sys.version_info[0] < 3:
  from BaseHTTPServer import HTTPServer
  from SimpleHTTPServer import SimpleHTTPRequestHandler
else:
  from http.server import HTTPServer, SimpleHTTPRequestHandler

class PutHTTPRequestHandler(SimpleHTTPRequestHandler, object):

    def getContentLength(self):
        # headers is a mimetools.Message
        return int(self.headers.get('Content-Length', '0'))

    def log_request(self, code='-'):
        # log content length
        length = self.getContentLength()
        super(PutHTTPRequestHandler, self).log_request(code, length)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", 0)
        self.end_headers()

    def do_PUT(self):
        path = self.translate_path(self.path)
        dir = os.path.dirname(path)
        if not os.path.exists(dir):
            print("mkdir", dir)
            os.makedirs(dir)
        length = self.getContentLength()
        with open(path, "wb") as dst:
            dst.write(self.rfile.read(length))
        self.send_response(200)
        self.end_headers()

    def end_headers(self):
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range")
        self.send_header("Access-Control-Max-Age", 1728000)
        super(PutHTTPRequestHandler, self).end_headers()

PutHTTPRequestHandler.extensions_map['.mjs'] = 'application/javascript'

if __name__ == '__main__':
    # default port is 8000, or pass on command line
    port = int(sys.argv[1]) if sys.argv[1:] else 8000
    # only accept connections from localhost
    listen_address = ('localhost', port)

    httpd = HTTPServer(listen_address, PutHTTPRequestHandler)
    s = httpd.socket.getsockname()
    print("This server allows PUT operations which will be written to this filesystem!")
    print("Listening on http://%s:%s ..." % s)
    httpd.serve_forever()
