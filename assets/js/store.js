/* ============================================================
   Quadro de Avisos — arquivo
   Cache em memória por cima da API. As LEITURAS são síncronas, para
   as funções de ecrã poderem continuar a construir HTML numa linha
   só; as ESCRITAS são assíncronas e otimistas: mexem já na cache,
   pedem ao servidor, e desfazem se o servidor recusar.
   ============================================================ */

const Arquivo = (function () {

  const cache = {
    avisos: [],
    quadros: [],
    sessao: null
  };

  const rede = { aCarregar: false, prontos: false, erro: null };
  const ouvintes = [];

  const notificar = () => ouvintes.forEach((fn) => { try { fn(); } catch (e) { /* ouvinte seu problema */ } });

  /* ---------- datas ---------- */

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  /* O servidor manda o instante; a etiqueta legível calcula-se aqui, no
     fuso e no relógio de quem está a ler. */
  function dataRelativa(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    const agora = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');

    const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diasAtras = Math.round((dia(agora) - dia(d)) / 86400000);

    if (diasAtras === 0) return 'Hoje · ' + hh + ':' + mm;
    if (diasAtras === 1) return 'Ontem · ' + hh + ':' + mm;
    if (d.getFullYear() !== agora.getFullYear()) {
      return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear();
    }
    return d.getDate() + ' ' + MESES[d.getMonth()];
  }

  /* Acrescenta o que a interface espera e o servidor não precisa de mandar. */
  function normalizar(p) {
    if (!p) return p;
    p.boards = p.boards || [];
    p.gallery = p.gallery || [];
    p.links = p.links || [];
    p.body = p.body || [];
    p.date = dataRelativa(p.ts);
    return p;
  }

  const porData = (a, b) => (b.ts || 0) - (a.ts || 0);

  /* ---------- leituras (síncronas, sobre a cache) ---------- */

  function avisos() { return cache.avisos.slice().sort(porData); }
  function aviso(id) { return cache.avisos.find((p) => p.id === id) || null; }
  function doQuadro(id) { return avisos().filter((p) => p.boards.indexOf(id) > -1); }

  /* Quem já leu o quê é do servidor: vem marcado em cada aviso. */
  function porLer(p) { return !!p && p.porLer === true; }
  function naoLidos(lista) { return (lista || avisos()).filter(porLer).length; }

  function sessao() { return cache.sessao; }
  function ehAdmin() { return !!cache.sessao && cache.sessao.papel === 'admin'; }

  function quadrosPermitidos() {
    const s = cache.sessao;
    if (!s) return [];
    if (Array.isArray(s.quadrosPermitidos)) return s.quadrosPermitidos;
    return s.papel === 'admin' ? cache.quadros.map((b) => b.id) : [s.board];
  }

  /* O servidor decide quem pode editar e apagar o quê; o cliente só obedece. */
  function podeEditar(p) { return !!p && p.podeEditar === true; }
  function podeEliminar(p) { return !!p && p.podeEliminar === true; }

  function meus() {
    const s = cache.sessao;
    if (!s) return { proprios: [], administrados: [] };
    const todos = avisos();
    return {
      proprios: todos.filter((p) => p.autorId === s.utilizador),
      administrados: todos.filter((p) => p.autorId !== s.utilizador && podeEditar(p))
    };
  }

  function estadoRede() { return rede; }

  /* ---------- arranque e recarga ---------- */

  async function arrancar() {
    rede.aCarregar = true;
    rede.erro = null;
    notificar();

    try {
      if (Api.temToken()) {
        try {
          cache.sessao = await Api.sessaoAtual();
        } catch (err) {
          // Token velho ou revogado: segue-se em modo de leitura.
          if (err.codigo === 'autenticacao') { Api.definirToken(null); cache.sessao = null; }
          else throw err;
        }
      }

      const [quadros, resposta] = await Promise.all([Api.quadros(), Api.avisos()]);

      // O array BOARDS é partilhado com a camada de vista: enche-se no
      // sítio, para as referências existentes continuarem válidas.
      cache.quadros = quadros || [];
      BOARDS.length = 0;
      cache.quadros.forEach((b) => BOARDS.push(b));

      cache.avisos = ((resposta && resposta.avisos) || []).map(normalizar);
      rede.prontos = true;
      rede.erro = null;
    } catch (err) {
      rede.erro = err;
      rede.prontos = false;
    } finally {
      rede.aCarregar = false;
      notificar();
    }
  }

  async function recarregar() {
    try {
      const resposta = await Api.avisos();
      cache.avisos = ((resposta && resposta.avisos) || []).map(normalizar);
      rede.erro = null;
      notificar();
    } catch (err) {
      rede.erro = err;
      notificar();
      throw err;
    }
  }

  /* ---------- escritas otimistas ---------- */

  function idProvisorio() { return 'tmp-' + Date.now().toString(36); }

  async function criar(dados) {
    const provisorio = normalizar(Object.assign({}, dados, {
      id: idProvisorio(), ts: Date.now(), porLer: false,
      podeEditar: true, podeEliminar: true, aEnviar: true
    }));
    cache.avisos.unshift(provisorio);
    notificar();

    try {
      const real = normalizar(await Api.criarAviso(dados));
      const i = cache.avisos.findIndex((p) => p.id === provisorio.id);
      if (i > -1) cache.avisos[i] = real; else cache.avisos.unshift(real);
      notificar();
      return real;
    } catch (err) {
      cache.avisos = cache.avisos.filter((p) => p.id !== provisorio.id);
      notificar();
      throw err;
    }
  }

  async function atualizar(id, patch) {
    const i = cache.avisos.findIndex((p) => p.id === id);
    if (i < 0) throw new Api.ErroApi('nao-encontrado', 'Este aviso já não existe.');
    const antes = cache.avisos[i];
    cache.avisos[i] = normalizar(Object.assign({}, antes, patch, { aEnviar: true }));
    notificar();

    try {
      const real = normalizar(await Api.editarAviso(id, patch));
      const j = cache.avisos.findIndex((p) => p.id === id);
      if (j > -1) cache.avisos[j] = real;
      notificar();
      return real;
    } catch (err) {
      const j = cache.avisos.findIndex((p) => p.id === id);
      if (j > -1) cache.avisos[j] = antes;
      notificar();
      throw err;
    }
  }

  async function eliminar(id) {
    const i = cache.avisos.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const removido = cache.avisos[i];
    cache.avisos.splice(i, 1);
    notificar();

    try {
      await Api.eliminarAviso(id);
      return { aviso: removido, indice: i };
    } catch (err) {
      cache.avisos.splice(Math.min(i, cache.avisos.length), 0, removido);
      notificar();
      throw err;
    }
  }

  /* Anular. Prefere-se o endpoint de reposição, para o aviso ficar com o
     mesmo id e as mesmas ligações; se o servidor apagar mesmo, cria de novo. */
  async function restaurar(avisoRemovido, indice) {
    cache.avisos.splice(Math.min(indice, cache.avisos.length), 0, avisoRemovido);
    notificar();
    try {
      const real = normalizar(await Api.restaurarAviso(avisoRemovido.id));
      const j = cache.avisos.findIndex((p) => p.id === avisoRemovido.id);
      if (j > -1) cache.avisos[j] = real;
      notificar();
      return real;
    } catch (err) {
      if (err.codigo === 'nao-encontrado') {
        cache.avisos = cache.avisos.filter((p) => p.id !== avisoRemovido.id);
        notificar();
        return criar(paraEnvio(avisoRemovido));
      }
      cache.avisos = cache.avisos.filter((p) => p.id !== avisoRemovido.id);
      notificar();
      throw err;
    }
  }

  /* Tira os campos que só existem do lado do cliente. */
  function paraEnvio(p) {
    const c = Object.assign({}, p);
    ['id', 'ts', 'date', 'porLer', 'podeEditar', 'podeEliminar', 'aEnviar', 'autorId', 'author', 'authorRole'].forEach((k) => delete c[k]);
    return c;
  }

  /* Marcar como lido não vale um aviso de erro: falha em silêncio. */
  async function marcarLido(id) {
    const p = aviso(id);
    if (!p || !p.porLer) return false;
    p.porLer = false;
    notificar();
    try { await Api.marcarLido(id); } catch (err) { p.porLer = true; notificar(); }
    return true;
  }

  async function marcarTudoLido() {
    const antes = cache.avisos.filter((p) => p.porLer);
    if (!antes.length) return 0;
    antes.forEach((p) => { p.porLer = false; });
    notificar();
    try {
      await Api.marcarTudoLido();
      return antes.length;
    } catch (err) {
      antes.forEach((p) => { p.porLer = true; });
      notificar();
      throw err;
    }
  }

  /* ---------- sessão ---------- */

  async function entrar(utilizador, palavra) {
    const dados = await Api.entrar(utilizador, palavra);
    if (dados && dados.token) Api.definirToken(dados.token);
    cache.sessao = dados;
    // As permissões mudam o que se vê: recarrega-se a lista.
    try { await recarregar(); } catch (err) { /* a sessão abriu à mesma */ }
    notificar();
    return dados;
  }

  async function sair() {
    try { await Api.sair(); } catch (err) { /* sair é sempre local */ }
    Api.definirToken(null);
    cache.sessao = null;
    try { await recarregar(); } catch (err) { /* fica o que estava */ }
    notificar();
  }

  /* Chamado pelo cliente HTTP quando o servidor responde 401. */
  function sessaoPerdida() {
    cache.sessao = null;
    notificar();
  }

  return {
    aoMudar: (fn) => ouvintes.push(fn),
    arrancar: arrancar, recarregar: recarregar, estadoRede: estadoRede,

    avisos: avisos, aviso: aviso, doQuadro: doQuadro,
    porLer: porLer, naoLidos: naoLidos, meus: meus,
    sessao: sessao, ehAdmin: ehAdmin,
    quadrosPermitidos: quadrosPermitidos,
    podeEditar: podeEditar, podeEliminar: podeEliminar,

    criar: criar, atualizar: atualizar, eliminar: eliminar, restaurar: restaurar,
    marcarLido: marcarLido, marcarTudoLido: marcarTudoLido,
    paraEnvio: paraEnvio,

    entrar: entrar, sair: sair, sessaoPerdida: sessaoPerdida,
    dataRelativa: dataRelativa
  };
})();
