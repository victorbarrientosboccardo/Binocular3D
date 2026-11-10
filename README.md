# Binocular3D · sitio de demostración

Sitio estático listo para publicar en **GitHub Pages**. Contiene:

| Carpeta / archivo | Qué es |
|---|---|
| `index.html` | Página de presentación de Binocular3D |
| `app/` | El visor 3D versión Plus (consumo de repuestos y confiabilidad), con sus librerías en `app/vendor/` |
| `app-estandar/` | El visor 3D versión Estándar |
| `assets/` | Logos, ícono y capturas de pantalla |
| `privacidad.html` y `terminos.html` | Aviso de privacidad y términos de uso |
| `404.html` | Página para direcciones inexistentes |
| `.nojekyll` | Indica a GitHub Pages que publique los archivos tal cual |
| `LICENSE` / `licencias.txt` | Derechos de INVICTUM SpA y licencias de terceros (la copia .txt se muestra en el navegador) |
| `robots.txt`, `sitemap.xml` | Indexación del sitio |

Todo el contenido es de demostración: un CAEX diésel-eléctrico genérico de 300 t modelado por INVICTUM SpA, con números de parte, catálogo, láminas y datos de consumo y confiabilidad **ficticios**. No incluye manuales de fabricantes ni datos de ninguna faena.

## Publicar en GitHub Pages

1. En GitHub, crea un repositorio nuevo, por ejemplo `binocular3d-plus`.
2. Sube el contenido de esta carpeta a la raíz del repositorio:
   - **Desde la web:** en el repositorio, *Add file → Upload files*, arrastra **el contenido** de la carpeta (no la carpeta misma) y confirma con *Commit changes*. Si el navegador no sube el archivo oculto `.nojekyll`, créalo con *Add file → Create new file*, con ese nombre y vacío.
   - **Con git:**
     ```bash
     cd binocular3d-plus-github
     git init -b main
     git add .
     git commit -m "Binocular3D: sitio de demostración"
     git remote add origin https://github.com/USUARIO/binocular3d-plus.git
     git push -u origin main
     ```
3. En el repositorio, ve a *Settings → Pages*. En *Build and deployment* elige *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`, y guarda.
4. En uno o dos minutos el sitio queda en `https://USUARIO.github.io/binocular3d-plus/`, y el visor en `…/binocular3d-plus/app/`.

## Requisitos

- Navegador actualizado (Chrome, Edge, Safari o Firefox) con WebGL.
- No necesita conexión a internet para el visor: three.js, PDF.js y jsPDF vienen copiados en `app/vendor/`. Las tipografías también vienen en `fonts/`; antes se cargaban desde Google Fonts y, si no hay conexión, se usan las del sistema.

## Antes de publicar

- **Repositorio público:** en el plan gratuito de GitHub, Pages publica solo desde repositorios públicos, así que el código del visor queda visible para cualquiera. Si prefieres que no se vea, usa un repositorio privado con un plan que lo permita, o el portal con clave (`binocular3d-web.zip`), que publica las versiones cifradas.
- **Contacto:** en `index.html` hay un comentario `CONTACTO` donde puedes agregar el correo comercial de INVICTUM SpA.
- **Buscadores:** el sitio puede aparecer en buscadores. Para evitarlo, agrega `<meta name="robots" content="noindex">` en el `<head>` de `index.html`.

## Actualizar el visor

Reemplaza el contenido de `app/` (Plus) y `app-estandar/` (Estándar) por la nueva versión (`index.html`, `data/`, `assets/` y `vendor/`) y sube los cambios. La versión y la fecha de actualización aparecen abajo a la derecha del visor. La página de presentación no necesita cambios.

© 2026 INVICTUM SpA. Todos los derechos reservados.
