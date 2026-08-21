/* Empaqueta index.html + css + js en un solo archivo autocontenido.
   Uso: node build-preview.js [salida.html]  */
const fs = require('fs'), path = require('path');

const root = __dirname;
const out = process.argv[2] || path.join(root, 'preview.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/* El reemplazo debe ser una funcion: con una cadena, "$$" y "$&" se interpretan
   como patrones de sustitucion y el codigo llega mutilado al bundle. */
html = html.replace(
  '<link rel="stylesheet" href="assets/css/app.css">',
  () => '<style>\n' + read('assets/css/app.css') + '\n</style>'
);
html = html.replace(
  '<script src="assets/js/data.js"></script>\n<script src="assets/js/store.js"></script>\n<script src="assets/js/app.js"></script>',
  () => '<script>\n' + read('assets/js/data.js') + '\n</script>\n<script>\n' + read('assets/js/store.js') + '\n</script>\n<script>\n' + read('assets/js/app.js') + '\n</script>'
);

fs.writeFileSync(out, html);
console.log('->', out, (html.length / 1024).toFixed(1) + ' KB');
