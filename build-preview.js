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
  ['config','datas','data','api','store','app','pwa'].map(n => `<script src="assets/js/${n}.js"></script>`).join('\n'),
  () => ['config','datas','data','api','store','app','pwa'].map(n => '<script>\n' + read(`assets/js/${n}.js`) + '\n</script>').join('\n')
);

fs.writeFileSync(out, html);
console.log('->', out, (html.length / 1024).toFixed(1) + ' KB');
