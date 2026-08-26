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

## Contrato bilingüe transversal

```yaml
business_result: permitir que una misma llamada cambie entre catalán y español sin perder contexto ni duplicar el árbol
causal_hypothesis: una capa de texto localizada sobre IDs y destinos únicos reduce improvisación y mantiene idéntica la decisión comercial
producer: prompt público genérico y generador comercial interno de Webs del Camp
canonical_source: esquema JSON y tipos del repositorio Call Tree Player
fields_or_states: default_language, textos es/ca y language de sesión
consumers: validación, reproductor, registro de respuestas inesperadas, persistencia, registro de sesión, README y prompt copiable
decision_per_consumer: validar ambas versiones, mostrar la seleccionada y conservar exactamente el mismo nodo y destino
storage_and_history: archivos .call.json y language opcional en la sesión; los guiones históricos con cadenas simples siguen siendo válidos
compatibility_and_fallback: una cadena simple se muestra en ambos idiomas; default_language ausente cae a es
feedback_owner: Montador de App
acceptance_tests: fixture bilingüe, traducción incompleta rechazada, selector sin cambio de ruta, inesperadas localizadas y prompt público compilado
sales_metric: llamadas en las que el operador puede continuar en el idioma del interlocutor sin reiniciar el guion
non_obvious_dependencies: el prompt se importa como texto raw durante la compilación y GitHub Pages debe publicar el nuevo bundle
```
