# Assets PDF corporativos

Colocá los archivos **aquí** (`apps/backend/src/core/pdf/assets/`). Nest los copia a `dist/core/pdf/assets/` al compilar; el backend resuelve rutas absolutas en tiempo de ejecución.

- **`aris-logo.png`** — logo horizontal ARIS (PNG o JPG; ideal **< 2 MB** y ancho razonable; si es enorme, comprimir antes). Si el archivo **no** existe, el PDF usa el texto **ARIS**. En runtime se carga como **data URI** (`getSoPdfLogoImageSrc()`) para que funcione bien en Windows y con `@react-pdf/renderer`.
- **`Roboto-Regular.ttf`** / **`Roboto-Bold.ttf`** — fuentes TTF para `@react-pdf/renderer` (no usar WOFF2 por URL: falla fontkit en Node).

## Logo en la app web (PWA)

Para el shell del front (barra superior, login, etc.), conviene un asset en **`apps/frontend/public/`**, por ejemplo `public/images/aris-logo.svg` o `.png`, y referenciarlo como `/images/aris-logo.svg` en los componentes. Es independiente del PDF del backend.
