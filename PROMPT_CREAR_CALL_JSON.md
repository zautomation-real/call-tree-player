# Prompt público para crear un `.call.json`

Este es el generador público y genérico de archivos compatibles con **[Call Tree Player](https://zautomation-real.github.io/call-tree-player/)**.

```text
Actúa como arquitecto de guiones de llamada y genera un archivo `.call.json` compatible con Call Tree Player.

OBJETIVO
Construye un árbol conversacional breve y utilizable durante una llamada real. Cada nodo debe ayudar a escuchar, clasificar la respuesta y elegir el siguiente movimiento. No escribas un artículo ni dupliques el árbol por idioma.

DATOS DE LA LLAMADA
- Tipo de llamada: [primera llamada / seguimiento / descubrimiento / negociación / otra]
- Mi nombre y empresa: [dato real]
- Empresa o persona llamada: [dato real]
- Contacto conocido: [nombre y cargo, o DESCONOCIDO]
- Teléfono: [dato o vacío]
- Modo de idioma: [BILINGÜE ES+CA / MONOLINGÜE ES / MONOLINGÜE CA]
- Idioma predeterminado: [es / ca]
- Qué ofrezco: [servicio o propuesta]
- Hallazgo o razón concreta del contacto: [hecho observado y verificable]
- Fuente del hallazgo: [URL, documento o explicación]
- Consecuencia defendible sin especular: [consecuencia concreta]
- Objetivo único de la llamada: [uno]
- Siguiente paso deseado: [uno]
- Objeciones previsibles: [lista]
- Afirmaciones, precios o condiciones confirmados: [lista]
- Afirmaciones que no deben hacerse: [lista]
- Límites de contacto o permisos existentes: [lista o NINGUNO]

REGLAS CONVERSACIONALES
1. No inventes nombres, cargos, clientes, resultados, precios, urgencia, disponibilidad, causas técnicas ni pérdidas económicas.
2. Si falta un dato necesario, formula una pregunta para confirmarlo durante la llamada; no lo completes por intuición.
3. La apertura contiene identidad breve, una sola razón concreta y una petición corta de permiso.
4. Usa un único hallazgo principal y una sola pregunta por nodo.
5. Muestra entre 2 y 4 respuestas visibles y conserva solo las reacciones que cambian la intervención siguiente.
6. Una intervención ordinaria no supera 260 caracteres; una explicación técnica puede llegar a 320 si contiene una sola idea.
7. La ruta principal no supera 8 elecciones.
8. No crees ciclos ni reabras la venta después de un rechazo cerrado o una petición de no contacto.
9. Separa los permisos para enviar evidencia, información comercial, presupuesto o concertar una reunión.
10. No interpretes silencio, corte o falta de respuesta como rechazo.
11. Termina cada ruta con un resultado claro y un único siguiente paso.
12. Los textos terminales deben ser frases naturales que puedan pronunciarse; no incluyas instrucciones internas en `say`.

CONTRATO DE IDIOMA
- Usa exactamente `"default_language": "es"` o `"default_language": "ca"`, según los datos.
- En modo BILINGÜE ES+CA, todo texto localizable debe ser un objeto con ambas claves: `{"es":"Texto español","ca":"Text català"}`.
- Son textos localizables: `outcomes[].label`, `nodes[].say`, `nodes[].responses[].label`, `nodes[].evidence[].title` y `nodes[].evidence[].text` cuando exista.
- Las versiones `es` y `ca` expresan la misma intención y los mismos hechos. No cambies preguntas, permisos, oferta ni compromiso entre idiomas.
- El árbol bilingüe tiene un único conjunto de IDs. No dupliques nodos, respuestas, destinos, rutas inesperadas ni outcomes por idioma.
- No inventes una traducción ausente ni dejes una clave vacía. Si no puedes producir una versión fiel, pregunta antes de generar el archivo.
- En modo MONOLINGÜE, los textos localizables pueden seguir siendo cadenas simples. El archivo conserva `default_language` y continúa siendo válido.

CONTRATO JSON OBLIGATORIO
- Devuelve JSON puro: sin Markdown, comentarios ni texto antes o después.
- Usa exactamente `"schema_version": "1.0.0"`.
- La raíz solo puede contener: `schema_version`, `default_language`, `script_id`, `title`, `company`, `start_node`, `outcomes`, `unexpected_routes` (opcional) y `nodes`.
- `script_id`, IDs de nodo, respuesta y resultado usan únicamente letras ASCII, números, punto, guion o guion bajo; empiezan por letra o número y son únicos en su ámbito.
- `company` requiere `name` y puede incluir `contact_name`, `contact_role` y `phone`.
- `outcomes` contiene entre 1 y 30 objetos con `id` y `label`.
- Nodo de decisión: `{"id":"...","say":TEXTO,"responses":[...]}`.
- Nodo terminal: `{"id":"...","say":TEXTO,"terminal":{"outcome":"..."}}`.
- Una respuesta es `{"id":"...","label":TEXTO,"next":"...","tone":"..."}`.
- `tone` solo puede ser `neutral`, `advance`, `clarify`, `objection`, `handoff` o `close`.
- Cualquier nodo puede incluir `evidence`, con un máximo de 5 objetos. Cada objeto requiere `title` y puede incluir `text`, `url` e `image_url`. Usa solo URLs completas y datos reales.
- Cada nodo de decisión tiene entre 2 y 6 respuestas; aplica 2 a 4 salvo necesidad excepcional.
- Todo `next`, `start_node` y `terminal.outcome` apunta a un ID existente.
- Todos los nodos son alcanzables desde `start_node` o desde un destino de `unexpected_routes`.
- No uses HTML ni propiedades adicionales.

CONTROL FINAL
Comprueba antes de responder:
1. JSON sintácticamente válido;
2. IDs, destinos y outcomes existentes y únicos;
3. nodos alcanzables y ausencia de ciclos;
4. permisos y límites respetados;
5. un solo hallazgo y una pregunta por nodo;
6. ruta principal de 8 elecciones como máximo;
7. ningún hecho inventado;
8. en modo bilingüe, cada texto localizable contiene `es` y `ca` y ambos recorren exactamente el mismo grafo.

Si los datos bastan, devuelve directamente JSON puro. Si falta información imprescindible, formula primero un máximo de 5 preguntas concretas y espera las respuestas.
```
