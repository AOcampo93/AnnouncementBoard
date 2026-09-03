/* ============================================================
   Quadro de Avisos — camada de vista
   Sem dependências. Encaminhamento por hash sobre a History API,
   estado durável no Arquivo (store.js).
   ============================================================ */

/* ---------- Estado de ecrã (o que não precisa de sobreviver a um F5) ---------- */

const estado = {
  ecra: 'feed',
  boardId: 'ala',
  postId: null,
  seccao: 'feed',        // secção da barra de navegação em destaque
  query: '',
  filtro: null,          // tipo de aviso em filtro
  ordem: 'recentes',
  blocks: [],            // ordem das partes no formulário
  valores: {},           // conteúdo escrito, por parte
  editingId: null,
  mode: 'mine',
  picked: [],
  camada: null,          // sobreposição aberta
  eliminado: null,       // último aviso eliminado, para anular
  aEnviar: false,        // há um pedido de escrita em voo
  contas: null,          // lista de contas, carregada a pedido
  contaId: null,         // conta em edição
  forma: {}              // valores do formulário de conta
};

/* ---------- Utilitários ---------- */

const $  = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ico = (nome, cls = 'ico') =>
  `<svg class="${cls}" aria-hidden="true"><use href="#i-${nome}"></use></svg>`;

const plural = (n, um, muitos) => n + ' ' + (n === 1 ? um : muitos);

/* «https://www.churchofjesuschrist.org/study?lang=…» -> «churchofjesuschrist.org» */
function dominioDe(url) {
  try {
    return new URL(String(url).trim()).hostname.replace(/^www\./, '');
  } catch (err) {
    return String(url || '').replace(/^https?:\/\//, '').split('/')[0].slice(0, 40);
  }
}

const quadro = (id) => BOARDS.find((b) => b.id === id) || null;
const nomeQuadro = (id) => (quadro(id) || {}).name || '';

const sessao = () => Arquivo.sessao();
const temSessao = () => !!Arquivo.sessao();
const ehBispado    = () => Arquivo.papel() === 'bispado';
const podePublicar = () => Arquivo.podePublicar();
const podeGerirContas = () => Arquivo.podeGerirContas();

/* Quem já leu o quê é do servidor: vem marcado em cada aviso. */
const porLer = (p) => Arquivo.porLer(p);

/* Etiqueta dos quadros de um aviso: um nome, ou o primeiro mais a contagem. */
function etiquetaQuadros(p) {
  const ids = p.boards || [];
  if (!ids.length) return '';
  if (ids.length === 1) return nomeQuadro(ids[0]);
  return nomeQuadro(ids[0]) + ' +' + (ids.length - 1);
}

const agoraLegivel = () => Datas.agoraLegivel();

/* Uma imagem carregada pelo utilizador desenha-se a sério; a da semente
   continua a ser o marcador tramado do desenho original. */
function imagem(obj, classe, alt) {
  const fonte = obj && (obj.url || obj.dataUrl);
  if (fonte) {
    return `<img class="${classe} img" src="${esc(fonte)}" alt="${esc(alt || obj.legenda || '')}" loading="lazy">`;
  }
  const legenda = obj ? (obj.legenda || '') + (obj.medidas ? ' · ' + obj.medidas : '') : '';
  return `<span class="ph ${classe}">${esc(legenda)}</span>`;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (err) {
    try {
      const t = document.createElement('textarea');
      t.value = texto;
      t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch (err2) { return false; }
  }
}

/* ---------- Mensagens (sobrevivem à mudança de ecrã) ---------- */

let relogioAviso = null;

function aviso(texto, accao) {
  const caixa = $('#toast');
  caixa.innerHTML = `
    <span class="toast__texto">${esc(texto)}</span>
    ${accao ? `<button class="toast__accao" data-act="${accao.act}"${accao.id ? ` data-id="${accao.id}"` : ''}>${esc(accao.etiqueta)}</button>` : ''}
    <button class="toast__fechar" data-act="fechar-aviso" aria-label="Fechar mensagem">${ico('close')}</button>`;
  caixa.hidden = false;
  clearTimeout(relogioAviso);
  relogioAviso = setTimeout(limparAviso, accao ? 6000 : 3400);
}

function limparAviso() {
  clearTimeout(relogioAviso);
  const caixa = $('#toast');
  caixa.hidden = true;
  caixa.innerHTML = '';
}

/* ---------- Encaminhamento ---------- */

const ROTAS = [
  { re: /^$/,                        ecra: 'feed' },
  { re: /^\/$/,                      ecra: 'feed' },
  { re: /^\/novidades$/,             ecra: 'feed' },
  { re: /^\/quadros$/,               ecra: 'boards' },
  { re: /^\/quadro\/([\w-]+)$/,      ecra: 'board',  chave: 'boardId' },
  { re: /^\/aviso\/([\w-]+)$/,       ecra: 'post',   chave: 'postId' },
  { re: /^\/procurar$/,              ecra: 'search' },
  { re: /^\/entrar$/,                ecra: 'login' },
  { re: /^\/publicar$/,              ecra: 'compose' },
  { re: /^\/publicar\/destino$/,     ecra: 'targets' },
  { re: /^\/editar\/([\w-]+)$/,      ecra: 'compose', chave: 'editId' },
  { re: /^\/a-minha-conta$/,         ecra: 'mine' },
  { re: /^\/palavra-passe$/,         ecra: 'palavra' },
  { re: /^\/contas$/,                ecra: 'contas' },
  { re: /^\/contas\/nova$/,          ecra: 'conta' },
  { re: /^\/contas\/(\d+)$/,         ecra: 'conta', chave: 'contaId' },
  { re: /^\/lugares$/,               ecra: 'lugares' },
  { re: /^\/gerir-quadros$/,         ecra: 'gerirQuadros' }
];

const PRIVADAS = ['compose', 'targets', 'mine', 'palavra', 'contas', 'conta', 'lugares', 'gerirQuadros'];

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let indice = (history.state && history.state.i) || 0;
let veioDeVoltar = false;
let aFecharCamada = false;

function guardarPosicao() {
  try {
    history.replaceState(Object.assign({}, history.state, { i: indice, y: window.scrollY }), '');
  } catch (err) { /* sem history */ }
}

function ir(hash) {
  limparAviso();
  if (location.hash === hash) { encaminhar(); return; }
  guardarPosicao();
  indice += 1;
  history.pushState({ i: indice, y: 0 }, '', hash);
  encaminhar();
}

/* Reencaminhamento automático: substitui, nunca empurra, para o botão
   «voltar» do navegador não ficar preso num ciclo. */
function substituir(hash) {
  history.replaceState({ i: indice, y: 0 }, '', hash);
  encaminhar();
}

/* Volta a sério: se há para onde recuar, recua; senão vai ao pai indicado. */
function voltar(reserva) {
  if (indice > 0) { guardarPosicao(); history.back(); return; }
  substituir(reserva || '#/novidades');
}

function partesDoHash() {
  const cru = (location.hash || '').replace(/^#/, '');
  const [caminho, consulta] = cru.split('?');
  const params = {};
  (consulta || '').split('&').filter(Boolean).forEach((par) => {
    const [k, v] = par.split('=');
    params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  // tolerar barra final
  return { caminho: caminho.replace(/\/+$/, '') || '/', params: params };
}

function encaminhar() {
  const { caminho, params } = partesDoHash();

  let achado = null;
  for (const r of ROTAS) {
    const m = caminho.match(r.re);
    if (m) { achado = { ecra: r.ecra, chave: r.chave, valor: m[1] }; break; }
  }

  // Rota desconhecida: corrige o endereço em vez de fingir que é o feed.
  if (!achado) { substituir('#/novidades'); return; }

  let ecra = achado.ecra;

  if (achado.chave === 'boardId') {
    if (!quadro(achado.valor)) { estado.ecra = 'perdido'; estado.perdido = 'quadro'; desenhar(); return; }
    estado.boardId = achado.valor;
  }
  if (achado.chave === 'postId') {
    if (!Arquivo.aviso(achado.valor)) { estado.ecra = 'perdido'; estado.perdido = 'aviso'; desenhar(); return; }
    estado.postId = achado.valor;
  }
  if (achado.chave === 'contaId') estado.contaId = Number(achado.valor);
  else if (ecra === 'conta') estado.contaId = null;

  if (achado.chave === 'editId') {
    const alvo = Arquivo.aviso(achado.valor);
    if (!alvo) { estado.ecra = 'perdido'; estado.perdido = 'aviso'; desenhar(); return; }
    if (estado.editingId !== alvo.id) carregarParaEdicao(alvo);
  }

  // Guardião das rotas privadas: reencaminha a sério e guarda a intenção.
  if (PRIVADAS.indexOf(ecra) > -1 && !temSessao()) {
    substituir('#/entrar?destino=' + encodeURIComponent(location.hash || '#/a-minha-conta'));
    return;
  }
  // Com sessão, o ecrã de entrada não tem razão de ser.
  if (ecra === 'login' && temSessao()) {
    substituir(params.destino || '#/a-minha-conta');
    return;
  }
  // Gerir contas é exclusivo do bispado.
  if (['contas', 'conta', 'lugares', 'gerirQuadros'].indexOf(ecra) > -1 && temSessao() && !podeGerirContas()) {
    substituir('#/a-minha-conta');
    aviso('Só o bispado pode gerir contas.');
    return;
  }

  // Não se escolhe destino sem haver aviso nenhum para publicar.
  if (ecra === 'targets' && !estado.blocks.length) {
    substituir('#/publicar');
    aviso('Adicione primeiro uma parte ao aviso.');
    return;
  }

  // Um quadro passado na consulta pré-escolhe o destino.
  if (ecra === 'compose' && params.quadro && quadro(params.quadro) && !estado.blocks.length) {
    estado.mode = 'pick';
    estado.picked = [params.quadro];
  }

  // Chegar a #/publicar por ligação direta tem de dar um formulário utilizável,
  // não uma folha sem um único campo.
  if (ecra === 'compose' && !estado.editingId && !estado.blocks.length) {
    estado.blocks = PARTES_DE_ORIGEM.slice();
  }

  estado.ecra = ecra;
  estado.destinoAposEntrar = params.destino || null;

  // A secção em destaque segue a origem: um aviso aberto pela procura
  // mantém «Procurar» marcado, não «Novidades».
  const mapa = {
    feed: 'feed', boards: 'boards', board: 'boards', search: 'search',
    login: 'mine', compose: 'mine', targets: 'mine', mine: 'mine',
    palavra: 'mine', contas: 'mine', conta: 'mine', lugares: 'mine',
    gerirQuadros: 'boards'
  };
  if (mapa[ecra]) estado.seccao = mapa[ecra];

  desenhar();
  prepararEcra();

  const y = veioDeVoltar && history.state && history.state.y;
  veioDeVoltar = false;
  window.scrollTo(0, y || 0);
}

/* Alguns ecrãs precisam de dados que não estão na cache principal.
   Pedem-se depois de desenhar, para o esqueleto aparecer já. */
async function prepararEcra() {
  desenharNotificacoes();
  activarMapas();

  if (estado.ecra === 'contas') {
    if (estado.contas !== null) return;
    try {
      estado.contas = await Arquivo.contas();
    } catch (err) {
      estado.contas = [];
      avisoDeErro(err, null);
    }
    if (estado.ecra === 'contas') desenhar();
    return;
  }

  if (estado.ecra === 'conta') {
    if (!estado.contaId) {
      estado.forma = { papel: 'presidencia', quadros: [], ativo: true };
      desenhar();
      return;
    }
    try {
      const lista = estado.contas || await Arquivo.contas();
      estado.contas = lista;
      const c = lista.find((x) => x.id === estado.contaId);
      if (!c) { substituir('#/contas'); aviso('Essa conta já não existe.'); return; }
      estado.forma = {
        utilizador: c.utilizador, nome: c.nome, papel: c.papel,
        quadros: (c.quadros || []).slice(), ativo: c.ativo
      };
      desenhar();
    } catch (err) {
      avisoDeErro(err, null);
    }
  }
}

window.addEventListener('popstate', (e) => {
  if (aFecharCamada) { aFecharCamada = false; return; }
  // Uma sobreposição aberta consome o primeiro «voltar».
  if (estado.camada && !(e.state && e.state.camada)) {
    estado.camada = null;
    desenharCamadas();
    return;
  }
  indice = (e.state && e.state.i) || 0;
  veioDeVoltar = true;
  encaminhar();
});

/* ---------- Sobreposições ---------- */

function abrirCamada(camada) {
  const jaAberta = !!estado.camada;
  estado.camada = camada;
  if (!jaAberta) {
    indice += 1;
    history.pushState({ i: indice, camada: camada.tipo }, '', location.hash);
  }
  desenharCamadas();
}

function fecharCamada(semRecuar) {
  if (!estado.camada) return;
  estado.camada = null;
  desenharCamadas();
  if (!(history.state && history.state.camada)) return;
  if (semRecuar) {
    // Quem fecha e navega a seguir não pode esperar pelo popstate:
    // reescreve-se a entrada em vez de recuar.
    history.replaceState({ i: indice }, '', location.hash);
    return;
  }
  aFecharCamada = true;
  indice = Math.max(0, indice - 1);
  history.back();
}

/* ---------- Navegação principal ---------- */

const NAV = [
  { id: 'feed',   etiqueta: 'Novidades',      hash: '#/novidades',     ico: 'feed' },
  { id: 'boards', etiqueta: 'Quadros',        hash: '#/quadros',       ico: 'folder' },
  { id: 'search', etiqueta: 'Procurar',       hash: '#/procurar',      ico: 'search' },
  { id: 'mine',   etiqueta: 'A minha conta', curto: 'Conta', hash: '#/a-minha-conta', ico: 'user',
    exigeSessao: true }
];

/* Quem só vem ler não precisa de conta nenhuma: a entrada fica fora do
   caminho e só aparece a quem já tem sessão. */
const navVisivel = () => NAV.filter((n) => !n.exigeSessao || temSessao());

const hashDaNav = (n) => n.hash;

/* ---------- Peças reutilizáveis ---------- */

function selo(p) {
  return porLer(p) ? '<span class="stamp">NOVO</span>' : '';
}

/* Quando e onde é aquilo que o aviso anuncia. Pode vir do bloco de data
   ou do lugar marcado no mapa; se não houver nada, não se inventa. */
function eventoDe(p) {
  const q = p.when || {};
  const mapa = (p.links || []).find((l) => l.type === 'map');
  const lugar = q.place || (mapa && ((mapa.destino && mapa.destino.titulo) || mapa.meta)) || '';
  if (!q.day && !q.time && !lugar) return null;
  return { dia: q.day || '', hora: q.time || '', lugar: lugar };
}

/* A tira que destaca o dia do acontecimento. É o que quase toda a gente
   procura no aviso, por isso vem antes de tudo menos do título. */
function tiraDoEvento(p) {
  const e = eventoDe(p);
  if (!e) return '';
  const quando = [e.dia, e.hora].filter(Boolean).join(' · ');
  return `
    <span class="quando-tira">
      ${quando ? `<span class="quando-tira__dia">${ico('calendar')}${esc(quando)}</span>` : ''}
      ${e.lugar ? `<span class="quando-tira__lugar">${ico('map')}${esc(e.lugar)}</span>` : ''}
    </span>`;
}

/* A data em que foi publicado é a menos importante das três: vai no fim
   e vai com a palavra que a explica, para não se confundir com o resto. */
function rodapeDePublicacao(p) {
  return `<span class="notice__publicado">Publicado ${esc(Datas.publicadoEm(p.ts))}</span>`;
}

function fichaAviso(p) {
  const heroi = p.hero;
  return `
    <button class="notice" data-act="abrir-aviso" data-id="${p.id}">
      <span class="notice__head">
        <span class="notice__board">${esc(etiquetaQuadros(p))}</span>
      </span>
      <span class="notice__body">
        <span class="notice__text">
          <span class="flags">
            <span class="tag">${esc(p.kind)}</span>
            ${selo(p)}
          </span>
          <span class="notice__title">${esc(p.title)}</span>
          ${tiraDoEvento(p)}
          <span class="notice__summary">${esc(p.summary)}</span>
        </span>
        ${heroi ? `<span class="notice__thumb-wrap">${imagem(heroi, 'notice__thumb', p.title)}</span>` : ''}
      </span>
      ${rodapeDePublicacao(p)}
    </button>`;
}

function barra(reserva, titulo, opcoes) {
  const o = opcoes || {};
  return `
    <div class="appbar">
      <button class="iconbtn" data-act="voltar" data-hash="${reserva}" aria-label="Voltar">${ico('back')}</button>
      <div class="${o.discreto ? 'appbar__kicker' : 'appbar__title'}">${titulo}</div>
      ${o.accoes || ''}
    </div>`;
}

function botaoCriar(quadroId) {
  // Sem sessão não se mostra nada: quem vem ler não tem de reparar que
  // existe uma porta de serviço.
  if (!temSessao()) return '';
  // Uma conta de leitura não tem onde publicar: mostrar o botão seria
  // prometer uma porta que dá para uma parede.
  if (!podePublicar()) return '';
  const destino = quadroId ? `#/publicar?quadro=${quadroId}` : '#/publicar';
  return `<button class="btn btn--solid btn--compacto" data-act="novo-aviso" data-hash="${destino}">${ico('plus')} Novo aviso</button>`;
}

/* Fila de filtros por tipo, com contagem. */
function filtros(lista) {
  const contas = {};
  lista.forEach((p) => { contas[p.kind] = (contas[p.kind] || 0) + 1; });
  const usados = TIPOS.filter((t) => contas[t]);
  if (usados.length < 2) return '';
  return `
    <div class="chips chips--filtro" role="group" aria-label="Filtrar por tipo">
      ${usados.map((t) => `
        <button class="chip chip--sm" data-act="filtro" data-tipo="${esc(t)}"
                aria-pressed="${estado.filtro === t}">${esc(t)} <span class="chip__n tnum">${contas[t]}</span></button>`).join('')}
      ${estado.filtro ? `<button class="chip chip--sm chip--limpar" data-act="filtro" data-tipo="">${ico('close')} Limpar</button>` : ''}
    </div>`;
}

const aplicarFiltro = (lista) => (estado.filtro ? lista.filter((p) => p.kind === estado.filtro) : lista);

function vazio(texto, botoes) {
  return `
    <div class="empty">
      <p class="empty__texto">${texto}</p>
      ${botoes ? `<div class="empty__accoes">${botoes}</div>` : ''}
    </div>`;
}

/* ---------- Ecrãs ---------- */

function ecraFeed() {
  const todos = Arquivo.avisos();
  const lista = aplicarFiltro(todos);
  const naoLidos = todos.filter(porLer).length;

  return `
    <div class="masthead">
      <div class="masthead__text">
        <p class="eyebrow">${esc(Datas.hojeLegivel())}</p>
        <h1 class="page-title" tabindex="-1">Novidades</h1>
        <p class="lede" aria-live="polite">
          ${naoLidos > 0
            ? `${plural(naoLidos, 'aviso por ler', 'avisos por ler')} nos ${BOARDS.length} quadros da ala`
            : `Está em dia. ${plural(todos.length, 'aviso', 'avisos')} nos ${BOARDS.length} quadros da ala`}
        </p>
      </div>
      <div class="masthead__actions">
        ${naoLidos > 0 ? `<button class="btn btn--quiet btn--compacto" data-act="ler-tudo">${ico('check')} Marcar tudo como lido</button>` : ''}
        ${botaoCriar(null)}
      </div>
    </div>
    <div class="wrap">
      ${filtros(todos)}
      <div class="stack grid-notices">
        ${lista.length
          ? lista.map(fichaAviso).join('')
          : vazio(
              estado.filtro
                ? `Não há avisos do tipo «${esc(estado.filtro)}».`
                : 'Ainda não há avisos em nenhum quadro.',
              estado.filtro
                ? '<button class="btn btn--kraft" data-act="filtro" data-tipo="">Ver todos os avisos</button>'
                : botaoCriar(null)
            )}
      </div>
      <div id="caixa-notificacoes"></div>
    </div>`;
}

function ecraQuadros() {
  return `
    <div class="masthead">
      <div class="masthead__text">
        <h1 class="page-title" tabindex="-1">Quadros</h1>
        <p class="lede">Escolha uma pasta para ver os seus avisos</p>
      </div>
      <div class="masthead__actions">
        ${botaoCriar(null)}
        ${podeGerirContas() ? `<button class="btn btn--kraft btn--compacto" data-act="ir" data-hash="#/gerir-quadros">${ico('folder')} Gerir quadros</button>` : ''}
      </div>
    </div>
    <div class="folders">
      ${BOARDS.map((b) => {
        const n = Arquivo.doQuadro(b.id);
        const novos = n.filter(porLer).length;
        return `
          <button class="folder" data-act="abrir-quadro" data-id="${b.id}">
            <span class="folder__tab"></span>
            <span class="folder__body">
              <span class="folder__name">${esc(b.name)}</span>
              <span class="folder__foot">
                ${novos ? `<span class="dot"></span>` : ''}
                <span class="folder__count tnum">${novos ? plural(novos, 'por ler', 'por ler') : plural(n.length, 'aviso', 'avisos')}</span>
              </span>
            </span>
          </button>`;
      }).join('')}
    </div>
    ${temSessao() ? '' : `
      <p class="entrada-discreta">
        É responsável por um quadro?
        <button data-act="ir" data-hash="#/entrar">Entrar</button>
      </p>`}`;
}

function ecraQuadro() {
  const todos = Arquivo.doQuadro(estado.boardId);
  let lista = aplicarFiltro(todos);
  if (estado.ordem === 'antigos') lista = lista.slice().reverse();
  const podePublicar = temSessao() && Arquivo.quadrosPermitidos().indexOf(estado.boardId) > -1;

  return `
    <div class="boardhead">
      <div class="appbar">
        <button class="iconbtn" data-act="voltar" data-hash="#/quadros" aria-label="Voltar aos quadros">${ico('back')}</button>
        <h1 class="appbar__title" tabindex="-1">${esc(nomeQuadro(estado.boardId))}</h1>
        ${podePublicar
          ? `<button class="iconbtn" data-act="novo-aviso" data-hash="#/publicar?quadro=${estado.boardId}" aria-label="Novo aviso neste quadro">${ico('plus')}</button>`
          : ''}
      </div>
      <div class="boardtabs" role="tablist" aria-label="Quadros">
        ${BOARDS.map((b) => `
          <button class="boardtab" role="tab"
                  aria-selected="${b.id === estado.boardId}"
                  tabindex="${b.id === estado.boardId ? '0' : '-1'}"
                  data-act="abrir-quadro" data-id="${b.id}">${esc(b.short)}</button>`).join('')}
      </div>
    </div>
    <div class="wrap">
      <div class="barra-lista">
        ${filtros(todos)}
        ${todos.length > 1 ? `
          <button class="chip chip--sm" data-act="ordem">
            ${ico('sort')} ${estado.ordem === 'recentes' ? 'Mais recentes' : 'Mais antigos'}
          </button>` : ''}
      </div>
      <div class="stack grid-notices">
        ${lista.length
          ? lista.map((p) => `
            <button class="pinned" data-act="abrir-aviso" data-id="${p.id}">
              <span class="pinned__meta">
                <span class="tag tag--plain">${esc(p.kind)}</span>
                ${selo(p)}
              </span>
              <span class="pinned__title">${esc(p.title)}</span>
              ${tiraDoEvento(p)}
              <span class="pinned__summary">${esc(p.summary)}</span>
              ${rodapeDePublicacao(p)}
            </button>`).join('')
          : vazio(
              estado.filtro ? `Não há avisos do tipo «${esc(estado.filtro)}» neste quadro.` : 'Este quadro ainda não tem avisos.',
              estado.filtro
                ? '<button class="btn btn--kraft" data-act="filtro" data-tipo="">Ver todos</button>'
                : (podePublicar ? botaoCriar(estado.boardId) : '')
            )}
      </div>
    </div>`;
}

function ecraAviso() {
  const p = Arquivo.aviso(estado.postId);
  if (!p) return ecraPerdido('aviso');

  const podeEditar = Arquivo.podeEditar(p);
  const podeEliminar = Arquivo.podeEliminar(p);
  const relacionados = Arquivo.doQuadro((p.boards || [])[0]).filter((x) => x.id !== p.id).slice(0, 3);

  const iconeAnexo = { map: 'map', pdf: 'download', phone: 'phone', link: 'link' };

  return `
    ${barra('#/novidades', `<button class="link-quadro" data-act="abrir-quadro" data-id="${(p.boards || [])[0]}">${esc(etiquetaQuadros(p))}</button>`, {
      discreto: true,
      accoes: `
        <button class="iconbtn" data-act="partilhar" data-id="${p.id}" aria-label="Partilhar este aviso">${ico('share')}</button>
        ${podeEditar ? `<button class="iconbtn" data-act="editar" data-id="${p.id}" aria-label="Editar este aviso">${ico('edit')}</button>` : ''}
        ${podeEliminar ? `<button class="iconbtn iconbtn--perigo" data-act="pedir-eliminar" data-id="${p.id}" aria-label="Eliminar este aviso">${ico('trash')}</button>` : ''}`
    })}
    <article class="post">
      <header class="post__head">
        <div class="post__flags">
          <span class="tag">${esc(p.kind)}</span>
          ${selo(p)}
        </div>
        <h1 class="post__title" tabindex="-1">${esc(p.title)}</h1>
      </header>

      <div class="post__main">
        ${p.hero ? `<button class="hero-btn" data-act="foto" data-id="${p.id}" data-i="-1" aria-label="Ampliar a imagem principal">${imagem(p.hero, 'hero', p.title)}</button>` : ''}

        <div class="prose">
          ${(p.body || []).map((t) => `<p>${esc(t)}</p>`).join('')}
        </div>

        ${(p.gallery || []).length ? `
          <section>
            <p class="eyebrow">Galeria · ${plural(p.gallery.length, 'foto', 'fotos')}</p>
            <div class="gallery">
              ${p.gallery.map((g, i) => `
                <button class="gal" data-act="foto" data-id="${p.id}" data-i="${i}"
                        aria-label="Ampliar ${esc(g.legenda || 'foto ' + (i + 1))}">
                  ${imagem(g, 'gal__img', g.legenda)}
                </button>`).join('')}
            </div>
          </section>` : ''}

        <p class="byline">Publicado por ${esc(p.author)}${p.authorRole ? ' · ' + esc(p.authorRole) : ''}, ${esc(Datas.publicadoEm(p.ts))}</p>

        ${relacionados.length ? `
          <section class="relacionados">
            <p class="eyebrow">Mais avisos deste quadro</p>
            <div class="relacionados__lista">
              ${relacionados.map((r) => `
                <button class="rel" data-act="abrir-aviso" data-id="${r.id}">
                  <span class="mono tnum">${esc(r.date)}</span>
                  <span class="rel__titulo">${esc(r.title)}</span>
                </button>`).join('')}
            </div>
          </section>` : ''}
      </div>

      <aside class="post__aside">
        ${p.when ? `
          <div class="when">
            <p class="eyebrow eyebrow--dark">Quando e onde</p>
            <p class="when__day">${esc(p.when.day)}</p>
            <p class="when__time">${esc(p.when.time)}${p.when.place ? ' · ' + esc(p.when.place) : ''}</p>
          </div>` : ''}

        ${(p.links || []).length ? `
          <div class="attachments">
            ${p.links.map((l, i) => `
              <button class="attach ${l.type === 'map' ? 'attach--map' : ''}" data-act="anexo" data-id="${p.id}" data-i="${i}">
                ${ico(iconeAnexo[l.type] || 'link')}
                <span class="attach__label">${esc(l.label)}</span>
                <span class="attach__meta">${esc(l.meta)}</span>
              </button>`).join('')}
          </div>` : ''}

        ${p.contact ? `
          <div class="contact">
            <p class="eyebrow eyebrow--dark">Contactos</p>
            <p class="contact__name">${esc(p.contact.name)}</p>
            <a class="contact__tel tnum" href="tel:${esc(String(p.contact.phone).replace(/\s/g, ''))}">
              ${ico('phone')} ${esc(p.contact.phone)}
            </a>
            <button class="btn btn--sm btn--quiet" data-act="copiar-numero" data-valor="${esc(p.contact.phone)}">
              ${ico('copy')} Copiar número
            </button>
            <p class="contact__note">${esc(p.contact.note)}</p>
          </div>` : ''}
      </aside>
    </article>`;
}

function ecraProcurar() {
  return `
    <div class="masthead searchhead">
      <div class="masthead__text" style="width:100%">
        <h1 class="page-title" tabindex="-1">Procurar</h1>
        <form class="procura" role="search" data-act="procura-form">
          <span class="procura__ico">${ico('search')}</span>
          <input class="field procura__campo" id="q" type="search" value="${esc(estado.query)}"
                 placeholder="Atividade, jovens, serviço…" autocomplete="off"
                 aria-label="Procurar avisos">
          <button class="procura__limpar" type="button" data-act="limpar-procura"
                  ${estado.query ? '' : 'hidden'} aria-label="Limpar a procura">${ico('close')}</button>
        </form>
        <div class="chips">
          ${QUICK_SEARCHES.map((q) => `
            <button class="chip" data-act="atalho" data-q="${esc(q)}"
                    aria-pressed="${estado.query.trim().toLowerCase() === q.toLowerCase()}">${esc(q)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="wrap">
      <p class="contagem" id="contagem" aria-live="polite">${textoContagem()}</p>
      <div id="results" class="stack grid-notices">${resultados()}</div>
    </div>`;
}

function acertos() {
  const q = estado.query.trim().toLowerCase();
  const todos = Arquivo.avisos();
  if (!q) return todos;
  return todos.filter((p) =>
    (p.title + ' ' + p.summary + ' ' + p.kind + ' ' + (p.boards || []).map(nomeQuadro).join(' '))
      .toLowerCase().indexOf(q) > -1);
}

function textoContagem() {
  const n = acertos().length;
  const q = estado.query.trim();
  return q ? `${plural(n, 'aviso', 'avisos')} com «${q}»` : plural(n, 'aviso', 'avisos');
}

function resultados() {
  const lista = acertos();
  if (!lista.length) {
    return vazio(
      `Não há avisos com «${esc(estado.query.trim())}». Experimente uma palavra mais curta.`,
      '<button class="btn btn--kraft" data-act="limpar-procura">Limpar procura</button>'
    );
  }
  return lista.map((p) => `
    <button class="resultcard" data-act="abrir-aviso" data-id="${p.id}">
      <span class="mono">${esc(etiquetaQuadros(p))}</span>
      <span class="resultcard__title">${esc(p.title)}</span>
      ${tiraDoEvento(p)}
      <span class="flags"><span class="tag tag--plain">${esc(p.kind)}</span>${selo(p)}</span>
      ${rodapeDePublicacao(p)}
    </button>`).join('');
}

function ecraEntrar() {
  const destino = estado.destinoAposEntrar;
  return `
    <div class="login">
      <p class="eyebrow">Acesso para responsáveis</p>
      <h1 class="login__title" tabindex="-1">Entrar</h1>
      <p class="lede">
        Só os líderes e responsáveis de cada quadro precisam de utilizador.
        Para ler os avisos não é preciso.
      </p>
      ${destino ? `<p class="nota">Depois de entrar volta a ${esc(nomeDoDestino(destino))}.</p>` : ''}

      <form class="stack" id="form-entrar" novalidate>
        <label class="label">Utilizador ou e-mail
          <input class="field" type="text" name="utilizador" id="campo-utilizador"
                 autocomplete="username" placeholder="o.seu.nome">
        </label>
        <label class="label">Palavra-passe
          <span class="palavra">
            <input class="field" type="password" name="palavra" id="campo-palavra"
                   autocomplete="current-password" placeholder="A sua palavra-passe">
            <button class="palavra__olho" type="button" data-act="ver-palavra" aria-label="Mostrar a palavra-passe">${ico('eye')}</button>
          </span>
        </label>
        <p class="erro" id="erro-entrar" role="alert" hidden></p>
        <button class="btn btn--solid btn--block" type="submit">Entrar</button>
        <button class="btn btn--quiet btn--block" type="button" data-act="ir" data-hash="#/novidades">
          Ver avisos sem entrar
        </button>
      </form>

      <p class="login__foot">Qualquer utilizador e qualquer palavra-passe entram: isto é uma demonstração.</p>
    </div>`;
}

function nomeDoDestino(hash) {
  const mapa = {
    '#/publicar': 'criar o aviso',
    '#/publicar/destino': 'escolher o destino',
    '#/a-minha-conta': 'a sua conta'
  };
  return mapa[hash] || 'onde estava';
}

/* ---------- Criar / editar aviso ---------- */

function campoDoBloco(chave) {
  const b = BLOCKS[chave];
  const v = estado.valores[chave];
  const idc = 'c-' + chave;

  if (b.campo === 'texto') {
    return `<input class="field" id="${idc}" type="text" data-campo="${chave}" maxlength="${b.max || 120}"
                   value="${esc(v || '')}" placeholder="${esc(b.hint)}">`;
  }
  if (b.campo === 'area') {
    return `<textarea class="field field--area" id="${idc}" rows="5" data-campo="${chave}"
                      placeholder="${esc(b.hint)}">${esc(v || '')}</textarea>`;
  }
  if (b.campo === 'datahora') {
    return `<input class="field" id="${idc}" type="datetime-local" data-campo="${chave}" value="${esc(v || '')}">`;
  }
  if (b.campo === 'url') {
    return `<input class="field" id="${idc}" type="url" inputmode="url" data-campo="${chave}"
                   value="${esc(v || '')}" placeholder="${esc(b.hint)}">`;
  }
  if (b.campo === 'telefone') {
    return `<input class="field" id="${idc}" type="tel" inputmode="tel" data-campo="${chave}"
                   value="${esc(v || '')}" placeholder="${esc(b.hint)}">`;
  }
  if (b.campo === 'lugar') {
    const escolhido = v && (v.titulo || v.morada) ? v : null;
    const guardados = Arquivo.lugares();

    if (escolhido) {
      return `
        <div class="lugar-escolhido">
          ${escolhido.lat != null && escolhido.lon != null
            ? `<div class="mapa-vivo mapa-vivo--pequeno" data-mapa-ver="${escolhido.lat},${escolhido.lon}"></div>`
            : ''}
          <div class="lugar-escolhido__texto">
            <span class="lugar-escolhido__titulo">${esc(escolhido.titulo || 'Sem nome')}</span>
            ${escolhido.morada ? `<span class="lugar-escolhido__morada">${esc(escolhido.morada)}</span>` : ''}
            ${escolhido.lat != null ? '<span class="lugar-escolhido__nota">Marcado no mapa</span>' : ''}
          </div>
          <button type="button" class="btn btn--sm btn--quiet" data-act="lugar-trocar" data-chave="${chave}">Trocar</button>
        </div>`;
    }

    return `
      <div class="lugar-escolher">
        ${guardados.length ? `
          <p class="eyebrow">Lugares habituais</p>
          <div class="chips">
            ${guardados.map((l) => `
              <button type="button" class="chip chip--sm" data-act="lugar-guardado" data-id="${l.id}" data-chave="${chave}">
                ${ico('map')} ${esc(l.titulo)}
              </button>`).join('')}
          </div>` : ''}
        <div class="lugar-escolher__ou">
          <button type="button" class="btn btn--sm btn--kraft" data-act="lugar-escrever" data-chave="${chave}">
            ${ico('edit')} Escrever a morada
          </button>
          <button type="button" class="btn btn--sm btn--kraft" data-act="lugar-mapa" data-chave="${chave}">
            ${ico('map')} Marcar no mapa
          </button>
        </div>
      </div>`;
  }

  if (b.campo === 'contacto') {
    /* Quem publica nem sempre é quem atende o telefone: por isso o nome
       é um campo à parte, com um atalho para o caso comum. */
    const c = v || {};
    const s = sessao();
    const souEu = s && c.nome === s.nome;
    return `
      <div class="contacto-campo">
        <label class="label">Nome de quem responde
          <input class="field" id="${idc}" type="text" data-campo-sub="${chave}:nome"
                 value="${esc(c.nome || '')}" placeholder="Irmã Laura Mendes">
        </label>
        ${s ? `
          <button type="button" class="btn btn--sm ${souEu ? 'btn--kraft' : 'btn--quiet'}"
                  data-act="contacto-sou-eu" data-chave="${chave}">
            ${souEu ? ico('check') : ico('user')} Sou eu
          </button>` : ''}
        <label class="label">Telefone
          <input class="field" type="tel" inputmode="tel" data-campo-sub="${chave}:telefone"
                 value="${esc(c.telefone || '')}" placeholder="${esc(b.hint)}">
        </label>
        <label class="label">Quando ou como (opcional)
          <input class="field" type="text" data-campo-sub="${chave}:nota"
                 value="${esc(c.nota || '')}" placeholder="Também no domingo, na capela">
        </label>
      </div>`;
  }
  if (b.campo === 'ficheiro') {
    const ehPdf = b.accept === 'application/pdf';
    if (v) {
      return `
        <div class="ficheiro">
          ${ehPdf
            ? `<span class="ficheiro__pdf">${ico('file')}</span>`
            : `<img class="ficheiro__img" src="${esc(v.url || v.dataUrl || '')}" alt="${esc(v.nome)}">`}
          <span class="ficheiro__info">
            <span class="ficheiro__nome">${esc(v.nome)}</span>
            <span class="ficheiro__meta tnum">${esc(v.medidas || v.tamanho || '')}</span>
          </span>
          <label class="btn btn--sm btn--quiet">Trocar
            <input type="file" class="sr" data-ficheiro="${chave}" accept="${b.accept}">
          </label>
          <button class="btn btn--sm btn--quiet" data-act="limpar-ficheiro" data-chave="${chave}">${ico('close')} Retirar</button>
        </div>`;
    }
    return `
      <label class="drop" data-largar="${chave}">
        ${ico(ehPdf ? 'file' : 'image', 'ico drop__ico')}
        <span>${esc(b.hint)}</span>
        <input type="file" class="sr" data-ficheiro="${chave}" accept="${b.accept}">
      </label>`;
  }
  if (b.campo === 'ficheiros') {
    const fotos = Array.isArray(v) ? v : [];
    return `
      <div class="galeria-edit">
        ${fotos.map((f, i) => `
          <span class="galeria-edit__item">
            <img src="${esc(f.url || f.dataUrl || '')}" alt="${esc(f.nome)}">
            <button class="galeria-edit__x" data-act="tirar-foto" data-chave="${chave}" data-i="${i}"
                    aria-label="Retirar ${esc(f.nome)}">${ico('close')}</button>
          </span>`).join('')}
        <label class="drop drop--pequeno" data-largar="${chave}">
          ${ico('plus', 'ico drop__ico')}
          <span>${fotos.length ? 'Mais fotos' : esc(b.hint)}</span>
          <input type="file" class="sr" multiple data-ficheiro="${chave}" accept="${b.accept}">
        </label>
      </div>`;
  }
  return '';
}

function ecraCriar() {
  const editar = !!estado.editingId;
  const disponiveis = ORDEM_BLOCOS.filter((k) => estado.blocks.indexOf(k) < 0);
  const semTitulo = !String(estado.valores.titulo || '').trim();
  const podeAvancar = estado.blocks.length > 0 && !semTitulo;

  return `
    ${barra(editar ? '#/aviso/' + estado.editingId : '#/a-minha-conta',
      `<span class="passo">${editar ? 'A editar' : 'Passo 1 de 2'} · Conteúdo</span>
       <span class="appbar__title">${editar ? 'Editar aviso' : 'Criar aviso'}</span>`,
      { accoes: `<button class="iconbtn iconbtn--perigo" data-act="descartar" aria-label="Descartar este aviso">${ico('trash')}</button>` })}

    <div class="compose wrap">
      <div class="compose__main stack">
        <p class="lede">Adicione apenas as partes de que precisar. Pode retirá-las quando quiser.</p>

        <div class="tipo-escolha">
          <p class="eyebrow">Que tipo de aviso é</p>
          <div class="segmented" role="radiogroup" aria-label="Tipo de aviso">
            ${TIPOS.map((t) => `
              <button type="button" role="radio" data-act="tipo" data-tipo="${esc(t)}"
                      aria-checked="${(estado.valores.tipo || 'Aviso') === t}"
                      aria-pressed="${(estado.valores.tipo || 'Aviso') === t}">${esc(t)}</button>`).join('')}
          </div>
        </div>

        ${estado.blocks.length ? estado.blocks.map((chave, i) => {
          const b = BLOCKS[chave];
          return `
            <div class="block" data-bloco="${chave}">
              <div class="block__head">
                <span class="block__label">${esc(b.label)}</span>
                <span class="block__ferramentas">
                  <button class="iconbtn iconbtn--mini" data-act="mover" data-i="${i}" data-d="-1"
                          ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(b.label)}">${ico('up')}</button>
                  <button class="iconbtn iconbtn--mini" data-act="mover" data-i="${i}" data-d="1"
                          ${i === estado.blocks.length - 1 ? 'disabled' : ''} aria-label="Descer ${esc(b.label)}">${ico('down')}</button>
                  <button class="btn btn--sm btn--quiet" data-act="tirar-bloco" data-i="${i}">Retirar</button>
                </span>
              </div>
              ${campoDoBloco(chave)}
            </div>`;
        }).join('') : vazio('O aviso está vazio. Adicione uma parte para começar.')}

        <div class="compose__avancar">
          <button class="btn btn--solid btn--block" data-act="ir"
                  data-hash="${editar ? '#/publicar/destino' : '#/publicar/destino'}"
                  ${podeAvancar ? '' : 'disabled'}>
            ${editar ? 'Rever o destino' : 'Escolher onde publicar'}
          </button>
          ${!podeAvancar ? `<p class="nota nota--aviso">${estado.blocks.length ? 'Escreva o título do aviso para continuar.' : 'Adicione pelo menos uma parte.'}</p>` : ''}
        </div>
      </div>

      <div class="compose__side">
        <p class="eyebrow">Adicionar parte</p>
        <div class="palette">
          ${disponiveis.length
            ? disponiveis.map((k) => `
                <button class="btn btn--kraft" data-act="juntar-bloco" data-chave="${k}">
                  ${ico('plus')} ${esc(BLOCKS[k].label)}
                </button>`).join('')
            : '<p class="nota">Já está a usar todas as partes.</p>'}
        </div>
      </div>
    </div>`;
}

function ecraDestino() {
  const permitidos = Arquivo.quadrosPermitidos();
  const editar = !!estado.editingId;

  const modos = [
    { id: 'mine', etiqueta: 'Só no meu quadro', nota: nomeQuadro(sessao() ? sessao().board : 'socorro') },
    { id: 'pick', etiqueta: 'Escolher quadros', nota: 'Marque um a um' },
    { id: 'all',  etiqueta: 'Todos os quadros', nota: 'Veem-no todas as organizações' }
  ];

  const alvos = destinosResolvidos();
  const podePublicar = alvos.length > 0;

  return `
    ${barra(editar ? '#/editar/' + estado.editingId : '#/publicar',
      `<span class="passo">${editar ? 'A editar' : 'Passo 2 de 2'} · Destino</span>
       <span class="appbar__title">Onde vai ser publicado?</span>`,
      { accoes: `<button class="iconbtn" data-act="previsualizar" aria-label="Pré-visualizar o aviso">${ico('eye')}</button>` })}

    <div class="wrap targets stack">
      <div class="resumo">
        <p class="eyebrow eyebrow--dark">Resumo</p>
        <p class="resumo__titulo">${esc(estado.valores.titulo || 'Sem título')}</p>
        <p class="resumo__partes">${estado.blocks.map((k) => esc(BLOCKS[k].label)).join(' · ')}</p>
        <button class="btn btn--sm btn--quiet" data-act="previsualizar">${ico('eye')} Pré-visualizar</button>
      </div>

      <div role="radiogroup" aria-label="Onde publicar" class="stack">
        ${modos.map((m) => {
          const bloqueado = m.id === 'all' && !ehBispado();
          return `
            <button class="mode ${bloqueado ? 'mode--locked' : ''}" role="radio"
                    aria-checked="${!bloqueado && estado.mode === m.id}"
                    ${bloqueado ? 'aria-disabled="true"' : ''}
                    data-act="${bloqueado ? 'modo-bloqueado' : 'modo'}" data-mode="${m.id}">
              <span class="radio"></span>
              <span>
                <span class="mode__label">${esc(m.etiqueta)}</span>
                <span class="mode__note">${bloqueado ? 'A sua permissão não chega para isto' : esc(m.nota)}</span>
              </span>
              ${bloqueado ? `<span class="mode__cadeado">${ico('lock')}</span>` : ''}
            </button>`;
        }).join('')}
      </div>

      ${estado.mode === 'pick' ? `
        <div class="picker" role="group" aria-label="Quadros de destino">
          <p class="eyebrow eyebrow--dark">Marque os quadros</p>
          <div class="stack" style="gap:10px">
            ${BOARDS.map((b) => {
              const pode = permitidos.indexOf(b.id) > -1;
              return `
                <button class="checkrow ${pode ? '' : 'checkrow--locked'}" role="checkbox"
                        aria-checked="${estado.picked.indexOf(b.id) > -1}"
                        ${pode ? '' : 'aria-disabled="true"'}
                        data-act="${pode ? 'marcar' : 'modo-bloqueado'}" data-id="${b.id}">
                  <span class="check">${ico('check')}</span>
                  <span>${esc(b.name)}</span>
                  ${pode ? '' : `<span class="mode__cadeado">${ico('lock')}</span>`}
                </button>`;
            }).join('')}
          </div>
        </div>` : ''}

      <div class="destino-final">
        <p class="nota">${alvos.length
          ? 'Vai ser publicado em: <strong>' + alvos.map((id) => esc(nomeQuadro(id))).join(', ') + '</strong>'
          : 'Escolha pelo menos um quadro.'}</p>
        <button class="btn btn--solid btn--block" data-act="publicar" ${podePublicar ? '' : 'disabled'}>
          ${editar ? 'Guardar alterações' : 'Publicar aviso'}
        </button>
      </div>
    </div>`;
}

function destinosResolvidos() {
  const permitidos = Arquivo.quadrosPermitidos();
  if (estado.mode === 'all') return ehBispado() ? BOARDS.map((b) => b.id) : [];
  if (estado.mode === 'pick') return estado.picked.filter((id) => permitidos.indexOf(id) > -1);
  const meu = sessao() ? sessao().board : null;
  return meu && permitidos.indexOf(meu) > -1 ? [meu] : [];
}

function ecraMinhaConta() {
  const s = sessao();
  const { proprios, administrados } = Arquivo.meus();
  const papel = s.papelLegivel || s.papelNome || '';

  return `
    <div class="account">
      <p class="eyebrow eyebrow--dark">${esc(papel)}</p>
      <h1 class="account__name" tabindex="-1">${esc(s.nome)}</h1>
      <p class="account__user mono">@${esc(s.utilizador)}</p>
    </div>
    <div class="wrap stack">
      <button class="btn btn--solid btn--block" data-act="novo-aviso" data-hash="#/publicar">
        ${ico('plus')} Novo aviso
      </button>

      <div id="caixa-notificacoes"></div>

      <div class="conta__atalhos">
        ${podeGerirContas() ? `<button class="btn btn--kraft" data-act="ir" data-hash="#/contas">${ico('user')} Gerir contas</button>` : ''}
        ${podeGerirContas() ? `<button class="btn btn--kraft" data-act="ir" data-hash="#/lugares">${ico('map')} Lugares</button>` : ''}
        <button class="btn btn--quiet" data-act="ir" data-hash="#/palavra-passe">${ico('lock')} Mudar palavra-passe</button>
      </div>

      <p class="eyebrow" style="margin-top:14px">Os meus avisos · ${proprios.length}</p>
      <div class="mine-grid stack">
        ${proprios.length ? proprios.map((p) => fichaGestao(p, true)).join('')
          : vazio('Ainda não publicou nenhum aviso.',
                  '<button class="btn btn--kraft" data-act="novo-aviso" data-hash="#/publicar">Criar o primeiro aviso</button>')}
      </div>

      ${administrados.length ? `
        <p class="eyebrow" style="margin-top:22px">Que administra · ${administrados.length}</p>
        <div class="mine-grid stack">
          ${administrados.map((p) => fichaGestao(p, Arquivo.podeEliminar(p))).join('')}
        </div>` : ''}

      <button class="btn btn--quiet btn--block" data-act="sair" style="margin-top:26px">
        Sair da minha conta
      </button>
    </div>`;
}

function fichaGestao(p, podeEliminar) {
  return `
    <div class="minecard">
      <p class="minecard__meta tnum">${esc(p.date)} · ${esc(etiquetaQuadros(p))}</p>
      <p class="minecard__title">${esc(p.title)}</p>
      <div class="minecard__actions">
        <button class="btn btn--quiet btn--sm" data-act="abrir-aviso" data-id="${p.id}">${ico('eye')} Ver</button>
        <button class="btn btn--kraft btn--sm" data-act="editar" data-id="${p.id}">${ico('edit')} Editar</button>
        ${podeEliminar
          ? `<button class="btn btn--danger btn--sm" data-act="pedir-eliminar" data-id="${p.id}">${ico('trash')} Eliminar</button>`
          : ''}
      </div>
    </div>`;
}

function ecraPerdido(tipo) {
  const eAviso = tipo !== 'quadro';
  return `
    ${barra('#/novidades', eAviso ? 'Aviso não encontrado' : 'Quadro não encontrado')}
    <div class="wrap">
      ${vazio(
        eAviso
          ? 'Este aviso já não está disponível. Pode ter sido eliminado.'
          : 'Este quadro não existe. Talvez o endereço esteja trocado.',
        `<button class="btn btn--kraft" data-act="ir" data-hash="#/novidades">${ico('feed')} Ver novidades</button>
         <button class="btn btn--quiet" data-act="ir" data-hash="#/procurar">${ico('search')} Procurar</button>`
      )}
    </div>`;
}

function ecraCarregando() {
  return `
    <div class="masthead">
      <div class="masthead__text">
        <span class="esq esq--eyebrow"></span>
        <span class="esq esq--titulo"></span>
        <span class="esq esq--linha"></span>
      </div>
    </div>
    <div class="wrap">
      <div class="stack grid-notices" aria-hidden="true">
        ${Array.from({ length: 4 }).map(() => `
          <div class="notice notice--esq">
            <span class="esq esq--cabeca"></span>
            <span class="esq esq--corpo"></span>
          </div>`).join('')}
      </div>
      <p class="sr" role="status">A carregar os avisos…</p>
    </div>`;
}

function ecraErroRede(err) {
  const semSessao = err && err.codigo === 'autenticacao';
  return `
    <div class="wrap wrap--centro">
      <div class="erro-rede" role="alert">
        <span class="erro-rede__ico">${ico('cloud-off')}</span>
        <h1 class="erro-rede__titulo" tabindex="-1">Não foi possível carregar os avisos</h1>
        <p class="erro-rede__texto">${esc((err && err.mensagem) || 'Algo correu mal.')}</p>
        <div class="erro-rede__accoes">
          <button class="btn btn--solid" data-act="recarregar-tudo">${ico('refresh')} Tentar de novo</button>
          ${semSessao ? `<button class="btn btn--quiet" data-act="ir" data-hash="#/entrar">Entrar</button>` : ''}
        </div>
      </div>
    </div>`;
}


/* ---------- Mapa ---------- */

/* O Leaflet são 150 KB: só se carrega quando alguém abre um mapa, e
   uma só vez por sessão. */
let mapaAPedir = null;
function carregarMapa() {
  if (window.L) return Promise.resolve(window.L);
  if (mapaAPedir) return mapaAPedir;

  mapaAPedir = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'assets/vendor/leaflet.css';
    document.head.appendChild(css);

    const js = document.createElement('script');
    js.src = 'assets/vendor/leaflet.js';
    js.onload = () => resolve(window.L);
    js.onerror = () => { mapaAPedir = null; reject(new Error('Não foi possível carregar o mapa.')); };
    document.head.appendChild(js);
  });
  return mapaAPedir;
}

/* Leiria, para quando não há nada melhor por onde começar. */
const CENTRO_POR_OMISSAO = [39.7436, -8.8071];

function centroInicial(lugar) {
  if (lugar && lugar.lat != null && lugar.lon != null) return [lugar.lat, lugar.lon];
  const comCoordenadas = Arquivo.lugares().find((l) => l.lat != null && l.lon != null);
  if (comCoordenadas) return [comCoordenadas.lat, comCoordenadas.lon];
  return CENTRO_POR_OMISSAO;
}

const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/* Mapa só de ver: sem arrastar, sem zoom, sem teclado. */
async function mapaEstatico(elemento, lat, lon) {
  const L = await carregarMapa();
  const m = L.map(elemento, {
    center: [lat, lon], zoom: 16,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false,
    zoomControl: false, attributionControl: true
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: ATRIBUICAO
  }).addTo(m);
  return m;
}

/* Mapa para escolher: o alfinete não se move, move-se o mapa por baixo.
   É mais fácil de acertar com o dedo do que arrastar um alfinete. */
async function mapaEscolhavel(elemento, centro, aoMover) {
  const L = await carregarMapa();
  const m = L.map(elemento, {
    center: centro, zoom: 16, zoomControl: true, attributionControl: true
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: ATRIBUICAO
  }).addTo(m);
  m.on('moveend', () => { const c = m.getCenter(); aoMover(c.lat, c.lng); });
  setTimeout(() => m.invalidateSize(), 60);
  return m;
}

/* Os mapas só existem depois de o HTML estar no ecrã. */
async function activarMapas() {
  for (const el of $$('[data-mapa-ver]')) {
    if (el.dataset.mapaPronto) continue;
    el.dataset.mapaPronto = '1';
    const [lat, lon] = el.dataset.mapaVer.split(',').map(Number);
    try { await mapaEstatico(el, lat, lon); }
    catch (err) { el.classList.add('mapa-vivo--falhou'); el.textContent = 'Mapa indisponível'; }
  }

  const escolher = $('#mapa-escolher');
  if (escolher && !escolher.dataset.mapaPronto) {
    escolher.dataset.mapaPronto = '1';
    const c = estado.camada;
    try {
      const centro = centroInicial(c && c.valor);
      c.lat = centro[0]; c.lon = centro[1];
      await mapaEscolhavel(escolher, centro, (lat, lon) => {
        if (estado.camada) { estado.camada.lat = lat; estado.camada.lon = lon; }
      });
    } catch (err) {
      escolher.classList.add('mapa-vivo--falhou');
      escolher.textContent = 'Não foi possível carregar o mapa.';
    }
  }
}

/* ---------- Notificações ---------- */

/* O estado só se sabe perguntando ao navegador, que é assíncrono: por
   isso o bloco desenha-se depois, sobre um espaço já reservado. */
async function desenharNotificacoes() {
  const caixa = $('#caixa-notificacoes');
  if (!caixa || typeof PWA === 'undefined') return;

  let e;
  try { e = await PWA.notificacoes.estado(); } catch (err) { return; }
  if (!e.suportado) { caixa.innerHTML = ''; return; }

  if (e.subscrito) {
    caixa.innerHTML = `
      <div class="notif notif--ligada">
        <span class="notif__ico">${ico('bell')}</span>
        <span class="notif__texto">
          <span class="notif__titulo">Vai ser avisado dos avisos novos</span>
          <span class="notif__nota">Neste aparelho, mesmo com a aplicação fechada.</span>
        </span>
        <button class="btn btn--sm btn--quiet" data-act="notif-desativar">Desligar</button>
      </div>`;
    return;
  }

  if (e.permissao === 'denied') {
    caixa.innerHTML = `
      <div class="notif">
        <span class="notif__ico">${ico('bell-off')}</span>
        <span class="notif__texto">
          <span class="notif__titulo">Notificações bloqueadas</span>
          <span class="notif__nota">Estão desligadas nas definições do navegador para este sítio.</span>
        </span>
      </div>`;
    return;
  }

  if (e.exigeInstalar) {
    caixa.innerHTML = `
      <div class="notif">
        <span class="notif__ico">${ico('bell')}</span>
        <span class="notif__texto">
          <span class="notif__titulo">Quer ser avisado dos avisos novos?</span>
          <span class="notif__nota">No iPhone é preciso primeiro pôr o Quadro no ecrã inicial.</span>
        </span>
        <button class="btn btn--sm btn--kraft" data-act="convidar-instalar">Como se faz</button>
      </div>`;
    return;
  }

  caixa.innerHTML = `
    <div class="notif">
      <span class="notif__ico">${ico('bell')}</span>
      <span class="notif__texto">
        <span class="notif__titulo">Quer ser avisado dos avisos novos?</span>
        <span class="notif__nota">Chega uma notificação a este aparelho quando alguém publicar.</span>
      </span>
      <button class="btn btn--sm btn--solid" data-act="notif-ativar">Ativar</button>
    </div>`;
}

/* ---------- Gerir quadros (só o bispado) ---------- */

function ecraGerirQuadros() {
  return `
    ${barra('#/quadros', 'Gerir quadros', {
      accoes: `<button class="iconbtn" data-act="quadro-novo" aria-label="Novo quadro">${ico('plus')}</button>`
    })}
    <div class="wrap stack">
      <p class="lede">Cada organização tem o seu quadro. Criar um novo passa a estar disponível a quem publica e a quem lê.</p>

      <button class="btn btn--solid btn--block" data-act="quadro-novo">
        ${ico('plus')} Novo quadro
      </button>

      <div class="mine-grid stack">
        ${BOARDS.map((b) => {
          const n = Arquivo.doQuadro(b.id).length;
          return `
            <div class="quadro-ficha">
              <span class="quadro-ficha__tab"></span>
              <div class="quadro-ficha__corpo">
                <div class="quadro-ficha__texto">
                  <span class="quadro-ficha__nome">${esc(b.name)}</span>
                  <span class="quadro-ficha__curto mono">separador: ${esc(b.short)}</span>
                  <span class="quadro-ficha__conta">${plural(n, 'aviso', 'avisos')}</span>
                </div>
                <div class="quadro-ficha__accoes">
                  <button class="btn btn--sm btn--kraft" data-act="quadro-editar" data-id="${b.id}"
                          data-nome="${esc(b.name)}" data-curto="${esc(b.short)}">${ico('edit')} Editar</button>
                  <button class="btn btn--sm btn--danger" data-act="pedir-apagar-quadro" data-id="${b.id}"
                          data-nome="${esc(b.name)}" ${n ? 'disabled title="Tem avisos"' : ''}>${ico('trash')} Apagar</button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <p class="nota">Um quadro com avisos não se pode apagar: os avisos que só estivessem nele desapareciam sem deixar rasto.</p>
    </div>`;
}

/* ---------- Lugares guardados ---------- */

function ecraLugares() {
  const lista = Arquivo.lugares();

  return `
    ${barra('#/a-minha-conta', 'Lugares')}
    <div class="wrap stack">
      <p class="lede">Os sítios que se repetem nos avisos. Quem escreve um aviso escolhe-os com um toque, em vez de escrever a morada outra vez.</p>

      <div class="lugar-novo">
        <button class="btn btn--kraft" data-act="lugar-novo-escrito">${ico('edit')} Novo, escrito à mão</button>
        <button class="btn btn--solid" data-act="lugar-novo-mapa">${ico('map')} Novo, marcado no mapa</button>
      </div>

      ${lista.length ? `
        <div class="mine-grid stack">
          ${lista.map((l) => `
            <div class="lugar-ficha">
              ${l.lat != null && l.lon != null
                ? `<div class="mapa-vivo mapa-vivo--pequeno" data-mapa-ver="${l.lat},${l.lon}"></div>`
                : `<span class="lugar-ficha__semmapa">${ico('map')}</span>`}
              <div class="lugar-ficha__texto">
                <span class="lugar-escolhido__titulo">${esc(l.titulo)}</span>
                ${l.morada ? `<span class="lugar-escolhido__morada">${esc(l.morada)}</span>` : '<span class="lugar-escolhido__nota">Sem morada</span>'}
              </div>
              <button class="btn btn--sm btn--danger" data-act="pedir-apagar-lugar" data-id="${l.id}" data-titulo="${esc(l.titulo)}">
                ${ico('trash')} Apagar
              </button>
            </div>`).join('')}
        </div>`
        : vazio('Ainda não há lugares guardados. Guarde a capela para começar.')}
    </div>`;
}

/* ---------- Contas (só o bispado) ---------- */

const PAPEIS = [
  { id: 'bispado',     nome: 'Bispado',     nota: 'Pode tudo, em todos os quadros, e gere as contas' },
  { id: 'presidencia', nome: 'Presidência', nota: 'Publica, edita e apaga nos quadros que lhe atribuir' },
  { id: 'leitor',      nome: 'Leitor',      nota: 'Só pode ler' }
];

const nomeDoPapel = (id) => (PAPEIS.find((p) => p.id === id) || {}).nome || id;

function ecraContas() {
  const lista = estado.contas;

  return `
    ${barra('#/a-minha-conta', 'Contas', {
      accoes: `<button class="iconbtn" data-act="ir" data-hash="#/contas/nova" aria-label="Nova conta">${ico('plus')}</button>`
    })}
    <div class="wrap stack">
      <p class="lede">Quem tem conta pode entrar e publicar. Para ler os avisos não é preciso conta nenhuma.</p>

      <button class="btn btn--solid btn--block" data-act="ir" data-hash="#/contas/nova">
        ${ico('plus')} Nova conta
      </button>

      ${lista === null
        ? '<p class="contagem">A carregar as contas…</p>'
        : lista.length
          ? `<div class="mine-grid stack">${lista.map(fichaConta).join('')}</div>`
          : vazio('Ainda não há contas além da sua.')}
    </div>`;
}

function fichaConta(c) {
  const eu = sessao() && c.utilizador === sessao().utilizador;
  return `
    <div class="conta ${c.ativo ? '' : 'conta--inativa'}">
      <div class="conta__topo">
        <span class="conta__nome">${esc(c.nome)}${eu ? ' <span class="conta__eu">(você)</span>' : ''}</span>
        <span class="etiqueta-papel etiqueta-papel--${c.papel}">${esc(nomeDoPapel(c.papel))}</span>
      </div>
      <p class="conta__user mono">@${esc(c.utilizador)}</p>
      <p class="conta__papel">${esc(c.papelLegivel)}</p>
      ${c.ativo ? '' : '<p class="conta__aviso">Conta desativada: não pode entrar.</p>'}
      <div class="conta__accoes">
        <button class="btn btn--sm btn--kraft" data-act="ir" data-hash="#/contas/${c.id}">${ico('edit')} Editar</button>
        <button class="btn btn--sm btn--quiet" data-act="pedir-palavra" data-id="${c.id}" data-nome="${esc(c.nome)}">${ico('lock')} Palavra-passe</button>
        ${eu ? '' : `<button class="btn btn--sm btn--danger" data-act="pedir-apagar-conta" data-id="${c.id}" data-nome="${esc(c.nome)}">${ico('trash')} Apagar</button>`}
      </div>
    </div>`;
}

function ecraConta() {
  const nova = !estado.contaId;
  const f = estado.forma || {};
  const papel = f.papel || 'presidencia';

  return `
    ${barra('#/contas', nova ? 'Nova conta' : 'Editar conta')}
    <div class="wrap stack" style="max-width:640px">
      <form class="stack" id="form-conta">
        ${nova ? `
          <label class="label">Utilizador
            <input class="field" type="text" id="f-utilizador" value="${esc(f.utilizador || '')}"
                   placeholder="nome.apelido" autocomplete="off" autocapitalize="none">
          </label>` : `
          <p class="conta__user mono">@${esc(f.utilizador || '')}</p>`}

        <label class="label">Nome
          <input class="field" type="text" id="f-nome" value="${esc(f.nome || '')}" placeholder="Como aparece nos avisos">
        </label>

        <div class="tipo-escolha">
          <p class="eyebrow">Que pode fazer esta conta</p>
          <div class="segmented segmented--papeis" role="radiogroup" aria-label="Papel">
            ${PAPEIS.map((p) => `
              <button type="button" role="radio" data-act="forma-papel" data-papel="${p.id}"
                      aria-checked="${papel === p.id}">${esc(p.nome)}</button>`).join('')}
          </div>
          <p class="nota">${esc((PAPEIS.find((p) => p.id === papel) || {}).nota || '')}</p>
        </div>

        ${papel === 'presidencia' ? `
          <div class="picker">
            <p class="eyebrow eyebrow--dark">Em que quadros manda</p>
            <div class="stack" style="gap:10px">
              ${BOARDS.map((b) => `
                <button type="button" class="checkrow" role="checkbox"
                        aria-checked="${(f.quadros || []).includes(b.id)}"
                        data-act="forma-quadro" data-id="${b.id}">
                  <span class="check">${ico('check')}</span>
                  <span>${esc(b.name)}</span>
                </button>`).join('')}
            </div>
          </div>` : ''}

        ${nova ? `
          <label class="label">Palavra-passe
            <input class="field" type="text" id="f-palavra" value="${esc(f.palavra || '')}"
                   placeholder="Pelo menos 8 caracteres" autocomplete="new-password">
          </label>
          <p class="nota">Diga-a à pessoa por outro meio. Ela pode mudá-la depois de entrar.</p>` : `
          <button type="button" class="switch" role="checkbox" aria-checked="${f.ativo !== false}" data-act="forma-ativo">
            <span>Conta ativa</span>
            <span class="switch__box">${ico('check')}</span>
          </button>`}

        <p class="erro" id="erro-conta" role="alert" hidden></p>
        <button class="btn btn--solid btn--block" type="submit">
          ${nova ? 'Criar conta' : 'Guardar alterações'}
        </button>
      </form>
    </div>`;
}

function ecraPalavra() {
  return `
    ${barra('#/a-minha-conta', 'Mudar palavra-passe')}
    <div class="wrap stack" style="max-width:520px">
      <form class="stack" id="form-palavra">
        <label class="label">Palavra-passe atual
          <input class="field" type="password" id="p-atual" autocomplete="current-password">
        </label>
        <label class="label">Nova palavra-passe
          <input class="field" type="password" id="p-nova" autocomplete="new-password"
                 placeholder="Pelo menos 8 caracteres">
        </label>
        <label class="label">Repita a nova
          <input class="field" type="password" id="p-repete" autocomplete="new-password">
        </label>
        <p class="erro" id="erro-palavra" role="alert" hidden></p>
        <button class="btn btn--solid btn--block" type="submit">Guardar</button>
      </form>
    </div>`;
}

const ECRAS = {
  feed: ecraFeed, boards: ecraQuadros, board: ecraQuadro, post: ecraAviso,
  search: ecraProcurar, login: ecraEntrar, compose: ecraCriar,
  targets: ecraDestino, mine: ecraMinhaConta,
  contas: ecraContas, conta: ecraConta, palavra: ecraPalavra, lugares: ecraLugares,
  gerirQuadros: ecraGerirQuadros,
  perdido: () => ecraPerdido(estado.perdido)
};

/* ---------- Desenho ---------- */

const SUPERFICIE = { boards: 'cork', board: 'cork' };

function desenhar() {
  const r = Arquivo.estadoRede();

  // Sem dados ainda não há ecrã que se possa desenhar: esqueleto ou erro.
  if (!r.prontos) {
    $('#view').innerHTML = r.erro ? ecraErroRede(r.erro) : ecraCarregando();
    $('#main').dataset.surface = 'paper';
    desenharNav();
    desenharCamadas();
    return;
  }

  $('#view').innerHTML = (ECRAS[estado.ecra] || ecraFeed)();
  $('#main').dataset.surface = SUPERFICIE[estado.ecra] || 'paper';
  desenharNav();
  desenharCamadas();
}

function listaDeQuadros() {
  return BOARDS.map((b) => `
    <button class="rail__board" data-railboard="${b.id}" data-act="abrir-quadro" data-id="${b.id}">
      <span class="dot"></span>
      <span>${esc(b.short)}</span>
      <span class="spacer"></span>
      <span class="n tnum"></span>
    </button>`).join('');
}

function desenharNav() {
  // A barra ganha ou perde o lugar da conta consoante haja sessão.
  const esperados = navVisivel().length;
  if ($('#tabbar').children.length !== esperados) {
    $('#tabbar').innerHTML      = itensDeNav('tabbar__item', true);
    $('#toprail-nav').innerHTML = itensDeNav('toprail__item');
    $('#rail-nav').innerHTML    = itensDeNav('rail__item');
  }

  // Os quadros chegam da API depois do arranque: reconstrói-se a lista
  // quando o que está desenhado já não corresponde ao que há.
  const caixa = $('#rail-boards');
  if (caixa && caixa.children.length !== BOARDS.length) caixa.innerHTML = listaDeQuadros();

  $$('[data-nav]').forEach((el) => {
    const n = NAV.find((x) => x.id === el.dataset.nav);
    el.setAttribute('aria-current', el.dataset.nav === estado.seccao ? 'page' : 'false');
    el.dataset.hash = hashDaNav(n);
  });

  $$('[data-railboard]').forEach((el) => {
    el.setAttribute('aria-current', String(estado.ecra === 'board' && el.dataset.railboard === estado.boardId));
    const lista = Arquivo.doQuadro(el.dataset.railboard);
    const novos = lista.filter(porLer).length;
    el.querySelector('.n').textContent = novos || lista.length;
    el.querySelector('.n').classList.toggle('n--novo', novos > 0);
    el.querySelector('.dot').style.visibility = novos > 0 ? 'visible' : 'hidden';
  });

  const cartao = $('#rail-user');
  if (cartao) {
    const s = sessao();
    cartao.dataset.act = 'ir';
    cartao.dataset.hash = s ? '#/a-minha-conta' : '#/entrar';
    cartao.innerHTML = s
      ? `<span class="rail__username">${esc(s.nome)}</span>
         <span class="rail__role">${esc(s.papelLegivel || s.papelNome || '')}</span>`
      : `<span class="rail__username">Modo de leitura</span>
         <span class="rail__role">Entre para publicar avisos</span>`;
  }

  const cta = $('#rail-cta');
  if (cta) {
    cta.innerHTML = !temSessao()
      ? `<button class="btn btn--block btn--compacto" data-act="ir" data-hash="#/entrar">${ico('user')} Entrar</button>`
      : podePublicar()
        ? `<button class="btn btn--solid btn--block btn--compacto" data-act="novo-aviso" data-hash="#/publicar">${ico('plus')} Novo aviso</button>`
        : '';
  }
}

/* ---------- Camadas ---------- */

let focoAnterior = null;

function desenharCamadas() {
  const caixa = $('#camadas');
  const c = estado.camada;

  document.body.classList.toggle('com-camada', !!c);

  if (!c) {
    caixa.innerHTML = '';
    $('.layout').removeAttribute('inert');
    if (focoAnterior && document.contains(focoAnterior)) { try { focoAnterior.focus(); } catch (e) {} }
    focoAnterior = null;
    return;
  }

  if (!focoAnterior) focoAnterior = document.activeElement;
  caixa.innerHTML = desenhoDaCamada(c);
  $('.layout').setAttribute('inert', '');
  const alvo = caixa.querySelector('[data-foco]') || caixa.querySelector('button');
  if (alvo) { try { alvo.focus(); } catch (e) {} }

  activarMapas();
}

function desenhoDaCamada(c) {
  if (c.tipo === 'foto') return camadaFoto(c);
  if (c.tipo === 'anexo') return camadaAnexo(c);
  if (c.tipo === 'confirmar') return camadaConfirmar(c);
  if (c.tipo === 'palavra-de-outro') return camadaPalavraDeOutro(c);
  if (c.tipo === 'quadro') return camadaQuadro(c);
  if (c.tipo === 'lugar-escrito') return camadaLugarEscrito(c);
  if (c.tipo === 'lugar-mapa') return camadaLugarMapa(c);
  if (c.tipo === 'previsualizar') return camadaPrevisualizar();
  return '';
}

function fotosDe(p) {
  const lista = [];
  if (p.hero) lista.push(p.hero);
  (p.gallery || []).forEach((g) => lista.push(g));
  return lista;
}

function camadaFoto(c) {
  const p = Arquivo.aviso(c.postId);
  if (!p) return '';
  const fotos = fotosDe(p);
  const i = Math.max(0, Math.min(c.i, fotos.length - 1));
  const f = fotos[i];

  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Foto ${i + 1} de ${fotos.length}">
        <div class="lightbox__topo">
          <span class="lightbox__conta mono tnum">${i + 1} de ${fotos.length}</span>
          <button class="iconbtn" data-act="fechar-camada" data-foco aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="lightbox__palco">
          ${fotos.length > 1 ? `<button class="lightbox__seta lightbox__seta--esq" data-act="foto-passo" data-d="-1" aria-label="Foto anterior">${ico('chevron-left')}</button>` : ''}
          <div class="lightbox__frame">${imagem(f, 'lightbox__img', f.legenda)}</div>
          ${fotos.length > 1 ? `<button class="lightbox__seta lightbox__seta--dir" data-act="foto-passo" data-d="1" aria-label="Foto seguinte">${ico('chevron-right')}</button>` : ''}
        </div>
        <p class="lightbox__legenda">${esc(f.legenda || '')}</p>
      </div>
    </div>`;
}

function camadaAnexo(c) {
  const p = Arquivo.aviso(c.postId);
  if (!p) return '';
  const l = (p.links || [])[c.i];
  if (!l) return '';
  const d = l.destino || {};

  let corpo = '';
  if (l.type === 'map') {
    const temCoordenadas = d.lat != null && d.lon != null;
    const paraMaps = temCoordenadas ? d.lat + ',' + d.lon : (d.morada || l.meta || '');
    const legivel = d.morada || d.titulo || l.meta || '';
    corpo = `
      ${temCoordenadas
        ? `<div class="mapa-vivo mapa-vivo--visor" data-mapa-ver="${d.lat},${d.lon}"></div>`
        : `<div class="mapa"><div class="mapa__grelha" aria-hidden="true"></div><span class="mapa__pin">${ico('map')}</span></div>`}
      ${d.titulo ? `<p class="visor__titulo-lugar">${esc(d.titulo)}</p>` : ''}
      ${legivel && legivel !== d.titulo ? `<p class="visor__morada">${esc(legivel)}</p>` : ''}
      <div class="visor__accoes">
        <a class="btn btn--kraft" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(paraMaps)}"
           target="_blank" rel="noopener">${ico('map')} Abrir no Maps</a>
        ${legivel ? `<button class="btn btn--quiet" data-act="copiar" data-valor="${esc(legivel)}"
                data-msg="Morada copiada.">${ico('copy')} Copiar morada</button>` : ''}
      </div>`;
  } else if (l.type === 'pdf') {
    corpo = `
      <div class="pdf">
        ${Array.from({ length: Math.min(d.paginas || 2, 4) }).map((_, i) => `
          <span class="pdf__pagina"><span class="pdf__n mono">${i + 1}</span></span>`).join('')}
      </div>
      <p class="visor__morada">${esc(d.ficheiro || l.label)} · ${esc(d.tamanho || l.meta)}${d.paginas ? ' · ' + plural(d.paginas, 'página', 'páginas') : ''}</p>
      <div class="visor__accoes">
        <button class="btn btn--kraft" data-act="simular-descarga" data-valor="${esc(d.ficheiro || l.label)}">${ico('download')} Descarregar</button>
        <button class="btn btn--quiet" data-act="copiar" data-valor="${esc(d.ficheiro || l.label)}"
                data-msg="Nome do ficheiro copiado.">${ico('copy')} Copiar nome</button>
      </div>`;
  } else if (l.type === 'phone') {
    corpo = `
      <p class="visor__numero tnum">${esc(l.meta)}</p>
      <div class="visor__accoes">
        <a class="btn btn--kraft" href="tel:${esc(String(d.numero || l.meta).replace(/\s/g, ''))}">${ico('phone')} Ligar agora</a>
        <button class="btn btn--quiet" data-act="copiar" data-valor="${esc(l.meta)}"
                data-msg="Número copiado.">${ico('copy')} Copiar número</button>
      </div>`;
  } else {
    corpo = `
      <p class="visor__morada">${esc(d.url || l.meta)}</p>
      <div class="visor__accoes">
        <a class="btn btn--kraft" href="${esc(d.url || '#')}" target="_blank" rel="noopener">${ico('link')} Abrir a ligação</a>
        <button class="btn btn--quiet" data-act="copiar" data-valor="${esc(d.url || '')}"
                data-msg="Ligação copiada.">${ico('copy')} Copiar ligação</button>
      </div>`;
  }

  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="visor" role="dialog" aria-modal="true" aria-label="${esc(l.label)}">
        <div class="visor__topo">
          <span class="visor__titulo">${esc(l.label)}</span>
          <button class="iconbtn" data-act="fechar-camada" data-foco aria-label="Fechar">${ico('close')}</button>
        </div>
        ${corpo}
      </div>
    </div>`;
}

function camadaQuadro(c) {
  const novo = !c.id;
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dlg-q">
        <p class="dialogo__titulo" id="dlg-q">${novo ? 'Novo quadro' : 'Editar quadro'}</p>
        <label class="label">Nome
          <input class="field" id="quadro-nome" type="text" data-foco
                 value="${esc(c.nome || '')}" placeholder="Quórum de Élderes">
        </label>
        <label class="label">Nome curto
          <input class="field" id="quadro-curto" type="text"
                 value="${esc(c.curto || '')}" placeholder="Élderes">
        </label>
        <p class="nota">O nome curto é o que aparece nos separadores. Se ficar vazio, tira-se do nome.</p>
        <div class="dialogo__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada">Cancelar</button>
          <button class="btn btn--solid" data-act="quadro-guardar" data-id="${esc(c.id || '')}">
            ${novo ? 'Criar' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>`;
}

function camadaLugarEscrito(c) {
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dlg-l">
        <p class="dialogo__titulo" id="dlg-l">Onde é</p>
        <label class="label">Nome do lugar
          <input class="field" id="lugar-titulo" type="text" data-foco placeholder="Salão cultural da capela">
        </label>
        <label class="label">Morada (opcional)
          <input class="field" id="lugar-morada" type="text" placeholder="Rua de Tomar 45">
        </label>
        <div class="dialogo__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada">Cancelar</button>
          <button class="btn btn--solid" data-act="lugar-guardar-escrito" data-chave="${esc(c.chave)}">Usar</button>
        </div>
      </div>
    </div>`;
}

function camadaLugarMapa(c) {
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="visor visor--largo" role="dialog" aria-modal="true" aria-label="Marcar o lugar no mapa">
        <div class="visor__topo">
          <span class="visor__titulo">Marcar o lugar</span>
          <button class="iconbtn" data-act="fechar-camada" data-foco aria-label="Fechar">${ico('close')}</button>
        </div>
        <p class="nota">Mova o mapa até o alfinete ficar no sítio certo.</p>
        <div class="mapa-palco">
          <div class="mapa-vivo" id="mapa-escolher"></div>
          <span class="mapa-alfinete">${ico('map')}</span>
        </div>
        <label class="label">Nome do lugar
          <input class="field" id="lugar-titulo" type="text" placeholder="Salão cultural da capela">
        </label>
        <label class="label">Morada (opcional)
          <input class="field" id="lugar-morada" type="text" placeholder="Rua de Tomar 45">
        </label>
        <div class="visor__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada">Cancelar</button>
          <button class="btn btn--solid" data-act="lugar-guardar-mapa" data-chave="${esc(c.chave)}">Usar este lugar</button>
        </div>
      </div>
    </div>`;
}

function camadaPalavraDeOutro(c) {
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dlg-p">
        <p class="dialogo__titulo" id="dlg-p">Nova palavra-passe</p>
        <p class="dialogo__texto">Para a conta de ${esc(c.nome)}. Diga-lha por outro meio; ela pode mudá-la depois.</p>
        <input class="field" id="nova-palavra" type="text" data-foco
               placeholder="Pelo menos 8 caracteres" autocomplete="new-password">
        <div class="dialogo__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada">Cancelar</button>
          <button class="btn btn--solid" data-act="guardar-palavra-de-outro" data-id="${esc(c.id)}">Guardar</button>
        </div>
      </div>
    </div>`;
}

function camadaConfirmar(c) {
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
        <p class="dialogo__titulo" id="dlg-t">${esc(c.titulo)}</p>
        <p class="dialogo__texto">${esc(c.texto)}</p>
        <div class="dialogo__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada" data-foco>${esc(c.cancelar || 'Cancelar')}</button>
          <button class="btn ${c.perigo ? 'btn--danger' : 'btn--solid'}" data-act="${c.act}" data-id="${esc(c.id || '')}">
            ${esc(c.confirmar)}
          </button>
        </div>
      </div>
    </div>`;
}

function camadaPrevisualizar() {
  const p = avisoDoRascunho();
  return `
    <div class="camada camada--escura" data-act="fundo">
      <div class="visor visor--largo" role="dialog" aria-modal="true" aria-label="Pré-visualização">
        <div class="visor__topo">
          <span class="visor__titulo">Como vai ficar no quadro</span>
          <button class="iconbtn" data-act="fechar-camada" data-foco aria-label="Fechar">${ico('close')}</button>
        </div>
        <div class="previsao">
          ${fichaAviso(p)}
        </div>
        <div class="visor__accoes">
          <button class="btn btn--quiet" data-act="fechar-camada">Continuar a editar</button>
        </div>
      </div>
    </div>`;
}

/* ---------- Rascunho ---------- */

function avisoDoRascunho() {
  const v = estado.valores;
  const alvos = destinosResolvidos();
  const heroi = v.imagem || null;
  const fotos = Array.isArray(v.galeria) ? v.galeria : [];
  const links = [];
  const lugar = v.local || null;
  if (lugar && (lugar.titulo || lugar.morada)) {
    links.push({
      type: 'map',
      label: 'Ver o local no mapa',
      meta: lugar.titulo || lugar.morada,
      destino: {
        titulo: lugar.titulo || '',
        morada: lugar.morada || '',
        lat: lugar.lat ?? null,
        lon: lugar.lon ?? null
      }
    });
  }
  if (v.ligacao) {
    links.push({
      type: 'link',
      label: 'Abrir a ligação',
      // O endereço inteiro não cabe em lado nenhum e não diz nada a
      // ninguém: mostra-se o sítio, que é o que interessa saber.
      meta: dominioDe(v.ligacao),
      destino: { url: v.ligacao }
    });
  }
  if (v.pdf) links.push({ type: 'pdf', label: 'Descarregar o ficheiro', meta: v.pdf.tamanho || '', destino: { url: v.pdf.url, ficheiro: v.pdf.nome, tamanho: v.pdf.tamanho } });
  const contacto = v.contacto || {};
  if (contacto.telefone) {
    links.push({
      type: 'phone',
      label: contacto.nome ? 'Ligar a ' + contacto.nome : 'Ligar',
      meta: contacto.telefone,
      destino: { numero: contacto.telefone }
    });
  }

  const descricao = String(v.texto || '').trim();
  const s = sessao();

  return {
    id: estado.editingId || 'previsao',
    boards: alvos.length ? alvos : [(s && s.board) || 'ala'],
    kind: v.tipo || 'Aviso',
    date: agoraLegivel(),
    isNew: false,
    title: String(v.titulo || '').trim() || 'Sem título',
    summary: descricao.split('\n')[0].slice(0, 140) || 'Sem descrição',
    body: descricao ? descricao.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean) : [],
    when: v.data
      ? { day: dataLegivel(v.data), time: horaLegivel(v.data), place: (lugar && (lugar.titulo || lugar.morada)) || '' }
      : null,
    hero: heroi,
    gallery: fotos,
    links: links,
    contact: contacto.telefone
      ? { name: contacto.nome || (s && s.nome) || '', phone: contacto.telefone, note: contacto.nota || '' }
      : null,
    author: (s && s.nome) || '',
    authorRole: alvos.length ? nomeQuadro(alvos[0]) : '',
    autorId: (s && s.utilizador) || ''
  };
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dataLegivel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const nome = DIAS[d.getDay()];
  return nome.charAt(0).toUpperCase() + nome.slice(1) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

function horaLegivel(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/* Um aviso novo abre já com as duas partes que nenhum aviso dispensa;
   o resto acrescenta-se pela paleta. Folha limpa, mas utilizável. */
const PARTES_DE_ORIGEM = ['titulo', 'texto'];

function limparRascunho() {
  estado.blocks = PARTES_DE_ORIGEM.slice();
  estado.valores = {};
  estado.editingId = null;
  estado.mode = 'mine';
  estado.picked = [];
}

function carregarParaEdicao(p) {
  estado.editingId = p.id;
  estado.valores = {};
  estado.blocks = [];

  const juntar = (chave, valor) => {
    if (valor === undefined || valor === null || valor === '') return;
    estado.blocks.push(chave);
    estado.valores[chave] = valor;
  };

  juntar('titulo', p.title);
  if (p.hero) juntar('imagem', p.hero);
  if (p.when && p.when.day) estado.valores.data = estado.valores.data || '';
  juntar('texto', (p.body || []).join('\n\n'));
  const ligacaoMapa = (p.links || []).find((l) => l.type === 'map');
  if (ligacaoMapa) {
    const d = ligacaoMapa.destino || {};
    juntar('local', {
      titulo: d.titulo || ligacaoMapa.meta || '',
      morada: d.morada || '',
      lat: d.lat ?? null, lon: d.lon ?? null
    });
  } else if (p.when && p.when.place) {
    juntar('local', { titulo: p.when.place, morada: '', lat: null, lon: null });
  }
  if ((p.gallery || []).length) juntar('galeria', p.gallery);
  const lig = (p.links || []).find((l) => l.type === 'link');
  if (lig) juntar('ligacao', (lig.destino && lig.destino.url) || lig.meta);
  const pdf = (p.links || []).find((l) => l.type === 'pdf');
  if (pdf) juntar('pdf', { nome: (pdf.destino && pdf.destino.ficheiro) || pdf.label, tamanho: (pdf.destino && pdf.destino.tamanho) || pdf.meta });
  if (p.contact && p.contact.phone) {
    juntar('contacto', { nome: p.contact.name || '', telefone: p.contact.phone, nota: p.contact.note || '' });
  }

  estado.valores.tipo = p.kind;
  const permitidos = Arquivo.quadrosPermitidos();
  estado.picked = (p.boards || []).filter((id) => permitidos.indexOf(id) > -1);
  estado.mode = estado.picked.length > 1 ? 'pick' : (estado.picked.length === 1 && sessao() && estado.picked[0] === sessao().board ? 'mine' : 'pick');
}

function haConteudo() {
  return estado.blocks.length > 0 && Object.keys(estado.valores).some((k) => {
    const v = estado.valores[k];
    return v && (typeof v === 'string' ? v.trim() : true);
  });
}

/* ---------- Ficheiros ---------- */

/* Reduz a imagem antes de a subir: poupa dados de quem publica do telemóvel
   e evita que o servidor guarde ficheiros de 8 MB sem necessidade. */
function reduzirImagem(ficheiro) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(ficheiro);
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const medidas = w + '×' + h;
      const max = CONFIG.ladoMaximoImagem;
      if (w > max) { h = Math.round(h * max / w); w = max; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(
        (blob) => resolve(blob ? { blob: blob, nome: ficheiro.name, medidas: medidas } : null),
        'image/jpeg',
        CONFIG.qualidadeImagem
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const emKB = (n) => (n < 1024 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

async function receberFicheiros(chave, ficheiros) {
  const b = BLOCKS[chave];
  const lista = Array.from(ficheiros || []);
  if (!lista.length) return;

  const zona = $(`[data-largar="${chave}"]`);
  if (zona) zona.classList.add('drop--aSubir');
  aviso(lista.length === 1 ? 'A enviar o ficheiro…' : 'A enviar os ficheiros…');

  try {
    if (b.accept === 'application/pdf') {
      const f = lista[0];
      const subido = await Api.subirFicheiro(f, f.name);
      estado.valores[chave] = {
        url: subido.url, nome: subido.nome || f.name,
        tamanho: subido.tamanho || emKB(f.size)
      };
      desenhar();
      aviso('«' + (subido.nome || f.name) + '» anexado.');
      return;
    }

    const imagens = lista.filter((f) => /^image\//.test(f.type));
    if (!imagens.length) { limparAviso(); aviso('Escolha um ficheiro de imagem.'); return; }

    const preparadas = (await Promise.all(imagens.map(reduzirImagem))).filter(Boolean);
    if (!preparadas.length) { limparAviso(); aviso('Não foi possível ler essa imagem.'); return; }

    const subidas = await Promise.all(preparadas.map(async (r) => {
      const dados = await Api.subirFicheiro(r.blob, r.nome);
      return {
        url: dados.url, nome: dados.nome || r.nome,
        medidas: dados.medidas || r.medidas, legenda: dados.nome || r.nome
      };
    }));

    if (b.campo === 'ficheiros') {
      const antes = Array.isArray(estado.valores[chave]) ? estado.valores[chave] : [];
      estado.valores[chave] = antes.concat(subidas);
    } else {
      estado.valores[chave] = subidas[0];
    }
    desenhar();
    aviso(subidas.length === 1 ? 'Imagem carregada.' : plural(subidas.length, 'imagem carregada', 'imagens carregadas') + '.');
  } catch (err) {
    avisoDeErro(err, null);
  } finally {
    const z = $(`[data-largar="${chave}"]`);
    if (z) z.classList.remove('drop--aSubir');
  }
}

/* Enquanto um pedido está em voo o botão diz-no e não aceita segundo clique. */
function marcarEnvio(el, aEnviar) {
  estado.aEnviar = !!aEnviar;
  if (!aEnviar) {
    // O ecrã pode ter mudado entretanto: limpa-se o estado onde quer que tenha ficado.
    $$('.btn--aEnviar').forEach((b) => {
      b.classList.remove('btn--aEnviar');
      b.removeAttribute('aria-busy');
      if (b.tagName === 'BUTTON') b.disabled = false;
    });
  }
  if (!el || !el.classList) return;
  el.classList.toggle('btn--aEnviar', !!aEnviar);
  if (aEnviar) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
  if (el.tagName === 'BUTTON') el.disabled = !!aEnviar;
}

/* O servidor pode devolver erros por campo: mostram-se junto de cada um. */
function mostrarCamposComErro(campos) {
  Object.keys(campos || {}).forEach((nome) => {
    const chave = { title: 'titulo', body: 'texto', when: 'data', contact: 'contacto' }[nome] || nome;
    const campo = $('#c-' + chave);
    if (!campo) return;
    campo.setAttribute('aria-invalid', 'true');
    const bloco = campo.closest('.block');
    if (bloco && !bloco.querySelector('.erro-campo')) {
      const p = document.createElement('p');
      p.className = 'erro-campo';
      p.textContent = campos[nome];
      bloco.appendChild(p);
    }
  });
}

/* Mostra o erro numa mensagem, com repetição quando faz sentido tentar de novo. */
function avisoDeErro(err, repetir) {
  const msg = (err && err.mensagem) || 'Algo correu mal.';
  const podeRepetir = err && (err.codigo === 'rede' || err.codigo === 'tempo' || err.codigo === 'servidor');
  aviso(msg, podeRepetir && repetir ? { etiqueta: 'Tentar de novo', act: repetir } : null);
}

/* ---------- Ações ---------- */

const ACCOES = {
  ir: (el) => ir(el.dataset.hash),

  voltar: (el) => voltar(el.dataset.hash),

  'abrir-aviso': (el) => {
    // Não se espera pelo servidor para abrir: a marca cai já na cache.
    Arquivo.marcarLido(el.dataset.id);
    ir('#/aviso/' + el.dataset.id);
  },

  'abrir-quadro': (el) => ir('#/quadro/' + el.dataset.id),

  'novo-aviso': (el) => {
    if (haConteudo() && !estado.editingId) {
      abrirCamada({
        tipo: 'confirmar', titulo: 'Já tem um aviso a meio',
        texto: 'Começar um novo descarta o que escreveu.',
        confirmar: 'Começar de novo', cancelar: 'Continuar o atual',
        act: 'confirmar-novo', perigo: true, id: el.dataset.hash
      });
      return;
    }
    limparRascunho();
    ir(el.dataset.hash || '#/publicar');
  },

  'confirmar-novo': (el) => {
    const destino = el.dataset.id || '#/publicar';
    limparRascunho();
    fecharCamada(true);
    ir(destino);
  },

  editar: (el) => ir('#/editar/' + el.dataset.id),

  'ler-tudo': async () => {
    try {
      const n = await Arquivo.marcarTudoLido();
      aviso(n ? plural(n, 'aviso marcado como lido', 'avisos marcados como lidos') + '.' : 'Já estava tudo lido.');
    } catch (err) {
      avisoDeErro(err, 'ler-tudo');
    }
  },

  filtro: (el) => { estado.filtro = el.dataset.tipo || null; desenhar(); },

  tipo: (el) => { estado.valores.tipo = el.dataset.tipo; desenhar(); },

  ordem: () => { estado.ordem = estado.ordem === 'recentes' ? 'antigos' : 'recentes'; desenhar(); },

  /* --- procura: nunca redesenhar o ecrã inteiro, para não matar o foco --- */
  atalho: (el) => {
    const q = el.dataset.q;
    estado.query = estado.query.trim().toLowerCase() === q.toLowerCase() ? '' : q;
    const campo = $('#q');
    if (campo) { campo.value = estado.query; campo.focus(); }
    actualizarProcura();
  },

  'limpar-procura': () => {
    estado.query = '';
    const campo = $('#q');
    if (campo) { campo.value = ''; campo.focus(); }
    actualizarProcura();
  },

  /* --- criar aviso --- */
  'juntar-bloco': (el) => {
    const k = el.dataset.chave;
    if (estado.blocks.indexOf(k) < 0) estado.blocks.push(k);
    desenhar();
    const campo = $('#c-' + k);
    if (campo && campo.focus) campo.focus();
  },

  'tirar-bloco': (el) => {
    const i = Number(el.dataset.i);
    const chave = estado.blocks[i];
    const tinha = estado.valores[chave];
    const guardado = tinha;
    estado.blocks.splice(i, 1);
    delete estado.valores[chave];
    desenhar();
    if (tinha) {
      aviso('«' + BLOCKS[chave].label + '» retirada.', {
        etiqueta: 'Anular', act: 'repor-bloco', id: chave
      });
      ACCOES._blocoGuardado = { chave: chave, valor: guardado, i: i };
    }
  },

  'repor-bloco': () => {
    const g = ACCOES._blocoGuardado;
    if (!g) return;
    estado.blocks.splice(Math.min(g.i, estado.blocks.length), 0, g.chave);
    estado.valores[g.chave] = g.valor;
    ACCOES._blocoGuardado = null;
    limparAviso();
    desenhar();
  },

  mover: (el) => {
    const i = Number(el.dataset.i), d = Number(el.dataset.d);
    const j = i + d;
    if (j < 0 || j >= estado.blocks.length) return;
    const t = estado.blocks[i];
    estado.blocks[i] = estado.blocks[j];
    estado.blocks[j] = t;
    desenhar();
    const botao = $(`[data-act="mover"][data-i="${j}"][data-d="${d}"]`);
    if (botao) botao.focus();
  },

  'limpar-ficheiro': (el) => {
    delete estado.valores[el.dataset.chave];
    desenhar();
  },

  'tirar-foto': (el) => {
    const chave = el.dataset.chave, i = Number(el.dataset.i);
    const lista = estado.valores[chave] || [];
    lista.splice(i, 1);
    if (!lista.length) delete estado.valores[chave];
    desenhar();
  },

  descartar: () => {
    if (!haConteudo()) { limparRascunho(); voltar('#/a-minha-conta'); return; }
    abrirCamada({
      tipo: 'confirmar', titulo: 'Descartar este aviso?',
      texto: 'O que escreveu não fica guardado.',
      confirmar: 'Descartar', cancelar: 'Continuar a editar',
      act: 'confirmar-descartar', perigo: true
    });
  },

  'confirmar-descartar': () => {
    limparRascunho();
    fecharCamada(true);
    substituir('#/a-minha-conta');
    aviso('Aviso descartado.');
  },

  modo: (el) => {
    estado.mode = el.dataset.mode;
    if (estado.mode === 'pick' && !estado.picked.length) {
      const meu = sessao() && sessao().board;
      if (meu) estado.picked = [meu];
    }
    desenhar();
  },

  'modo-bloqueado': () => {
    aviso(ehBispado()
      ? 'Não tem permissão para publicar neste quadro.'
      : 'Só o bispado pode publicar fora dos seus quadros.');
  },

  marcar: (el) => {
    const id = el.dataset.id;
    const i = estado.picked.indexOf(id);
    if (i > -1) estado.picked.splice(i, 1); else estado.picked.push(id);
    desenhar();
  },

  previsualizar: () => abrirCamada({ tipo: 'previsualizar' }),

  publicar: async (el) => {
    const alvos = destinosResolvidos();
    if (!alvos.length) { aviso('Escolha pelo menos um quadro.'); return; }
    if (estado.aEnviar) return;

    const base = avisoDoRascunho();
    const editar = estado.editingId;
    marcarEnvio(el, true);

    try {
      if (editar) {
        const p = await Arquivo.atualizar(editar, {
          boards: alvos, kind: base.kind, title: base.title, summary: base.summary,
          body: base.body, when: base.when, hero: base.hero, gallery: base.gallery,
          links: base.links, contact: base.contact
        });
        limparRascunho();
        substituir('#/aviso/' + p.id);
        aviso('Alterações guardadas.');
      } else {
        delete base.id;
        await Arquivo.criar(Arquivo.paraEnvio(Object.assign(base, { boards: alvos })));
        limparRascunho();
        substituir('#/a-minha-conta');
        aviso('Publicado em ' + alvos.map(nomeQuadro).join(', ') + '.');
      }
    } catch (err) {
      if (err.campos) mostrarCamposComErro(err.campos);
      avisoDeErro(err, 'publicar');
    } finally {
      marcarEnvio(el, false);
    }
  },

  /* --- eliminar --- */
  'pedir-eliminar': (el) => {
    const p = Arquivo.aviso(el.dataset.id);
    if (!p) return;
    abrirCamada({
      tipo: 'confirmar', titulo: 'Eliminar «' + p.title + '»?',
      texto: 'Deixa de aparecer no quadro e nas novidades.',
      confirmar: 'Eliminar', act: 'confirmar-eliminar', id: p.id, perigo: true
    });
  },

  'confirmar-eliminar': async (el) => {
    const id = el.dataset.id;
    const noProprio = estado.ecra === 'post' && estado.postId === id;
    marcarEnvio(el, true);
    try {
      const r = await Arquivo.eliminar(id);
      fecharCamada(noProprio);
      if (!r) return;
      estado.eliminado = r;
      if (noProprio) substituir('#/a-minha-conta');
      aviso('«' + r.aviso.title + '» eliminado.', { etiqueta: 'Anular', act: 'anular-eliminar' });
    } catch (err) {
      avisoDeErro(err, null);
    } finally {
      marcarEnvio(el, false);
    }
  },

  'anular-eliminar': async () => {
    if (!estado.eliminado) return;
    const guardado = estado.eliminado;
    estado.eliminado = null;
    limparAviso();
    try {
      await Arquivo.restaurar(guardado.aviso, guardado.indice);
      aviso('«' + guardado.aviso.title + '» reposto.');
    } catch (err) {
      estado.eliminado = guardado;
      avisoDeErro(err, 'anular-eliminar');
    }
  },

  /* --- camadas --- */
  foto: (el) => {
    const p = Arquivo.aviso(el.dataset.id);
    if (!p) return;
    const i = Number(el.dataset.i);
    abrirCamada({ tipo: 'foto', postId: p.id, i: i < 0 ? 0 : (p.hero ? i + 1 : i) });
  },

  'foto-passo': (el) => {
    const c = estado.camada;
    if (!c || c.tipo !== 'foto') return;
    const p = Arquivo.aviso(c.postId);
    const n = fotosDe(p).length;
    c.i = (c.i + Number(el.dataset.d) + n) % n;
    desenharCamadas();
  },

  anexo: (el) => abrirCamada({ tipo: 'anexo', postId: el.dataset.id, i: Number(el.dataset.i) }),

  'fechar-camada': () => fecharCamada(),

  fundo: (el, ev) => { if (ev.target === el) fecharCamada(); },

  /* --- partilhar e copiar --- */
  partilhar: async (el) => {
    const p = Arquivo.aviso(el.dataset.id);
    if (!p) return;
    const url = location.href.split('#')[0] + '#/aviso/' + p.id;
    if (navigator.share) {
      try { await navigator.share({ title: p.title, url: url }); return; } catch (e) { /* cancelou */ }
    }
    aviso((await copiar(url)) ? 'Ligação copiada.' : 'Não foi possível copiar a ligação.');
  },

  copiar: async (el) => {
    const ok = await copiar(el.dataset.valor);
    aviso(ok ? (el.dataset.msg || 'Copiado.') : 'Não foi possível copiar.');
  },

  'copiar-numero': async (el) => {
    aviso((await copiar(el.dataset.valor)) ? 'Número copiado.' : 'Não foi possível copiar.');
  },

  'simular-descarga': (el) => {
    aviso('Simulação: «' + el.dataset.valor + '» seria guardado em Transferências.');
  },

  /* --- sessão --- */
  'ver-palavra': (el) => {
    const campo = $('#campo-palavra');
    if (!campo) return;
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    el.setAttribute('aria-label', mostrar ? 'Ocultar a palavra-passe' : 'Mostrar a palavra-passe');
    el.classList.toggle('palavra__olho--on', mostrar);
    campo.focus();
  },

  sair: () => {
    abrirCamada({
      tipo: 'confirmar', titulo: 'Sair da conta?',
      texto: 'Pode continuar a ler os avisos sem sessão iniciada.',
      confirmar: 'Sair', act: 'confirmar-sair'
    });
  },

  'confirmar-sair': async () => {
    fecharCamada(true);
    limparRascunho();
    await Arquivo.sair();
    substituir('#/novidades');
    aviso('Sessão terminada. Pode continuar a ler os avisos.');
  },

  'recarregar-tudo': async () => {
    limparAviso();
    await Arquivo.arrancar();
    encaminhar();
  },

  /* --- notificações --- */
  'notif-ativar': async (el) => {
    marcarEnvio(el, true);
    try {
      await PWA.notificacoes.ativar();
      aviso('Pronto. Vai ser avisado quando alguém publicar.');
    } catch (err) {
      aviso(err.mensagem || err.message);
    } finally {
      marcarEnvio(el, false);
      desenharNotificacoes();
    }
  },

  'notif-desativar': async (el) => {
    marcarEnvio(el, true);
    try {
      await PWA.notificacoes.desativar();
      aviso('Deixou de receber notificações neste aparelho.');
    } catch (err) {
      aviso(err.mensagem || err.message);
    } finally {
      marcarEnvio(el, false);
      desenharNotificacoes();
    }
  },

  'convidar-instalar': () => { if (typeof PWA !== 'undefined') PWA.convidar(); },

  'quadro-novo': () => abrirCamada({ tipo: 'quadro' }),

  'quadro-editar': (el) => abrirCamada({
    tipo: 'quadro', id: el.dataset.id, nome: el.dataset.nome, curto: el.dataset.curto
  }),

  'quadro-guardar': async (el) => {
    const nome = (($('#quadro-nome') || {}).value || '').trim();
    const curto = (($('#quadro-curto') || {}).value || '').trim();
    if (!nome) { aviso('O quadro precisa de um nome.'); return; }

    marcarEnvio(el, true);
    try {
      if (el.dataset.id) await Arquivo.editarQuadro(el.dataset.id, { name: nome, short: curto });
      else await Arquivo.criarQuadro({ name: nome, short: curto });
      await Arquivo.recarregarQuadros();
      fecharCamada(true);
      desenhar();
      aviso(el.dataset.id ? 'Quadro atualizado.' : '«' + nome + '» criado.');
    } catch (err) {
      avisoDeErro(err, null);
    } finally { marcarEnvio(el, false); }
  },

  'pedir-apagar-quadro': (el) => {
    abrirCamada({
      tipo: 'confirmar', titulo: 'Apagar «' + el.dataset.nome + '»?',
      texto: 'O quadro deixa de existir para toda a gente.',
      confirmar: 'Apagar', act: 'confirmar-apagar-quadro', id: el.dataset.id, perigo: true
    });
  },

  'confirmar-apagar-quadro': async (el) => {
    marcarEnvio(el, true);
    try {
      await Arquivo.apagarQuadro(el.dataset.id);
      await Arquivo.recarregarQuadros();
      fecharCamada(true);
      desenhar();
      aviso('Quadro apagado.');
    } catch (err) {
      fecharCamada(true);
      avisoDeErro(err, null);
    } finally { marcarEnvio(el, false); }
  },

  'lugar-novo-escrito': () => abrirCamada({ tipo: 'lugar-escrito', destino: 'guardado', valor: {} }),
  'lugar-novo-mapa': () => abrirCamada({ tipo: 'lugar-mapa', destino: 'guardado', valor: {} }),

  'pedir-apagar-lugar': (el) => {
    abrirCamada({
      tipo: 'confirmar', titulo: 'Apagar «' + el.dataset.titulo + '»?',
      texto: 'Deixa de aparecer como atalho. Os avisos que já o usam ficam como estão.',
      confirmar: 'Apagar', act: 'confirmar-apagar-lugar', id: el.dataset.id, perigo: true
    });
  },

  'confirmar-apagar-lugar': async (el) => {
    marcarEnvio(el, true);
    try {
      await Arquivo.apagarLugar(el.dataset.id);
      await Arquivo.recarregarLugares();
      fecharCamada(true);
      desenhar();
      aviso('Lugar apagado.');
    } catch (err) {
      avisoDeErro(err, null);
    } finally { marcarEnvio(el, false); }
  },

  'lugar-guardado': (el) => {
    const l = Arquivo.lugares().find((x) => x.id === el.dataset.id);
    if (!l) return;
    estado.valores[el.dataset.chave] = { titulo: l.titulo, morada: l.morada, lat: l.lat, lon: l.lon };
    desenhar();
  },

  'lugar-trocar': (el) => {
    delete estado.valores[el.dataset.chave];
    desenhar();
  },

  'lugar-escrever': (el) => {
    abrirCamada({ tipo: 'lugar-escrito', chave: el.dataset.chave, valor: {} });
  },

  'lugar-mapa': (el) => {
    abrirCamada({ tipo: 'lugar-mapa', chave: el.dataset.chave, valor: {} });
  },

  'lugar-guardar-escrito': (el) => aplicarLugar(el, null, null),

  'lugar-guardar-mapa': (el) => {
    const c = estado.camada;
    if (!c || c.lat == null) { aviso('Mova o mapa até o alfinete ficar no sítio certo.'); return; }
    return aplicarLugar(el, c.lat, c.lon);
  },

  'contacto-sou-eu': (el) => {
    const s = sessao();
    if (!s) return;
    const chave = el.dataset.chave;
    const obj = estado.valores[chave] || (estado.valores[chave] = {});
    obj.nome = obj.nome === s.nome ? '' : s.nome;
    desenhar();
  },

  /* --- contas --- */
  'forma-papel': (el) => {
    estado.forma.papel = el.dataset.papel;
    if (estado.forma.papel !== 'presidencia') estado.forma.quadros = [];
    guardarFormaVisivel();
    desenhar();
  },

  'forma-quadro': (el) => {
    const id = el.dataset.id;
    const q = estado.forma.quadros || (estado.forma.quadros = []);
    const i = q.indexOf(id);
    if (i > -1) q.splice(i, 1); else q.push(id);
    guardarFormaVisivel();
    desenhar();
  },

  'forma-ativo': () => {
    estado.forma.ativo = estado.forma.ativo === false;
    guardarFormaVisivel();
    desenhar();
  },

  'pedir-palavra': (el) => {
    abrirCamada({
      tipo: 'palavra-de-outro', id: el.dataset.id, nome: el.dataset.nome
    });
  },

  'guardar-palavra-de-outro': async (el) => {
    const campo = $('#nova-palavra');
    const valor = campo ? campo.value : '';
    if (valor.length < 8) { aviso('A palavra-passe tem de ter pelo menos 8 caracteres.'); return; }
    marcarEnvio(el, true);
    try {
      await Arquivo.reporPalavra(el.dataset.id, valor);
      fecharCamada(true);
      aviso('Palavra-passe alterada. Diga-lha por outro meio.');
    } catch (err) {
      avisoDeErro(err, null);
    } finally {
      marcarEnvio(el, false);
    }
  },

  'pedir-apagar-conta': (el) => {
    abrirCamada({
      tipo: 'confirmar', titulo: 'Apagar a conta de ' + el.dataset.nome + '?',
      texto: 'Deixa de poder entrar. Os avisos que publicou ficam no quadro.',
      confirmar: 'Apagar', act: 'confirmar-apagar-conta', id: el.dataset.id, perigo: true
    });
  },

  'confirmar-apagar-conta': async (el) => {
    marcarEnvio(el, true);
    try {
      await Arquivo.apagarConta(el.dataset.id);
      estado.contas = (estado.contas || []).filter((c) => String(c.id) !== String(el.dataset.id));
      fecharCamada(true);
      desenhar();
      aviso('Conta apagada.');
    } catch (err) {
      avisoDeErro(err, null);
    } finally {
      marcarEnvio(el, false);
    }
  },

  'fechar-aviso': () => limparAviso()
};

/* O mesmo diálogo serve para escolher o lugar de um aviso e para
   guardar um lugar habitual: quem o abriu é que decide para onde vai. */
async function aplicarLugar(el, lat, lon) {
  const c = estado.camada;
  const titulo = (($('#lugar-titulo') || {}).value || '').trim();
  const morada = (($('#lugar-morada') || {}).value || '').trim();

  if (!titulo && !morada) { aviso('Escreva pelo menos o nome do lugar.'); return; }
  if (lat != null && !titulo) { aviso('Dê um nome ao lugar, para não aparecerem coordenadas.'); return; }

  const lugar = { titulo: titulo || morada, morada: morada, lat: lat, lon: lon };

  if (c && c.destino === 'guardado') {
    marcarEnvio(el, true);
    try {
      await Arquivo.criarLugar(lugar);
      await Arquivo.recarregarLugares();
      fecharCamada(true);
      desenhar();
      aviso('Lugar guardado.');
    } catch (err) {
      avisoDeErro(err, null);
    } finally { marcarEnvio(el, false); }
    return;
  }

  estado.valores[el.dataset.chave] = lugar;
  fecharCamada(true);
  desenhar();
}

/* Redesenhar o formulário apagaria o que já estava escrito: passa-se
   primeiro para o estado. */
function guardarFormaVisivel() {
  const u = $('#f-utilizador'), n = $('#f-nome'), pw = $('#f-palavra');
  if (u) estado.forma.utilizador = u.value;
  if (n) estado.forma.nome = n.value;
  if (pw) estado.forma.palavra = pw.value;
}

function actualizarProcura() {
  const lista = $('#results');
  if (lista) lista.innerHTML = resultados();
  const conta = $('#contagem');
  if (conta) conta.textContent = textoContagem();
  const limpar = $('[data-act="limpar-procura"].procura__limpar');
  if (limpar) limpar.hidden = !estado.query;
  const q = estado.query.trim().toLowerCase();
  $$('[data-act="atalho"]').forEach((c) =>
    c.setAttribute('aria-pressed', String(c.dataset.q.toLowerCase() === q)));
}

/* ---------- Escutas ---------- */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    if (el.dataset.act !== 'modo-bloqueado') return;
  }
  const fn = ACCOES[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && !el.getAttribute('target')) ev.preventDefault();
  fn(el, ev);
});

/* Campos do formulário: guardar sem redesenhar, para o teclado não fechar. */
document.addEventListener('input', (ev) => {
  const alvo = ev.target;

  if (alvo.id === 'q') {
    estado.query = alvo.value;
    actualizarProcura();
    return;
  }

  const composto = alvo.dataset && alvo.dataset.campoSub;
  if (composto) {
    const [chaveC, parte] = composto.split(':');
    const obj = estado.valores[chaveC] || (estado.valores[chaveC] = {});
    obj[parte] = alvo.value;
    return;
  }

  const chave = alvo.dataset && alvo.dataset.campo;
  if (!chave) return;
  estado.valores[chave] = alvo.value;

  if (chave === 'titulo') {
    const avancar = $('.compose__avancar .btn');
    const nota = $('.compose__avancar .nota');
    const pode = estado.blocks.length > 0 && !!alvo.value.trim();
    if (avancar) avancar.disabled = !pode;
    if (nota) nota.hidden = pode;
  }
});

document.addEventListener('change', (ev) => {
  const chave = ev.target.dataset && ev.target.dataset.ficheiro;
  if (!chave) return;
  receberFicheiros(chave, ev.target.files);
});

/* Largar ficheiros em cima da zona tracejada. */
document.addEventListener('dragover', (ev) => {
  if (ev.target.closest('[data-largar]')) { ev.preventDefault(); ev.target.closest('[data-largar]').classList.add('drop--sobre'); }
});
document.addEventListener('dragleave', (ev) => {
  const z = ev.target.closest('[data-largar]');
  if (z) z.classList.remove('drop--sobre');
});
document.addEventListener('drop', (ev) => {
  const z = ev.target.closest('[data-largar]');
  if (!z) return;
  ev.preventDefault();
  z.classList.remove('drop--sobre');
  receberFicheiros(z.dataset.largar, ev.dataTransfer.files);
});

document.addEventListener('submit', (ev) => {
  if (ev.target.id === 'form-entrar') {
    ev.preventDefault();
    const u = $('#campo-utilizador'), pw = $('#campo-palavra'), erro = $('#erro-entrar');
    const semU = !u.value.trim(), semP = !pw.value.trim();
    u.setAttribute('aria-invalid', String(semU));
    pw.setAttribute('aria-invalid', String(semP));
    if (semU || semP) {
      erro.textContent = semU
        ? 'Escreva o seu utilizador para entrar.'
        : 'Escreva a palavra-passe para entrar.';
      erro.hidden = false;
      (semU ? u : pw).focus();
      return;
    }
    erro.hidden = true;
    const botao = ev.target.querySelector('button[type="submit"]');
    const destino = estado.destinoAposEntrar || '#/a-minha-conta';
    marcarEnvio(botao, true);

    Arquivo.entrar(u.value.trim(), pw.value).then(() => {
      marcarEnvio(botao, false);
      substituir(destino);
      aviso('Sessão iniciada. Já pode publicar.');
    }).catch((err) => {
      marcarEnvio(botao, false);
      erro.textContent = err.codigo === 'autenticacao'
        ? 'Utilizador ou palavra-passe errados.'
        : err.mensagem;
      erro.hidden = false;
      u.setAttribute('aria-invalid', String(err.codigo === 'autenticacao'));
      pw.setAttribute('aria-invalid', String(err.codigo === 'autenticacao'));
      pw.focus();
    });
    return;
  }

  if (ev.target.id === 'form-conta') {
    ev.preventDefault();
    guardarFormaVisivel();
    const erro = $('#erro-conta');
    const botao = ev.target.querySelector('button[type="submit"]');
    const nova = !estado.contaId;
    const f = estado.forma;

    const falta = [];
    if (nova && !String(f.utilizador || '').trim()) falta.push('o utilizador');
    if (!String(f.nome || '').trim()) falta.push('o nome');
    if (nova && String(f.palavra || '').length < 8) falta.push('uma palavra-passe de 8 caracteres ou mais');
    if (f.papel === 'presidencia' && !(f.quadros || []).length) falta.push('pelo menos um quadro');
    if (falta.length) {
      erro.textContent = 'Falta ' + falta.join(', ') + '.';
      erro.hidden = false;
      return;
    }
    erro.hidden = true;
    marcarEnvio(botao, true);

    const corpo = {
      nome: String(f.nome).trim(),
      papel: f.papel,
      quadros: f.papel === 'presidencia' ? f.quadros : []
    };
    if (nova) { corpo.utilizador = String(f.utilizador).trim(); corpo.palavra = f.palavra; }
    else corpo.ativo = f.ativo !== false;

    const promessa = nova
      ? Arquivo.criarConta(corpo)
      : Arquivo.editarConta(estado.contaId, corpo);

    promessa.then(() => {
      estado.contas = null;           // obriga a recarregar a lista
      estado.forma = {};
      substituir('#/contas');
      aviso(nova ? 'Conta criada.' : 'Conta atualizada.');
    }).catch((err) => {
      erro.textContent = err.campos
        ? Object.values(err.campos).join(' ')
        : err.mensagem;
      erro.hidden = false;
    }).finally(() => marcarEnvio(botao, false));
    return;
  }

  if (ev.target.id === 'form-palavra') {
    ev.preventDefault();
    const atual = $('#p-atual').value, nova = $('#p-nova').value, repete = $('#p-repete').value;
    const erro = $('#erro-palavra');
    const botao = ev.target.querySelector('button[type="submit"]');

    if (!atual) { erro.textContent = 'Escreva a palavra-passe atual.'; erro.hidden = false; $('#p-atual').focus(); return; }
    if (nova.length < 8) { erro.textContent = 'A nova tem de ter pelo menos 8 caracteres.'; erro.hidden = false; $('#p-nova').focus(); return; }
    if (nova !== repete) { erro.textContent = 'As duas não coincidem.'; erro.hidden = false; $('#p-repete').focus(); return; }
    erro.hidden = true;
    marcarEnvio(botao, true);

    Arquivo.mudarPalavra(atual, nova).then(() => {
      substituir('#/a-minha-conta');
      aviso('Palavra-passe alterada.');
    }).catch((err) => {
      erro.textContent = err.campos ? Object.values(err.campos).join(' ') : err.mensagem;
      erro.hidden = false;
    }).finally(() => marcarEnvio(botao, false));
    return;
  }

  if (ev.target.classList.contains('procura')) {
    ev.preventDefault();
    const campo = $('#q');
    if (campo) campo.blur();
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (estado.camada) { fecharCamada(); return; }
    if (document.activeElement && document.activeElement.id === 'q' && estado.query) {
      ACCOES['limpar-procura']();
      return;
    }
    const caixa = $('#toast');
    if (caixa && !caixa.hidden) limparAviso();
    return;
  }

  if (estado.camada && estado.camada.tipo === 'foto') {
    if (ev.key === 'ArrowLeft')  { ACCOES['foto-passo']({ dataset: { d: '-1' } }); ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { ACCOES['foto-passo']({ dataset: { d: '1' } }); ev.preventDefault(); }
    return;
  }

  // Setas nos separadores de quadro
  const sep = ev.target.closest && ev.target.closest('.boardtab');
  if (sep && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
    const todos = $$('.boardtab');
    const i = todos.indexOf(sep);
    const j = (i + (ev.key === 'ArrowRight' ? 1 : -1) + todos.length) % todos.length;
    todos[j].focus();
    ev.preventDefault();
  }
});

/* ---------- Arranque ---------- */

function itensDeNav(cls, curto) {
  return navVisivel().map((n) => `
    <button class="${cls}" data-nav="${n.id}" data-act="ir" data-hash="${n.hash}">
      ${ico(n.ico)}<span>${curto && n.curto ? n.curto : n.etiqueta}</span>
    </button>`).join('');
}

function montarEstrutura() {
  $('#tabbar').innerHTML      = itensDeNav('tabbar__item', true);
  $('#toprail-nav').innerHTML = itensDeNav('toprail__item');
  $('#rail-nav').innerHTML    = itensDeNav('rail__item');

  $('#rail-boards').innerHTML = listaDeQuadros();
}

window.addEventListener('hashchange', () => {
  // Só chega aqui se alguém mexer no endereço à mão: o resto passa por pushState.
  encaminhar();
});

montarEstrutura();
if (!location.hash) history.replaceState({ i: 0, y: 0 }, '', '#/novidades');

/* O servidor pode recusar o token a qualquer momento. */
Api.aoPerderSessao(() => {
  Arquivo.sessaoPerdida();
  if (PRIVADAS.indexOf(estado.ecra) > -1) {
    substituir('#/entrar?destino=' + encodeURIComponent(location.hash || '#/a-minha-conta'));
    aviso('A sua sessão expirou. Entre outra vez.');
  } else {
    desenhar();
  }
});

/* Qualquer mudança na cache volta a pintar: é assim que as escritas
   otimistas aparecem no ecrã antes de o servidor responder. */
Arquivo.aoMudar(() => desenhar());

desenhar();                       // esqueleto enquanto o primeiro pedido vai e vem
Arquivo.arrancar().then(() => {
  if (Arquivo.estadoRede().prontos) encaminhar();
});
