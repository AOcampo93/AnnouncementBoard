/* ============================================================
   Quadro de Avisos — dados iniciais (a semente)
   Em produção isto vem do backend. A forma dos objetos é o contrato.
   ============================================================ */

const BOARDS = [
  { id: 'ala',       name: 'Avisos da ala',        short: 'Ala' },
  { id: 'socorro',   name: 'Sociedade de Socorro', short: 'Socorro' },
  { id: 'elderes',   name: 'Quórum de Élderes',    short: 'Élderes' },
  { id: 'jovens',    name: 'Jovens',               short: 'Jovens' },
  { id: 'primaria',  name: 'Primária',             short: 'Primária' },
  { id: 'dominical', name: 'Escola Dominical',     short: 'Dominical' }
];

const TIPOS = ['Atividade', 'Serviço', 'Relatório', 'Aviso'];

/* Momento a que a demonstração está ancorada. Os avisos da semente contam-se
   para trás a partir daqui; os que o utilizador criar usam o relógio real e,
   por serem mais recentes, sobem sempre ao topo. */
const ANCORA = new Date('2025-08-21T08:30:00').getTime();
const MIN = 60000, HORA = 60 * MIN, DIA = 24 * HORA;

/* Partes disponíveis ao criar um aviso.
   `campo` diz que controlo verdadeiro desenhar; `kind` continua a separar
   as partes de média das de texto para efeitos de apresentação. */
const BLOCKS = {
  titulo:   { label: 'Título',               hint: 'Escreva o título do aviso',            kind: 'text',  campo: 'texto',     max: 90 },
  imagem:   { label: 'Imagem principal',     hint: 'Toque para carregar o cartaz',         kind: 'media', campo: 'ficheiro',  accept: 'image/*' },
  galeria:  { label: 'Galeria de fotos',     hint: 'Toque para carregar as fotos',         kind: 'media', campo: 'ficheiros', accept: 'image/*' },
  texto:    { label: 'Descrição',            hint: 'Conte os detalhes: dia, hora, local…', kind: 'text',  campo: 'area' },
  data:     { label: 'Data e hora',          hint: '',                                     kind: 'text',  campo: 'datahora' },
  local:    { label: 'Local ou morada',      hint: 'Capela da ala · Rua de Tomar 45',      kind: 'text',  campo: 'texto',     max: 120 },
  ligacao:  { label: 'Ligação',              hint: 'https://…',                            kind: 'text',  campo: 'url' },
  pdf:      { label: 'Ficheiro PDF',         hint: 'Toque para escolher o ficheiro',       kind: 'media', campo: 'ficheiro',  accept: 'application/pdf' },
  contacto: { label: 'Telefone de contacto', hint: '912 402 788',                          kind: 'text',  campo: 'telefone' }
};

/* A ordem por que as partes aparecem no aviso publicado, independentemente
   da ordem por que foram adicionadas. */
const ORDEM_BLOCOS = ['titulo', 'imagem', 'data', 'local', 'texto', 'galeria', 'ligacao', 'pdf', 'contacto'];

const SEED_POSTS = [
  {
    id: 'p1', autorId: 'marta.soares', boards: ['ala'], kind: 'Atividade', isNew: true,
    ts: ANCORA,
    date: 'Hoje · 08:30',
    title: 'Noite de confraternização esta sexta',
    summary: 'Sexta-feira 28, às 19:00 no salão cultural. Cada família leva uma sobremesa.',
    when: { day: 'Sexta-feira, 28 de agosto', time: '19:00', place: 'Salão cultural da capela' },
    body: [
      'A atividade é na sexta-feira, 28 de agosto, às 19:00, no salão cultural da capela. As portas abrem 20 minutos antes.',
      'Estão convidadas todas as famílias da ala, e também os amigos que queiram vir. Cada família traz uma sobremesa para partilhar.'
    ],
    hero: { legenda: 'cartaz da atividade', medidas: '1200×800' },
    gallery: [
      { legenda: 'o salão cultural', medidas: '1200×800' },
      { legenda: 'as mesas montadas', medidas: '1200×800' },
      { legenda: 'como chegar', medidas: '1200×800' }
    ],
    links: [
      { type: 'map',  label: 'Ver o local no mapa',   meta: 'Rua de Tomar 45', destino: { morada: 'Rua de Tomar 45, 2400 Leiria' } },
      { type: 'pdf',  label: 'Descarregar o folheto', meta: '240 KB',          destino: { ficheiro: 'noite-de-confraternizacao.pdf', tamanho: '240 KB', paginas: 2 } }
    ],
    contact: { name: 'Irmã Laura Mendes', phone: '912 402 788', note: 'Também podem perguntar no domingo, na capela' },
    author: 'Irmã Marta Soares',
    authorRole: 'Sociedade de Socorro'
  },
  {
    id: 'p2', autorId: 'marta.soares', boards: ['socorro'], kind: 'Atividade', isNew: true,
    ts: ANCORA - 13 * HORA - 18 * MIN,
    date: 'Ontem · 19:12',
    title: 'Curso de costura para as irmãs',
    summary: 'Terça-feira 25, às 18:30 na sala 3. Trazer tesoura e tecido.',
    when: { day: 'Terça-feira, 25 de agosto', time: '18:30', place: 'Sala 3 da capela' },
    body: [
      'Começamos com arranjos simples: bainhas, botões e remendos. Não é preciso saber coser, aprende-se ali mesmo.',
      'Trazer tesoura e um retalho de tecido para praticar. Há três máquinas disponíveis para quem não tiver.'
    ],
    hero: { legenda: 'curso anterior', medidas: '1200×800' },
    gallery: [
      { legenda: 'as máquinas', medidas: '1200×800' },
      { legenda: 'trabalhos terminados', medidas: '1200×800' },
      { legenda: 'a sala 3', medidas: '1200×800' }
    ],
    links: [
      { type: 'phone', label: 'Inscrever-se por telefone', meta: '912 555 142', destino: { numero: '912555142' } }
    ],
    contact: { name: 'Irmã Rosa Vilela', phone: '912 555 142', note: 'Avisem se precisarem que vos emprestem uma máquina' },
    author: 'Irmã Marta Soares',
    authorRole: 'Sociedade de Socorro'
  },
  {
    id: 'p3', autorId: 'daniel.ferreira', boards: ['elderes'], kind: 'Serviço', isNew: true,
    ts: ANCORA - 22 * HORA - 26 * MIN,
    date: 'Ontem · 10:04',
    title: 'Serviço de limpeza no cemitério',
    summary: 'Sábado 29 às 7:00. Encontramo-nos na capela para irmos juntos.',
    when: { day: 'Sábado, 29 de agosto', time: '7:00', place: 'Saída a partir da capela' },
    body: [
      'Encontramo-nos no estacionamento da capela às 7:00 e saímos juntos. Contamos regressar perto do meio-dia.',
      'Levar luvas, boné e água. As ferramentas grandes são da câmara municipal.'
    ],
    hero: null,
    gallery: [],
    links: [
      { type: 'map', label: 'Ver o ponto de encontro', meta: 'Estacionamento da capela', destino: { morada: 'Capela de Leiria, Rua de Tomar 45, 2400 Leiria' } }
    ],
    contact: { name: 'Irmão Daniel Ferreira', phone: '912 610 244', note: 'Se puderem levar carro, avisem para organizarmos as boleias' },
    author: 'Irmão Daniel Ferreira',
    authorRole: 'Quórum de Élderes'
  },
  {
    id: 'p4', autorId: 'paulo.caseiro', boards: ['jovens'], kind: 'Relatório', isNew: false,
    ts: ANCORA - 3 * DIA,
    date: '18 ago',
    title: 'Fotos da conferência de jovens',
    summary: 'Relatório com 24 fotos do acampamento do fim de semana.',
    when: { day: 'De 15 a 17 de agosto', time: 'Fim de semana completo', place: 'Acampamento da Serra de Aire' },
    body: [
      'Foram 38 jovens e 9 líderes. Três dias de serviço, caminhadas e noites de testemunho.',
      'As fotos completas estão no álbum partilhado. Se alguém não quiser aparecer, avise e retiramo-las.'
    ],
    hero: { legenda: 'chegada ao acampamento', medidas: '1200×800' },
    gallery: [
      { legenda: 'noite de fogueira', medidas: '1200×800' },
      { legenda: 'caminhada de sábado', medidas: '1200×800' },
      { legenda: 'foto de grupo', medidas: '1200×800' }
    ],
    links: [
      { type: 'link', label: 'Abrir o álbum completo', meta: '24 fotos', destino: { url: 'https://fotos.ala-leiria.pt/conferencia-jovens' } }
    ],
    contact: { name: 'Irmão Paulo Caseiro', phone: '912 470 889', note: 'Escrevam se quiserem as fotos em alta qualidade' },
    author: 'Irmão Paulo Caseiro',
    authorRole: 'Jovens'
  },
  {
    id: 'p5', autorId: 'silvia.horta', boards: ['primaria'], kind: 'Aviso', isNew: false,
    ts: ANCORA - 6 * DIA,
    date: '15 ago',
    title: 'Ensaio do programa da Primária',
    summary: 'Domingo, depois da reunião, 20 minutos. Venham todas as crianças.',
    when: { day: 'Todos os domingos', time: 'Ao terminar a reunião', place: 'Sala da Primária' },
    body: [
      'O ensaio dura 20 minutos e é ao terminar a reunião sacramental. Pedimos que as crianças fiquem na sala.',
      'O programa é apresentado no domingo, 12 de outubro. Faltam seis ensaios.'
    ],
    hero: null,
    gallery: [],
    links: [
      { type: 'pdf', label: 'Letra das canções', meta: '120 KB', destino: { ficheiro: 'letra-das-cancoes.pdf', tamanho: '120 KB', paginas: 4 } }
    ],
    contact: { name: 'Irmã Sílvia Horta', phone: '912 388 117', note: 'Se o seu filho faltar a um ensaio não faz mal, participa na mesma' },
    author: 'Irmã Sílvia Horta',
    authorRole: 'Primária'
  },
  {
    id: 'p6', autorId: 'bispado', boards: ['ala'], kind: 'Aviso', isNew: false,
    ts: ANCORA - 7 * DIA,
    date: '14 ago',
    title: 'Mudança de horário da reunião sacramental',
    summary: 'A partir de setembro a reunião começa às 9:00.',
    when: { day: 'A partir de domingo, 7 de setembro', time: '9:00', place: 'Capela da ala' },
    body: [
      'A partir de setembro a reunião sacramental começa às 9:00 em vez das 10:30. As aulas continuam a seguir.',
      'A mudança é para todo o ano. Por favor, avisem as famílias que vêm com menos frequência.'
    ],
    hero: null,
    gallery: [],
    links: [],
    contact: { name: 'Secretaria da ala', phone: '912 402 770', note: 'Atendimento de segunda a sexta, à tarde' },
    author: 'Bispado',
    authorRole: 'Avisos da ala'
  },
  {
    id: 'p7', autorId: 'ernesto.rios', boards: ['dominical'], kind: 'Atividade', isNew: false,
    ts: ANCORA - 9 * DIA,
    date: '12 ago',
    title: 'Aula especial sobre o Antigo Testamento',
    summary: 'Domingo 24 na sala 1, a cargo do irmão Rios.',
    when: { day: 'Domingo, 24 de agosto', time: 'Segundo bloco', place: 'Sala 1' },
    body: [
      'O irmão Rios vai rever os profetas maiores com um mapa da época. É uma única aula, não é preciso ter vindo às anteriores.',
      'Podem trazer as suas escrituras marcadas. No fim fica tempo para perguntas.'
    ],
    hero: { legenda: 'mapa da época', medidas: '1200×800' },
    gallery: [
      { legenda: 'linha do tempo', medidas: '1200×800' },
      { legenda: 'material da aula', medidas: '1200×800' },
      { legenda: 'a sala 1', medidas: '1200×800' }
    ],
    links: [
      { type: 'pdf', label: 'Guia de estudo', meta: '310 KB', destino: { ficheiro: 'guia-de-estudo.pdf', tamanho: '310 KB', paginas: 6 } }
    ],
    contact: { name: 'Irmão Ernesto Rios', phone: '912 244 903', note: 'Qualquer dúvida, no domingo antes da aula' },
    author: 'Irmão Ernesto Rios',
    authorRole: 'Escola Dominical'
  }
];

const QUICK_SEARCHES = ['Atividade', 'Serviço', 'Jovens', 'Relatório'];

/* Identidade da conta de exemplo. O nome real passa a vir da sessão. */
const CONTA_EXEMPLO = { utilizador: 'marta.soares', nome: 'Irmã Marta Soares', board: 'socorro' };
