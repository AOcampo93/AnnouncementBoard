/* ============================================================
   Servidor de desenvolvimento — Quadro de Avisos
   Implementa o contrato que o frontend espera, em memória, para
   se poder trabalhar sem o backend real levantado.
   NÃO é para produção: sem base de dados, sem palavras-passe.

   node tools/mock-api.js [porta]      (por omissão 8765)
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');
const UPLOADS = path.join(__dirname, 'uploads');
const PORTA = Number(process.argv[2]) || 8765;

fs.mkdirSync(UPLOADS, { recursive: true });

/* ---------- dados em memória ---------- */

const semente = JSON.parse(fs.readFileSync(path.join(__dirname, 'semente.json'), 'utf8'));

const UTILIZADORES = {
  'marta.soares':    { nome: 'Irmã Marta Soares',    board: 'socorro',   papel: 'admin' },
  'daniel.ferreira': { nome: 'Irmão Daniel Ferreira', board: 'elderes',  papel: 'responsavel' },
  'silvia.horta':    { nome: 'Irmã Sílvia Horta',    board: 'primaria',  papel: 'responsavel' }
};

let avisos = JSON.parse(JSON.stringify(semente.avisos));
const quadros = semente.quadros;
const lidos = {};                    // utilizador -> Set de ids
const sessoes = {};                  // token -> utilizador

function repor() {
  avisos = JSON.parse(JSON.stringify(semente.avisos));
  Object.keys(lidos).forEach((k) => delete lidos[k]);
  api.lixo = [];
}

/* ---------- utilitários ---------- */

const json = (res, estado, corpo) => {
  const texto = corpo === null ? '' : JSON.stringify(corpo);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(texto);
};

const erro = (res, estado, codigo, mensagem, campos) =>
  json(res, estado, { erro: { codigo, mensagem, campos: campos || null } });

function corpoDe(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on('data', (c) => partes.push(c));
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

function utilizadorDe(req) {
  const cab = req.headers.authorization || '';
  const token = cab.replace(/^Bearer\s+/i, '').trim();
  return token && sessoes[token] ? { id: sessoes[token], token } : null;
}

/* Prepara o aviso para este leitor: marca o que está por ler e o que pode mexer. */
function paraLeitor(p, quem) {
  const meus = quem ? (lidos[quem.id] || (lidos[quem.id] = new Set())) : null;
  const perfil = quem ? UTILIZADORES[quem.id] : null;
  const admin = perfil && perfil.papel === 'admin';
  const proprio = quem && p.autorId === quem.id;
  return Object.assign({}, p, {
    porLer: quem ? !meus.has(p.id) && !!p.isNew : !!p.isNew,
    podeEditar: !!(proprio || admin),
    podeEliminar: !!(proprio || admin)
  });
}

/* Extrai o primeiro ficheiro de um corpo multipart. Mínimo mas suficiente. */
function ficheiroDeMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return null;
  const limite = Buffer.from('--' + (m[1] || m[2]).trim());
  let i = buf.indexOf(limite);
  if (i < 0) return null;
  i += limite.length;
  const fimCabecalhos = buf.indexOf('\r\n\r\n', i);
  if (fimCabecalhos < 0) return null;
  const cabecalhos = buf.slice(i, fimCabecalhos).toString('latin1');
  const nomeM = /filename="([^"]*)"/i.exec(cabecalhos);
  const tipoM = /Content-Type:\s*([^\r\n]+)/i.exec(cabecalhos);
  const inicio = fimCabecalhos + 4;
  const fim = buf.indexOf(limite, inicio);
  if (fim < 0) return null;
  return {
    nome: (nomeM && nomeM[1]) || 'ficheiro',
    tipo: (tipoM && tipoM[1].trim()) || 'application/octet-stream',
    dados: buf.slice(inicio, fim - 2)          // tira o \r\n antes do limite
  };
}

const emKB = (n) => (n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

/* ---------- estáticos ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2'
};

function servirEstatico(req, res, caminho) {
  let alvo = caminho === '/' ? '/index.html' : caminho;
  const base = alvo.startsWith('/uploads/') ? __dirname : RAIZ;
  const ficheiro = path.normalize(path.join(base, decodeURIComponent(alvo)));
  if (!ficheiro.startsWith(base)) { res.writeHead(403); res.end(); return; }
  fs.readFile(ficheiro, (err, dados) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(ficheiro)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}

/* ---------- encaminhamento da API ---------- */

async function api(req, res, caminho, params) {
  const metodo = req.method;
  const quem = utilizadorDe(req);
  const exigeSessao = () => {
    if (!quem) { erro(res, 401, 'autenticacao', 'Sessão não iniciada.'); return false; }
    return true;
  };

  /* ----- sessão ----- */
  if (caminho === '/sessao') {
    if (metodo === 'GET') {
      if (!exigeSessao()) return;
      const perfil = UTILIZADORES[quem.id];
      return json(res, 200, {
        utilizador: quem.id, nome: perfil.nome, board: perfil.board, papel: perfil.papel,
        papelLegivel: perfil.papel === 'admin' ? 'Pode publicar em todos os quadros' : 'Responsável · ' + (quadros.find((q) => q.id === perfil.board) || {}).name,
        quadrosPermitidos: perfil.papel === 'admin' ? quadros.map((q) => q.id) : [perfil.board]
      });
    }
    if (metodo === 'POST') {
      const corpo = JSON.parse((await corpoDe(req)).toString() || '{}');
      const u = String(corpo.utilizador || '').trim().toLowerCase();
      if (!u || !String(corpo.palavra || '')) {
        return erro(res, 422, 'validacao', 'Preencha o utilizador e a palavra-passe.');
      }
      if (!UTILIZADORES[u]) return erro(res, 401, 'autenticacao', 'Utilizador ou palavra-passe errados.');
      const token = crypto.randomBytes(24).toString('hex');
      sessoes[token] = u;
      const perfil = UTILIZADORES[u];
      return json(res, 200, {
        token, utilizador: u, nome: perfil.nome, board: perfil.board, papel: perfil.papel,
        papelLegivel: perfil.papel === 'admin' ? 'Pode publicar em todos os quadros' : 'Responsável · ' + (quadros.find((q) => q.id === perfil.board) || {}).name,
        quadrosPermitidos: perfil.papel === 'admin' ? quadros.map((q) => q.id) : [perfil.board]
      });
    }
    if (metodo === 'DELETE') {
      if (quem) delete sessoes[quem.token];
      return json(res, 204, null);
    }
  }

  /* ----- quadros ----- */
  if (caminho === '/quadros' && metodo === 'GET') {
    return json(res, 200, quadros.map((q) => {
      const lista = avisos.filter((p) => (p.boards || []).includes(q.id));
      return Object.assign({}, q, {
        total: lista.length,
        porLer: lista.filter((p) => paraLeitor(p, quem).porLer).length
      });
    }));
  }

  /* ----- avisos ----- */
  if (caminho === '/avisos' && metodo === 'GET') {
    let lista = avisos.slice();
    if (params.quadro) lista = lista.filter((p) => (p.boards || []).includes(params.quadro));
    if (params.tipo) lista = lista.filter((p) => p.kind === params.tipo);
    if (params.q) {
      const t = params.q.toLowerCase();
      lista = lista.filter((p) => (p.title + ' ' + p.summary + ' ' + p.kind).toLowerCase().includes(t));
    }
    lista.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return json(res, 200, { avisos: lista.map((p) => paraLeitor(p, quem)), total: lista.length });
  }

  if (caminho === '/avisos' && metodo === 'POST') {
    if (!exigeSessao()) return;
    const corpo = JSON.parse((await corpoDe(req)).toString() || '{}');
    const campos = {};
    if (!String(corpo.title || '').trim()) campos.title = 'O título é obrigatório.';
    if (!Array.isArray(corpo.boards) || !corpo.boards.length) campos.boards = 'Escolha pelo menos um quadro.';
    if (Object.keys(campos).length) return erro(res, 422, 'validacao', 'Há dados por corrigir.', campos);

    const perfil = UTILIZADORES[quem.id];
    const permitidos = perfil.papel === 'admin' ? quadros.map((q) => q.id) : [perfil.board];
    if (corpo.boards.some((b) => !permitidos.includes(b))) {
      return erro(res, 403, 'permissao', 'Não tem permissão para publicar num desses quadros.');
    }

    const novo = Object.assign({}, corpo, {
      id: 'a' + crypto.randomBytes(6).toString('hex'),
      ts: Date.now(),
      isNew: false,
      autorId: quem.id,
      author: perfil.nome,
      authorRole: (quadros.find((q) => q.id === corpo.boards[0]) || {}).name || ''
    });
    avisos.unshift(novo);
    return json(res, 201, paraLeitor(novo, quem));
  }

  if (caminho === '/avisos/lidos' && metodo === 'POST') {
    if (!exigeSessao()) return;
    const meus = lidos[quem.id] || (lidos[quem.id] = new Set());
    avisos.forEach((p) => meus.add(p.id));
    return json(res, 204, null);
  }

  let m = /^\/avisos\/([\w-]+)$/.exec(caminho);
  if (m) {
    const i = avisos.findIndex((p) => p.id === m[1]);
    if (i < 0) return erro(res, 404, 'nao-encontrado', 'Este aviso já não existe.');
    const p = avisos[i];

    if (metodo === 'GET') return json(res, 200, paraLeitor(p, quem));

    if (!exigeSessao()) return;
    const perfil = UTILIZADORES[quem.id];
    const pode = p.autorId === quem.id || perfil.papel === 'admin';
    if (!pode) return erro(res, 403, 'permissao', 'Este aviso não é seu.');

    if (metodo === 'PATCH') {
      const patch = JSON.parse((await corpoDe(req)).toString() || '{}');
      if (patch.title !== undefined && !String(patch.title).trim()) {
        return erro(res, 422, 'validacao', 'Há dados por corrigir.', { title: 'O título é obrigatório.' });
      }
      avisos[i] = Object.assign({}, p, patch, { id: p.id, autorId: p.autorId, ts: p.ts });
      return json(res, 200, paraLeitor(avisos[i], quem));
    }

    if (metodo === 'DELETE') {
      p.eliminadoEm = Date.now();                 // eliminação suave, para dar «Anular»
      avisos.splice(i, 1);
      (api.lixo = api.lixo || []).push(p);
      return json(res, 204, null);
    }
  }

  m = /^\/avisos\/([\w-]+)\/lido$/.exec(caminho);
  if (m && metodo === 'POST') {
    if (!exigeSessao()) return;
    (lidos[quem.id] || (lidos[quem.id] = new Set())).add(m[1]);
    return json(res, 204, null);
  }

  m = /^\/avisos\/([\w-]+)\/restaurar$/.exec(caminho);
  if (m && metodo === 'POST') {
    if (!exigeSessao()) return;
    const lixo = api.lixo || [];
    const k = lixo.findIndex((p) => p.id === m[1]);
    if (k < 0) return erro(res, 404, 'nao-encontrado', 'Já não é possível repor este aviso.');
    const p = lixo.splice(k, 1)[0];
    delete p.eliminadoEm;
    avisos.unshift(p);
    avisos.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return json(res, 200, paraLeitor(p, quem));
  }

  /* ----- ficheiros ----- */
  if (caminho === '/ficheiros' && metodo === 'POST') {
    if (!exigeSessao()) return;
    const buf = await corpoDe(req);
    const f = ficheiroDeMultipart(buf, req.headers['content-type']);
    if (!f) return erro(res, 422, 'validacao', 'Não veio nenhum ficheiro.');
    const ext = path.extname(f.nome) || (f.tipo.includes('pdf') ? '.pdf' : '.jpg');
    const nomeDisco = crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOADS, nomeDisco), f.dados);
    return json(res, 201, {
      url: '/uploads/' + nomeDisco,
      nome: f.nome,
      tamanho: emKB(f.dados.length)
    });
  }

  /* ----- só para desenvolvimento ----- */
  if (caminho === '/repor' && metodo === 'POST') { repor(); return json(res, 204, null); }

  erro(res, 404, 'nao-encontrado', 'Não existe esse endereço na API.');
}

/* ---------- servidor ---------- */

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, null);

  const url = new URL(req.url, 'http://localhost');
  const params = Object.fromEntries(url.searchParams.entries());

  if (url.pathname.startsWith('/api/')) {
    try {
      await api(req, res, url.pathname.slice(4), params);
    } catch (err) {
      erro(res, 500, 'servidor', 'O servidor de desenvolvimento rebentou: ' + err.message);
    }
    return;
  }

  servirEstatico(req, res, url.pathname);
}).listen(PORTA, '127.0.0.1', () => {
  console.log(`Quadro de Avisos — servidor de desenvolvimento`);
  console.log(`  frontend  http://127.0.0.1:${PORTA}/`);
  console.log(`  API       http://127.0.0.1:${PORTA}/api`);
  console.log(`  contas    ${Object.keys(UTILIZADORES).join(', ')}  (qualquer palavra-passe)`);
});
