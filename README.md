# Call Tree Player

Convierte un guion de llamada ramificado en una interfaz que te dice qué pronunciar y te permite avanzar según lo que responda la otra persona.

> **[Abrir Call Tree Player](https://zautomation-real.github.io/call-tree-player/)**  
> Funciona en el navegador, sin registro y sin subir tu guion a ningún servidor.

![Call Tree Player durante una llamada](artifacts/screenshots/desktop-1440x900.png)

## Cómo usarlo

1. Consigue un archivo `.call.json`. Si todavía no tienes uno, utiliza el **[prompt para crear un buen guion](PROMPT_CREAR_CALL_JSON.md)**.
2. Abre **[Call Tree Player](https://zautomation-real.github.io/call-tree-player/)**.
3. Pulsa **Seleccionar archivo** o arrastra el `.call.json` sobre la zona de carga.
4. Revisa el resumen y pulsa **Iniciar llamada**.
5. Elige en cada pantalla la respuesta que más se aproxime a lo que escuchas. El reproductor te llevará al siguiente fragmento del guion.

**[Crear mi guion y abrir el reproductor →](PROMPT_CREAR_CALL_JSON.md)**

## Qué resuelve

- Mantiene delante solo la intervención que toca pronunciar.
- Convierte respuestas, objeciones y desvíos en rutas visibles.
- Permite volver por el recorrido real de la conversación.
- Recupera una sesión si la página se recarga.
- Descarga un registro al terminar la llamada.
- Valida el archivo antes de empezar para evitar rutas rotas.

## Privacidad

El `.call.json` se lee y se valida dentro de tu navegador. El proyecto no recibe el archivo, el guion ni el historial de la llamada. La sesión se conserva únicamente en el almacenamiento local del dispositivo.

Solo se realizará una petición externa si el propio guion contiene una imagen o un enlace de evidencia y decides abrirlo.

## Atajos durante la llamada

- `1`–`6`: seleccionar una respuesta visible.
- `Backspace`: volver por el historial recorrido.
- `U`: abrir **Respuesta inesperada**.
- `E`: abrir **Evidencia**, cuando exista.
- `Escape`: cerrar el diálogo activo.

## ¿Te resulta útil?

**[Dale una estrella al repositorio](https://github.com/zautomation-real/call-tree-player)** para ayudar a que más personas encuentren el reproductor. Para usarlo, vuelve siempre a la **[aplicación web](https://zautomation-real.github.io/call-tree-player/)**.

