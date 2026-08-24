/* ============================================================
   Quadro de Avisos — service worker
   Guarda a casca da aplicação para ela abrir sem rede, mas nunca
   guarda respostas da API: os avisos têm de vir sempre frescos.
   ============================================================ */

const VERSAO = 'quadro-v3';
const CASCA = VERSAO + '-casca';

/* Só o indispensável para a aplicação abrir. O resto entra em cache
   à medida que for pedido. */
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/config.js',
  './assets/js/data.js',
  './assets/js/api.js',
  './assets/js/store.js',
  './assets/js/app.js',
  './assets/icones/icone-192.png',
  './assets/icones/icone-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CASCA)
      // Um recurso em falta não pode impedir a instalação inteira.
      .then((c) => Promise.allSettled(ESSENCIAIS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'assumir-agora') self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  // A API fica de fora: quem pergunta pelos avisos quer os de agora,
  // não os da última vez que houve rede.
  if (url.origin !== self.location.origin) return;

  // Navegar: tenta a rede, e se não houver serve a casca guardada.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((r) => {
          const copia = r.clone();
          caches.open(CASCA).then((c) => c.put('./index.html', copia));
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Restantes ficheiros: rede primeiro para apanhar versões novas,
  // cache como rede de segurança.
  evento.respondWith(
    fetch(pedido)
      .then((r) => {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(CASCA).then((c) => c.put(pedido, copia));
        }
        return r;
      })
      .catch(() => caches.match(pedido))
  );
});

/* ---------- notificações ---------- */

self.addEventListener('push', (evento) => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch (err) { dados = {}; }

  const titulo = dados.titulo || 'Novo aviso';
  const opcoes = {
    body: dados.corpo || '',
    icon: './assets/icones/icone-192.png',
    badge: './assets/icones/icone-192.png',
    lang: 'pt-PT',
    tag: dados.tag || 'aviso',
    renotify: true,
    data: { url: dados.url || './#/novidades' },
    actions: [{ action: 'abrir', title: 'Ler' }]
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || './#/novidades';

  evento.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Se a aplicação já estiver aberta, leva-se essa janela ao aviso
    // em vez de abrir mais uma.
    for (const c of abertos) {
      if (c.url.includes(self.registration.scope)) {
        await c.focus();
        c.postMessage({ tipo: 'ir', url: destino });
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});
