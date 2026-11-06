"""Inicia una copia de prueba de HealthDiet accesible solo desde este equipo."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8765
URL = f"http://localhost:{PORT}/"

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

try:
    server = ThreadingHTTPServer((HOST, PORT), QuietHandler)
except OSError:
    print(f"No se pudo iniciar el servidor: el puerto {PORT} puede estar ocupado.")
    print("Cierra otra copia de HealthDiet y vuelve a intentarlo.")
    sys.exit(1)

print("HealthDiet está disponible en " + URL, flush=True)
print("Mantén esta ventana abierta. Para cerrar, pulsa Ctrl+C.", flush=True)
threading.Timer(1.0, lambda: webbrowser.open(URL)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nHealthDiet se ha cerrado.")
finally:
    server.server_close()
