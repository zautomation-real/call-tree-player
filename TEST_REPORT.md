# Informe de verificación

Fecha: 20 de agosto de 2026

## Resultado

- Build TypeScript + Vite: aprobado.
- Vitest/Testing Library: 19 pruebas aprobadas.
- Playwright Chromium: 16 pruebas aprobadas.
- Fixtures válidos suministrados: todos aceptados.
- Fixtures inválidos suministrados: todos rechazados por el motivo esperado.
- Análisis Axe sobre la pantalla principal: 0 infracciones.
- Captura desktop: 1440×900.
- Captura móvil: 390×844.

## Cobertura de aceptación

- Clic y teclado producen la misma transición.
- Back recorre el historial visitado, también después de recarga.
- Las respuestas repetidas permanecen disponibles.
- Evidencia oculta hasta que se abre.
- Registro inesperado: búsqueda, cierre, override, `@return` y `@end`.
- Terminal visible antes de Finalizar llamada.
- Descarga de registro analizada como JSON válido.
- Sustitución del mismo `script_id` con hash distinto requiere confirmación.
- Sin scroll de documento en escritorio; seis botones de al menos 86 px visibles.
- División vertical dentro de los rangos 50/50 exigidos.
- Móvil sin scroll horizontal, una columna y utilidades visibles.
- Texto caller de hasta 1.200 caracteres contenido en su zona sin invadir respuestas.
- Cierre del guion activo con eliminación de la sesión guardada.

Los resultados detallados están en `reports/vitest-results.json`, `reports/playwright-results.json` y `reports/playwright/`.
