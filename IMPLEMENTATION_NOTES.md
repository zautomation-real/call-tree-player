# Notas de implementación

## Alcance entregado

- React, TypeScript y Vite; CSS plano sin librería de componentes.
- Validación JSON Schema con Ajv y validación semántica del grafo.
- Importación local, resumen, advertencias confirmables y errores con rutas legibles.
- Navegación inmediata, ciclos, etiquetas repetidas, historial real y terminales.
- Registro de respuestas inesperadas con búsqueda, categorías, overrides, `@return`, ramas y `@end`.
- Evidencia bajo demanda con enlaces seguros e imágenes no bloqueantes.
- Autosave, restauración explícita, recuperación de sesión dañada y comparación SHA-256.
- Registro de sesión descargable en JSON.
- Diseño 50/50 de escritorio y fallback móvil con scroll interno de respuestas.
- Atajos, foco visible, diálogo con foco contenido y soporte de movimiento reducido.

## Autoridad aplicada

Cuando el prototipo difería de los documentos, se aplicó la especificación y los tests de aceptación. En concreto, el prototipo no cerraba el registro con `Escape` mientras el buscador tenía foco; la aplicación entregada sí lo hace.

## Desviaciones

No hay desviaciones funcionales conocidas respecto al paquete. El registro inesperado incluido utiliza deliberadamente el contenido fixture suministrado, porque el propio paquete declara que la redacción de producción queda fuera de alcance.

## Seguridad y privacidad

No se ejecuta HTML importado, no se usa `eval`, no existen llamadas de subida ni telemetría, y los enlaces externos de evidencia usan `noopener noreferrer`. Las imágenes de evidencia solo se solicitan cuando el usuario abre el diálogo correspondiente.
