# Cómo actualizar este sitio

0. Sube el número de versión: `python3 tools/build/bump.py` (patch) o `bump.py minor`. La marca de agua (vX.Y.Z, dd.mm.aa) se sella sola en el sitio y en los dos visores con la fecha del build.
1. Genera la versión Plus desde el repositorio de código de Binocular3D (`npm run build` y `npm run build:local`).
2. Ejecuta `tools/build/make_github.py site_plus_local site_anon_local <carpeta>`: copia las dos versiones a `app/` y `app-estandar/`, sella versión/fecha y el número de WhatsApp (`tools/build/CONTACTO.json`).
3. Revisa que `app/index.html` muestre abajo a la derecha la versión y la fecha nuevas.
4. Haz commit y push a la rama `main`; GitHub Pages publica el cambio en uno o dos minutos.

No subas nunca manuales de fabricantes, catálogos reales, claves ni la versión interna.
