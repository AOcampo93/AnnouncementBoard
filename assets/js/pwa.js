/* ============================================================
   Quadro de Avisos — camada de aplicação instalável
   Regista o service worker, mantém os avisos frescos, e convida
   a pôr no ecrã inicial sem se tornar incómodo.
   ============================================================ */

(function () {

  const CHAVE_VISITAS = 'quadro-avisos.visitas';
  const CHAVE_CONVITE = 'quadro-avisos.convite';   // 'depois' | 'nunca' | 'feito'
  const VISITAS_COM_CONVITE = 3;
  const INTERVALO_FRESCURA = 60000;                // enquanto a app está à vista
  const IDADE_MAXIMA = 25000;                      // ao voltar ao separador

  const guarda = (() => {
    try {
      localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
      return localStorage;
    } catch (err) {
      return null;    // navegação privada ou armazenamento bloqueado
    }
  })();

  const ler = (k, omissao) => { try { return guarda ? (guarda.getItem(k) ?? omissao) : omissao; } catch (e) { return omissao; } };
  const escrever = (k, v) => { try { if (guarda) guarda.setItem(k, v); } catch (e) { /* sem guarda */ } };

  const instalada = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  /* ---------- service worker ---------- */

  let registo = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registo = await navigator.serviceWorker.register('sw.js', { scope: './' });

        // Uma versão nova só manda depois de todos os separadores fecharem.
        // Isto pede-lhe que assuma já, e recarrega quando assumir.
        registo.addEventListener('updatefound', () => {
          const novo = registo.installing;
          if (!novo) return;
          novo.addEventListener('statechange', () => {
            if (novo.state === 'installed' && navigator.serviceWorker.controller) {
              novo.postMessage('assumir-agora');
            }
          });
        });

        let recarregou = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (recarregou) return;
          recarregou = true;
          location.reload();
        });
      } catch (err) {
        // Sem service worker a aplicação funciona na mesma; só não abre sem rede.
        console.warn('[pwa] service worker não registado:', err.message);
      }
    });

    // Tocar numa notificação leva a app ao aviso respetivo.
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.tipo === 'ir' && e.data.url) {
        const hash = String(e.data.url).replace(/^.*#/, '#');
        if (hash.startsWith('#/')) location.hash = hash;
      }
    });
  }

  /* ---------- frescura ---------- */

  let ultimaAtualizacao = Date.now();
  let relogio = null;

  async function atualizar(motivo) {
    if (document.hidden) return;
    if (!navigator.onLine) return;
    if (typeof Arquivo === 'undefined' || !Arquivo.estadoRede().prontos) return;
    try {
      await Arquivo.recarregar();
      ultimaAtualizacao = Date.now();
    } catch (err) {
      // Falhar aqui não deve incomodar: o que está no ecrã continua a servir.
    }
  }

  function ligarRelogio() {
    if (relogio) return;
    relogio = setInterval(() => atualizar('relógio'), INTERVALO_FRESCURA);
  }
  function desligarRelogio() {
    clearInterval(relogio);
    relogio = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { desligarRelogio(); return; }
    ligarRelogio();
    // Voltar ao separador depois de um bocado merece dados novos já.
    if (Date.now() - ultimaAtualizacao > IDADE_MAXIMA) atualizar('regresso');
  });

  window.addEventListener('online', () => atualizar('voltou a rede'));
  window.addEventListener('focus', () => {
    if (Date.now() - ultimaAtualizacao > IDADE_MAXIMA) atualizar('foco');
  });

  ligarRelogio();

  /* ---------- convite a instalar ---------- */

  let pedidoDeInstalacao = null;

  const ehIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function contarVisita() {
    const n = Number(ler(CHAVE_VISITAS, '0')) + 1;
    escrever(CHAVE_VISITAS, String(n));
    return n;
  }

  function deveConvidar(visitas) {
    if (instalada()) return false;
    const estado = ler(CHAVE_CONVITE, '');
    if (estado === 'nunca' || estado === 'feito') return false;
    if (visitas > VISITAS_COM_CONVITE) return false;
    // No Chrome espera-se pelo beforeinstallprompt; no iOS não existe,
    // por isso mostram-se as instruções à mão.
    return !!pedidoDeInstalacao || ehIOS();
  }

  function mostrarConvite(visitas) {
    if (document.getElementById('convite')) return;

    const caixa = document.createElement('div');
    caixa.className = 'convite';
    caixa.id = 'convite';
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-label', 'Adicionar ao ecrã inicial');
    caixa.innerHTML = `
      <img class="convite__icone" src="assets/icones/icone-192.png" alt="">
      <div class="convite__texto">
        <p class="convite__titulo">Ponha o Quadro no ecrã inicial</p>
        <p class="convite__nota">${ehIOS() && !pedidoDeInstalacao
          ? 'Toque em <strong>Partilhar</strong> e depois em <strong>Adicionar ao ecrã principal</strong>.'
          : 'Abre mais depressa e continua a dar jeito sem rede.'}</p>
      </div>
      <div class="convite__accoes">
        ${pedidoDeInstalacao ? '<button class="btn btn--solid btn--sm" data-convite="sim">Adicionar</button>' : ''}
        <button class="btn btn--quiet btn--sm" data-convite="depois">Agora não</button>
        ${visitas >= VISITAS_COM_CONVITE ? '<button class="btn btn--quiet btn--sm" data-convite="nunca">Não voltar a perguntar</button>' : ''}
      </div>
      <button class="convite__fechar" data-convite="depois" aria-label="Fechar">
        <svg class="ico" aria-hidden="true"><use href="#i-close"></use></svg>
      </button>`;

    document.body.appendChild(caixa);
    requestAnimationFrame(() => caixa.classList.add('convite--visivel'));
  }

  function fecharConvite() {
    const c = document.getElementById('convite');
    if (!c) return;
    c.classList.remove('convite--visivel');
    setTimeout(() => c.remove(), 220);
  }

  document.addEventListener('click', async (ev) => {
    const alvo = ev.target.closest('[data-convite]');
    if (!alvo) return;
    const acao = alvo.dataset.convite;

    if (acao === 'nunca') { escrever(CHAVE_CONVITE, 'nunca'); fecharConvite(); return; }
    if (acao === 'depois') { fecharConvite(); return; }

    if (acao === 'sim' && pedidoDeInstalacao) {
      fecharConvite();
      pedidoDeInstalacao.prompt();
      const { outcome } = await pedidoDeInstalacao.userChoice;
      if (outcome === 'accepted') escrever(CHAVE_CONVITE, 'feito');
      pedidoDeInstalacao = null;
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    // Guarda-se para o convite poder aparecer no momento escolhido por nós.
    e.preventDefault();
    pedidoDeInstalacao = e;
    const visitas = Number(ler(CHAVE_VISITAS, '1'));
    if (deveConvidar(visitas)) setTimeout(() => mostrarConvite(visitas), 2500);
  });

  window.addEventListener('appinstalled', () => {
    escrever(CHAVE_CONVITE, 'feito');
    fecharConvite();
  });

  const visitasAgora = contarVisita();
  // No iOS não há beforeinstallprompt: se for caso disso, convida-se à mesma.
  if (ehIOS()) {
    setTimeout(() => { if (deveConvidar(visitasAgora)) mostrarConvite(visitasAgora); }, 3000);
  }

  /* ---------- notificações ---------- */

  const suportaNotificacoes = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function base64ParaBytes(base64) {
    const completo = (base64 + '='.repeat((4 - base64.length % 4) % 4))
      .replace(/-/g, '+').replace(/_/g, '/');
    const cru = atob(completo);
    return Uint8Array.from([...cru].map((c) => c.charCodeAt(0)));
  }

  async function registoPronto() {
    if (registo) return registo;
    if (!('serviceWorker' in navigator)) return null;
    registo = await navigator.serviceWorker.ready;
    return registo;
  }

  async function estadoNotificacoes() {
    if (!suportaNotificacoes()) {
      return { suportado: false, permissao: 'indisponivel', subscrito: false };
    }
    const r = await registoPronto();
    const sub = r ? await r.pushManager.getSubscription() : null;
    return {
      suportado: true,
      permissao: Notification.permission,
      subscrito: !!sub,
      // No iOS o push só existe depois de a app estar no ecrã inicial.
      exigeInstalar: ehIOS() && !instalada()
    };
  }

  async function ativarNotificacoes() {
    if (!suportaNotificacoes()) throw new Error('Este navegador não suporta notificações.');
    if (ehIOS() && !instalada()) {
      throw new Error('No iPhone é preciso primeiro adicionar o Quadro ao ecrã inicial.');
    }

    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      throw new Error(permissao === 'denied'
        ? 'As notificações estão bloqueadas nas definições do navegador.'
        : 'Ficou por decidir. Pode tentar outra vez.');
    }

    const { ligadas, chave } = await Api.chaveNotificacoes();
    if (!ligadas || !chave) throw new Error('O servidor ainda não tem as notificações configuradas.');

    const r = await registoPronto();
    let sub = await r.pushManager.getSubscription();
    if (!sub) {
      sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ParaBytes(chave)
      });
    }
    await Api.subscreverNotificacoes(sub.toJSON());
    return true;
  }

  async function desativarNotificacoes() {
    const r = await registoPronto();
    const sub = r ? await r.pushManager.getSubscription() : null;
    if (!sub) return true;
    // Avisa-se o servidor antes de desfazer: se falhar, ainda se sabe qual era.
    try { await Api.esquecerNotificacoes(sub.endpoint); } catch (err) { /* segue */ }
    await sub.unsubscribe();
    return true;
  }

  /* Exposto para o ecrã da conta poder mostrar o estado. */
  window.PWA = {
    notificacoes: {
      suportado: suportaNotificacoes,
      estado: estadoNotificacoes,
      ativar: ativarNotificacoes,
      desativar: desativarNotificacoes
    },
    instalada,
    podeInstalar: () => !!pedidoDeInstalacao,
    convidar: () => mostrarConvite(Number(ler(CHAVE_VISITAS, '1'))),
    atualizarAgora: () => atualizar('à mão'),
    visitas: () => Number(ler(CHAVE_VISITAS, '0'))
  };
})();
