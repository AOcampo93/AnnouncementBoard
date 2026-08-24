/* ============================================================
   Quadro de Avisos — cliente HTTP
   Toda a conversa com o backend passa por aqui. Nada mais no
   frontend conhece fetch, cabeçalhos ou códigos de estado.
   ============================================================ */

/* Erro com forma previsível, para a interface poder decidir o que mostrar. */
class ErroApi extends Error {
  constructor(codigo, mensagem, extra) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;              // rede | tempo | autenticacao | permissao |
                                       // nao-encontrado | validacao | conflito | servidor
    this.mensagem = mensagem;          // já em português, pronto a mostrar
    this.campos = (extra && extra.campos) || null;
    this.estado = (extra && extra.estado) || 0;
  }
}

const Api = (function () {

  let token = null;
  let aoPerderSessao = null;           // avisado quando o servidor responde 401
  const pendentes = new Set();         // AbortControllers em voo

  /* ---------- token ---------- */

  function guardaDisponivel() {
    if (CONFIG.guardarToken === 'memoria') return null;
    try {
      return CONFIG.guardarToken === 'sessao' ? sessionStorage : localStorage;
    } catch (err) {
      return null;                      // modo privado ou armazenamento bloqueado
    }
  }

  function lerToken() {
    if (token) return token;
    const g = guardaDisponivel();
    if (!g) return null;
    try { token = g.getItem(CONFIG.chaveToken); } catch (err) { token = null; }
    return token;
  }

  function definirToken(novo) {
    token = novo || null;
    const g = guardaDisponivel();
    if (!g) return;
    try {
      if (novo) g.setItem(CONFIG.chaveToken, novo);
      else g.removeItem(CONFIG.chaveToken);
    } catch (err) { /* sem armazenamento: fica só em memória */ }
  }

  function temToken() { return !!lerToken(); }

  /* ---------- mensagens ---------- */

  const MENSAGENS = {
    rede: 'Não foi possível falar com o servidor. Verifique a ligação à internet.',
    tempo: 'O servidor demorou demasiado a responder.',
    autenticacao: 'A sua sessão expirou. Entre outra vez.',
    permissao: 'Não tem permissão para fazer isto.',
    'nao-encontrado': 'Isto já não existe. Pode ter sido eliminado.',
    validacao: 'Há dados por corrigir.',
    conflito: 'Alguém alterou isto entretanto. Recarregue e tente de novo.',
    servidor: 'O servidor teve um problema. Tente de novo daqui a pouco.'
  };

  const CODIGO_POR_ESTADO = {
    400: 'validacao', 401: 'autenticacao', 403: 'permissao', 404: 'nao-encontrado',
    409: 'conflito', 422: 'validacao', 429: 'servidor'
  };

  /* ---------- pedido ---------- */

  async function pedir(metodo, caminho, opcoes) {
    const o = opcoes || {};
    const controlo = new AbortController();
    pendentes.add(controlo);

    let expirou = false;
    const relogio = setTimeout(() => { expirou = true; controlo.abort(); }, CONFIG.tempoLimite);

    const cabecalhos = { Accept: 'application/json' };
    const chave = lerToken();
    if (chave) cabecalhos.Authorization = 'Bearer ' + chave;

    let corpo;
    if (o.formulario) {
      corpo = o.formulario;             // FormData: o navegador põe o Content-Type
    } else if (o.corpo !== undefined) {
      corpo = JSON.stringify(o.corpo);
      cabecalhos['Content-Type'] = 'application/json';
    }

    let resposta;
    try {
      resposta = await fetch(CONFIG.api + caminho, {
        method: metodo,
        headers: cabecalhos,
        body: corpo,
        signal: controlo.signal
      });
    } catch (err) {
      clearTimeout(relogio);
      pendentes.delete(controlo);
      if (o.abortavel && !expirou) throw new ErroApi('abortado', 'Pedido cancelado.');
      throw new ErroApi(expirou ? 'tempo' : 'rede', MENSAGENS[expirou ? 'tempo' : 'rede']);
    }

    clearTimeout(relogio);
    pendentes.delete(controlo);

    if (resposta.status === 401) {
      definirToken(null);
      // Um 401 ao entrar quer dizer «credenciais erradas»; só um 401 noutro
      // pedido qualquer é que significa que a sessão caiu por baixo dos pés.
      if (aoPerderSessao && !o.proprioLogin) aoPerderSessao();
      let mensagem = MENSAGENS.autenticacao;
      try {
        const dados = await resposta.json();
        if (dados && dados.erro && dados.erro.mensagem) mensagem = dados.erro.mensagem;
      } catch (err) { /* fica a genérica */ }
      throw new ErroApi('autenticacao', mensagem, { estado: 401 });
    }

    if (!resposta.ok) {
      const codigo = CODIGO_POR_ESTADO[resposta.status] || 'servidor';
      let mensagem = MENSAGENS[codigo];
      let campos = null;
      try {
        const dados = await resposta.json();
        if (dados && dados.erro) {
          if (dados.erro.mensagem) mensagem = dados.erro.mensagem;
          if (dados.erro.campos) campos = dados.erro.campos;
        }
      } catch (err) { /* resposta sem JSON: fica a mensagem genérica */ }
      throw new ErroApi(codigo, mensagem, { campos: campos, estado: resposta.status });
    }

    if (resposta.status === 204) return null;

    try {
      return await resposta.json();
    } catch (err) {
      throw new ErroApi('servidor', 'O servidor respondeu algo que não se percebe.');
    }
  }

  /* Uma leitura pode ser repetida sem perigo; uma escrita não. */
  async function ler(caminho, opcoes) {
    let ultimo;
    for (let i = 0; i <= CONFIG.repeticoesLeitura; i++) {
      try {
        return await pedir('GET', caminho, opcoes);
      } catch (err) {
        ultimo = err;
        if (err.codigo !== 'rede' && err.codigo !== 'tempo') throw err;
      }
    }
    throw ultimo;
  }

  function consulta(params) {
    const p = Object.keys(params || {})
      .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
      .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    return p.length ? '?' + p.join('&') : '';
  }

  return {
    ErroApi: ErroApi,

    definirToken: definirToken,
    temToken: temToken,
    aoPerderSessao: (fn) => { aoPerderSessao = fn; },
    cancelarPendentes: () => { pendentes.forEach((c) => c.abort()); pendentes.clear(); },

    /* ----- quadros ----- */
    quadros: () => ler('/quadros'),

    /* ----- avisos ----- */
    avisos: (filtros) => ler('/avisos' + consulta(filtros)),
    avisoUm: (id) => ler('/avisos/' + encodeURIComponent(id)),
    criarAviso: (dados) => pedir('POST', '/avisos', { corpo: dados }),
    editarAviso: (id, patch) => pedir('PATCH', '/avisos/' + encodeURIComponent(id), { corpo: patch }),
    eliminarAviso: (id) => pedir('DELETE', '/avisos/' + encodeURIComponent(id)),
    restaurarAviso: (id) => pedir('POST', '/avisos/' + encodeURIComponent(id) + '/restaurar'),
    marcarLido: (id) => pedir('POST', '/avisos/' + encodeURIComponent(id) + '/lido'),
    marcarTudoLido: () => pedir('POST', '/avisos/lidos'),

    /* ----- ficheiros ----- */
    subirFicheiro: (blob, nome) => {
      const f = new FormData();
      f.append('ficheiro', blob, nome);
      return pedir('POST', '/ficheiros', { formulario: f });
    },

    /* ----- lugares ----- */
    lugares: () => ler('/lugares'),
    criarLugar: (d) => pedir('POST', '/lugares', { corpo: d }),
    editarLugar: (id, d) => pedir('PATCH', '/lugares/' + id, { corpo: d }),
    apagarLugar: (id) => pedir('DELETE', '/lugares/' + id),

    /* ----- notificações ----- */
    chaveNotificacoes: () => ler('/notificacoes/chave'),
    subscreverNotificacoes: (subscricao) => pedir('POST', '/notificacoes/subscrever', { corpo: { subscricao } }),
    esquecerNotificacoes: (endpoint) => pedir('POST', '/notificacoes/esquecer', { corpo: { endpoint } }),
    testarNotificacoes: () => pedir('POST', '/notificacoes/testar'),

    /* ----- contas (só o bispado) ----- */
    contas: () => ler('/utilizadores'),
    criarConta: (dados) => pedir('POST', '/utilizadores', { corpo: dados }),
    editarConta: (id, patch) => pedir('PATCH', '/utilizadores/' + id, { corpo: patch }),
    reporPalavra: (id, palavra) => pedir('POST', '/utilizadores/' + id + '/palavra', { corpo: { palavra } }),
    apagarConta: (id) => pedir('DELETE', '/utilizadores/' + id),
    mudarPalavra: (atual, nova) => pedir('PATCH', '/sessao/palavra', { corpo: { atual, nova } }),

    /* ----- sessão ----- */
    sessaoAtual: () => ler('/sessao', { proprioLogin: true }),
    entrar: (utilizador, palavra) => pedir('POST', '/sessao', {
      corpo: { utilizador: utilizador, palavra: palavra },
      proprioLogin: true
    }),
    sair: () => pedir('DELETE', '/sessao')
  };
})();
