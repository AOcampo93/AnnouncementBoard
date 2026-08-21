/* ============================================================
   Quadro de Avisos — arquivo
   Tudo o que sobrevive a um F5 passa por aqui. Sem backend: o
   navegador é o servidor. Uma só chave versionada em localStorage.
   ============================================================ */

const Arquivo = (function () {

  const CHAVE = 'quadro-avisos.v1';

  let d = null;          // dados em memória
  let semDisco = false;  // localStorage indisponível ou cheio

  /* ---------- disco ---------- */

  function inicial() {
    return {
      avisos: SEED_POSTS.map((p) => JSON.parse(JSON.stringify(p))),
      lidos: [],                                   // ids já abertos
      // Arranca com sessão iniciada, como no protótipo original: assim vê-se
      // a app inteira à primeira. O painel da demonstração permite fechá-la.
      sessao: { utilizador: CONTA_EXEMPLO.utilizador, nome: CONTA_EXEMPLO.nome, board: CONTA_EXEMPLO.board },
      rascunho: null,                              // { blocks, valores, editingId, mode, picked }
      demo: { role: 'admin', stamps: true }
    };
  }

  function carregar() {
    try {
      const cru = localStorage.getItem(CHAVE);
      if (!cru) { d = inicial(); gravar(); return; }
      const lido = JSON.parse(cru);
      // Fundir com o inicial: uma versão gravada antes de um campo novo
      // existir não pode deixar a app sem esse campo.
      d = Object.assign(inicial(), lido);
      if (!Array.isArray(d.avisos) || !d.avisos.length) d.avisos = inicial().avisos;
      if (!Array.isArray(d.lidos)) d.lidos = [];
      if (!d.demo) d.demo = { role: 'admin', stamps: true };
    } catch (err) {
      semDisco = true;
      d = inicial();
    }
  }

  function gravar() {
    if (semDisco) return true;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(d));
      return true;
    } catch (err) {
      // Quota cheia: quase sempre por causa de imagens carregadas.
      semDisco = true;
      return false;
    }
  }

  function repor() {
    d = inicial();
    semDisco = false;
    try { localStorage.removeItem(CHAVE); } catch (err) { /* sem disco */ }
    gravar();
  }

  /* ---------- leitura ---------- */

  const clonar = (o) => JSON.parse(JSON.stringify(o));

  /* Mais recente primeiro. Um aviso acabado de criar fica sempre no topo. */
  const porData = (a, b) => (b.ts || 0) - (a.ts || 0);

  function avisos() { return d.avisos.slice().sort(porData); }

  function aviso(id) { return d.avisos.find((p) => p.id === id) || null; }

  function doQuadro(id) {
    return avisos().filter((p) => (p.boards || []).indexOf(id) > -1);
  }

  function porLer(p) { return d.lidos.indexOf(p.id) < 0 && p.isNew; }

  function naoLidos(lista) { return (lista || avisos()).filter(porLer).length; }

  /* Avisos de que a sessão é autora. Quem administra vê também, num bloco
     à parte, os que administra sem ter escrito. */
  function meus() {
    const s = d.sessao;
    if (!s) return { proprios: [], administrados: [] };
    const proprios = avisos().filter((p) => p.autorId === s.utilizador);
    const administrados = d.demo.role === 'admin'
      ? avisos().filter((p) => p.autorId !== s.utilizador)
      : avisos().filter((p) => p.autorId !== s.utilizador && (p.boards || []).indexOf(s.board) > -1);
    return { proprios: proprios, administrados: administrados };
  }

  /* Quadros em que a sessão tem autorização para publicar. */
  function quadrosPermitidos() {
    if (d.demo.role === 'admin') return BOARDS.map((b) => b.id);
    return d.sessao ? [d.sessao.board] : [];
  }

  /* ---------- escrita ---------- */

  function novoId() {
    return 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }

  function criar(aviso) {
    const p = Object.assign({ id: novoId(), ts: Date.now(), isNew: false }, aviso);
    d.avisos.unshift(p);
    gravar();
    return p;
  }

  function atualizar(id, patch) {
    const i = d.avisos.findIndex((p) => p.id === id);
    if (i < 0) return null;
    d.avisos[i] = Object.assign({}, d.avisos[i], patch);
    gravar();
    return d.avisos[i];
  }

  /* Devolve o suficiente para anular: o objeto e a posição que ocupava. */
  function eliminar(id) {
    const i = d.avisos.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const removido = d.avisos.splice(i, 1)[0];
    gravar();
    return { aviso: removido, indice: i };
  }

  function restaurar(aviso, indice) {
    d.avisos.splice(Math.min(indice, d.avisos.length), 0, aviso);
    gravar();
  }

  function marcarLido(id) {
    if (d.lidos.indexOf(id) > -1) return false;
    d.lidos.push(id);
    gravar();
    return true;
  }

  function marcarTudoLido() {
    const antes = d.lidos.length;
    d.avisos.forEach((p) => { if (d.lidos.indexOf(p.id) < 0) d.lidos.push(p.id); });
    gravar();
    return d.lidos.length - antes;
  }

  /* ---------- sessão ---------- */

  function entrar(utilizador) {
    const limpo = String(utilizador || '').trim();
    const ehExemplo = limpo.toLowerCase() === CONTA_EXEMPLO.utilizador;
    d.sessao = {
      utilizador: limpo,
      nome: ehExemplo ? CONTA_EXEMPLO.nome : limpo,
      board: CONTA_EXEMPLO.board
    };
    gravar();
    return d.sessao;
  }

  function sair() { d.sessao = null; gravar(); }

  function sessao() { return d.sessao; }

  /* ---------- rascunho ---------- */

  function rascunho() { return d.rascunho; }
  function guardarRascunho(r) { d.rascunho = r; gravar(); }
  function limparRascunho() { d.rascunho = null; gravar(); }

  /* ---------- opções da demonstração ---------- */

  function demo() { return d.demo; }
  function definirDemo(patch) { Object.assign(d.demo, patch); gravar(); }

  function estadoDoDisco() { return semDisco ? 'memoria' : 'disco'; }

  carregar();

  return {
    avisos: avisos, aviso: aviso, doQuadro: doQuadro,
    porLer: porLer, naoLidos: naoLidos, meus: meus,
    quadrosPermitidos: quadrosPermitidos,
    criar: criar, atualizar: atualizar, eliminar: eliminar, restaurar: restaurar,
    marcarLido: marcarLido, marcarTudoLido: marcarTudoLido,
    entrar: entrar, sair: sair, sessao: sessao,
    rascunho: rascunho, guardarRascunho: guardarRascunho, limparRascunho: limparRascunho,
    demo: demo, definirDemo: definirDemo,
    repor: repor, estadoDoDisco: estadoDoDisco, novoId: novoId
  };
})();
