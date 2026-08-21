# Call Tree Player

Reproductor web de guiones de llamada ramificados. Importa un archivo `.call.json`, valida su estructura y su grafo, y muestra en cada paso el texto que debe decir el caller junto a las posibles respuestas del cliente.

## Usar la versión pública

Abre **[Call Tree Player en la web](https://zautomation-real.github.io/call-tree-player/)**, pulsa **Seleccionar archivo** y elige cualquier `.call.json` compatible. También puedes arrastrarlo sobre el área de carga. No hay que instalar ni descargar nada.

Todo se procesa localmente en el navegador: el archivo no se envía a ningún servidor. El guion y la sesión se guardan únicamente en el almacenamiento local del dispositivo.

## Qué contiene este repositorio

Este repositorio sirve para dos formas de uso:

1. **Uso directo desde la web.** GitHub Pages publica la aplicación en la dirección anterior. GitHub sirve los archivos estáticos de la interfaz y el navegador del usuario ejecuta la aplicación.
2. **Uso o desarrollo en local.** El repositorio contiene todo el código fuente, los esquemas de validación, los archivos de ejemplo y las pruebas. Cualquier persona puede clonarlo o descargarlo y ejecutarlo en su ordenador siguiendo las instrucciones de instalación.

La versión web y la versión local son la misma aplicación. No existe un servidor que reciba los guiones: al seleccionar un `.call.json`, la API de archivos del navegador lo lee en el dispositivo, lo valida y conserva la sesión en `localStorage`. Solo se realizaría una petición externa si el propio guion incluye una imagen o un enlace de evidencia y el usuario decide abrirlo.

## Requisitos

- Node.js 20 o posterior
- pnpm 10 o posterior

## Instalación y uso local

### Inicio sencillo en Windows

Con Node.js instalado, haz doble clic en `INICIAR_APP.cmd`. La aplicación arrancará localmente y se abrirá en el navegador. No abras `index.html` directamente: las aplicaciones Vite necesitan una dirección local (`http://127.0.0.1:4173/`), no una ruta `file://`.

### Desarrollo

```bash
pnpm install
pnpm dev
```

Vite mostrará la dirección local de la aplicación. El archivo importado no se sube a ningún servidor: el guion, el estado y el historial permanecen en el navegador.

## Comandos

```bash
pnpm dev          # desarrollo
pnpm build        # comprobación TypeScript y build de producción
pnpm preview      # vista previa del build estático
pnpm test         # pruebas unitarias y de componentes
pnpm test:e2e     # pruebas Playwright, accesibilidad y capturas
```

La primera ejecución de las pruebas de navegador puede requerir:

```bash
pnpm exec playwright install chromium
```

## Despliegue

Cada cambio enviado a la rama `main` se compila y publica automáticamente mediante GitHub Pages. También puedes ejecutar `pnpm build`: el resultado queda en `dist/` y puede alojarse en cualquier hosting estático.

No existe backend, base de datos, autenticación ni dependencia de red para el flujo de llamada. La configuración de Vite usa rutas relativas para funcionar tanto en un dominio raíz como bajo la ruta de un repositorio de GitHub Pages.

## Formato de entrada

Los esquemas canónicos están en `src/schemas/`. El archivo se valida con JSON Schema mediante Ajv y, después, con reglas semánticas: identificadores únicos, destinos existentes, resultados válidos y rutas inesperadas resolubles. Los ciclos y las etiquetas repetidas entre nodos distintos están permitidos.

Los fixtures de ejemplo se encuentran en `fixtures/valid/`; los casos que deben rechazarse están en `fixtures/invalid/`.

## Atajos

- `1`–`6`: seleccionar una respuesta visible
- `Backspace`: volver por el historial real
- `U`: abrir Respuesta inesperada
- `E`: abrir Evidencia, cuando exista
- `Escape`: cerrar el diálogo activo

## Persistencia y privacidad

La aplicación guarda el guion y la sesión en `localStorage` después de cada transición y utiliza SHA-256 para detectar contenido diferente con el mismo `script_id`. Al recargar, siempre solicita continuar, empezar de nuevo o cargar otro archivo. No hay telemetría ni subida de datos.
