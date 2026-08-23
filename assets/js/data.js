/* ============================================================
   Quadro de Avisos — vocabulário fixo da interface
   Os dados vêm todos da API. Aqui só fica o que é estrutura da
   própria aplicação e não muda com o conteúdo.
   ============================================================ */

/* Enchido pelo Arquivo a partir de GET /quadros, no arranque.
   Fica como const de propósito: enche-se no sítio, para as
   referências espalhadas pela camada de vista continuarem válidas. */
const BOARDS = [];

const TIPOS = ['Atividade', 'Serviço', 'Relatório', 'Aviso'];

/* Partes de que um aviso se pode compor.
   `campo` diz que controlo desenhar; `kind` separa média de texto. */
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

/* Ordem por que as partes aparecem na paleta e no aviso publicado. */
const ORDEM_BLOCOS = ['titulo', 'imagem', 'data', 'local', 'texto', 'galeria', 'ligacao', 'pdf', 'contacto'];

const QUICK_SEARCHES = ['Atividade', 'Serviço', 'Jovens', 'Relatório'];
