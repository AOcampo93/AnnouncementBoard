/* ============================================================
   Quadro de Avisos — configuração
   O único ficheiro que muda entre ambientes.
   ============================================================ */

const CONFIG = (function () {

  /* A base da API pode vir de uma <meta> no HTML, para se poder mudar de
     ambiente sem tocar em JavaScript:
       <meta name="api-base" content="https://api.exemplo.pt">
     Sem essa meta, assume-se /api no mesmo domínio que serve o frontend. */
  const meta = document.querySelector('meta[name="api-base"]');
  const base = (meta && meta.content && meta.content.trim()) || '/api';

  return {
    /* Base de todos os pedidos. Sem barra no fim. */
    api: base.replace(/\/+$/, ''),

    /* Ao fim deste tempo o pedido é abortado e tratado como falha de rede. */
    tempoLimite: 12000,

    /* Quantas vezes repetir um GET que falhou por rede (nunca escritas:
       repetir um POST criaria avisos a dobrar). */
    repeticoesLeitura: 1,

    /* Onde fica o token da sessão.
       'local'   sobrevive a fechar o navegador  — cómodo, mas legível por
                 qualquer script injetado na página (risco de XSS);
       'sessao'  morre ao fechar o separador;
       'memoria' morre ao recarregar.
       Se um dia se passar para cookie httpOnly, é aqui e no api.js que se mexe. */
    guardarToken: 'local',
    chaveToken: 'quadro-avisos.token',

    /* Lado maior a que as imagens são reduzidas antes de subir. */
    ladoMaximoImagem: 1600,
    qualidadeImagem: 0.82
  };
})();
