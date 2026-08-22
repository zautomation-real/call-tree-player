# Prompt para crear un buen `.call.json`

Copia el bloque completo en ChatGPT, Claude u otro modelo capaz de generar JSON. Sustituye los datos entre corchetes por la información real de tu llamada.

Cuando recibas el resultado, guárdalo como `nombre-del-guion.call.json` y cárgalo en **[Call Tree Player](https://zautomation-real.github.io/call-tree-player/)**.

```text
Quiero que actúes como arquitecto de guiones de llamada y generes un archivo compatible con Call Tree Player.

OBJETIVO
Construye un árbol conversacional breve, útil durante una llamada real y adaptado a los datos que te proporciono. No escribas un artículo ni un guion lineal. Cada nodo debe ayudarme a escuchar, clasificar la respuesta y elegir el siguiente movimiento.

DATOS DE LA LLAMADA
- Tipo de llamada: [primera llamada / seguimiento / descubrimiento / negociación / otra]
- Mi nombre y empresa: [dato real]
- Empresa o persona llamada: [dato real]
- Contacto conocido: [nombre y cargo, o DESCONOCIDO]
- Teléfono: [dato o vacío]
- Idioma: [castellano / catalán / otro]
- Qué ofrezco: [servicio o propuesta]
- Hallazgo o razón concreta del contacto: [hecho observado y verificable]
- Fuente del hallazgo: [URL, documento o explicación]
- Consecuencia que puedo defender sin especular: [consecuencia concreta]
- Objetivo único de esta llamada: [localizar al responsable, confirmar un dato, autorizar un envío, agendar una revisión, solicitar presupuesto u otro]
- Siguiente paso deseado: [uno solo]
- Objeciones previsibles: [lista]
- Afirmaciones, precios o condiciones que sí están confirmados: [lista]
- Afirmaciones que no deben hacerse: [lista]
- Límites de contacto o permisos existentes: [lista o NINGUNO]

REGLAS COMERCIALES
1. No inventes nombres, cargos, clientes, resultados, precios, urgencia, disponibilidad, causas técnicas ni pérdidas económicas.
2. Si falta un dato necesario, utiliza una formulación que permita confirmarlo durante la llamada; no lo completes por intuición.
3. La apertura debe contener identidad breve, una sola razón concreta y una petición corta de permiso. No acumules varios diagnósticos.
4. Si hay recepción: con persona conocida, pide por ella y explica solo lo necesario para que transfieran; con responsable desconocido, pregunta quién controla el asunto relacionado con el hallazgo.
5. Usa un único hallazgo principal. Mantén cualquier hallazgo secundario fuera de la ruta principal.
6. Una intervención ordinaria no debe superar 260 caracteres. Una explicación técnica puede llegar a 320 si contiene una sola idea.
7. Haz una sola pregunta por nodo y ofrece entre 2 y 4 respuestas visibles.
8. La ruta principal desde el decisor hasta un resultado debe requerir como máximo 8 elecciones.
9. No crees ciclos. No vuelvas a descubrimiento después de confirmar: corrección aceptada, comportamiento deliberado, proveedor trabajando, falta de interés o petición de no contacto.
10. Separa la primera llamada de una negociación o cierre posterior. No fuerces precio ni reunión si la conversación solo permite entregar evidencia o localizar al responsable.
11. Solicita por separado permiso para enviar evidencia y permiso para enviar portfolio, web comercial u otra información promocional.
12. No interpretes silencio, corte o falta de respuesta como rechazo.
13. Incluye rutas breves para: persona ausente, responsable desconocido, proveedor existente, comportamiento deliberado, falta de tiempo, petición de información, falta de interés y no volver a contactar.
14. Cada ruta debe terminar en un resultado claro y en un solo siguiente paso: enviar evidencia, localizar al decisor, revisión delimitada, preparar alcance/precio, seguimiento fechado o cierre.
15. Si la otra persona pide no recibir más llamadas, termina la ruta sin reabrir la venta.

CONTRATO JSON OBLIGATORIO
- Devuelve JSON puro. No uses Markdown, comentarios ni texto antes o después.
- Usa exactamente `"schema_version": "1.0.0"`.
- La raíz solo puede contener: `schema_version`, `script_id`, `title`, `company`, `start_node`, `outcomes`, `unexpected_routes` (opcional) y `nodes`.
- `script_id`, IDs de nodo, IDs de respuesta e IDs de resultado deben usar únicamente letras ASCII, números, punto, guion o guion bajo. Deben empezar por letra o número y ser únicos en su ámbito.
- `company` requiere `name` y puede incluir `contact_name`, `contact_role` y `phone`.
- `outcomes` debe contener entre 1 y 30 objetos con `id` y `label`.
- Cada nodo debe adoptar exactamente una forma:
  A) Nodo de decisión: `{"id":"...","say":"...","responses":[...]}`
  B) Nodo terminal: `{"id":"...","say":"...","terminal":{"outcome":"..."}}`
- Cualquier nodo puede incluir opcionalmente `evidence`, con un máximo de 5 elementos. Cada elemento requiere `title` y puede incluir `text`, `url` e `image_url`. Usa solo URLs completas y datos reales proporcionados por mí.
- Cada respuesta debe ser `{"id":"...","label":"...","next":"...","tone":"..."}`.
- `tone` solo puede ser: `neutral`, `advance`, `clarify`, `objection`, `handoff` o `close`.
- Todo `next` debe apuntar a un nodo existente.
- Todo `terminal.outcome` debe apuntar a un resultado existente.
- Cada nodo de decisión debe tener entre 2 y 6 respuestas; aplica el límite comercial de 2 a 4 salvo necesidad excepcional.
- Todos los nodos deben ser alcanzables desde `start_node`.
- No uses HTML dentro de ningún texto.
- No añadas propiedades distintas de las indicadas.

CONTROL FINAL ANTES DE RESPONDER
Comprueba internamente que:
1. el JSON es sintácticamente válido;
2. todos los IDs y destinos existen y son únicos;
3. todos los resultados terminales están declarados;
4. todos los nodos son alcanzables;
5. no existen ciclos;
6. ninguna ruta vulnera los permisos indicados;
7. la apertura usa un solo hallazgo;
8. cada nodo contiene una sola pregunta;
9. la ruta principal no supera 8 elecciones;
10. no has inventado ningún hecho.

Si los datos son suficientes, devuelve directamente el JSON puro. Si falta información imprescindible para construir rutas veraces, haz primero un máximo de 5 preguntas concretas y espera mis respuestas antes de generar el archivo.
```

Después de guardarlo, **[abre Call Tree Player y carga el archivo](https://zautomation-real.github.io/call-tree-player/)**.
