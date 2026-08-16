const FONT = 'Inter, sans-serif';

const COLORS = Object.freeze({
  navy: '#214C8F',
  navyDeep: '#123F7D',
  navySoft: '#1E5EAA',
  orange: '#D13130',
  orangeSoft: '#FCEBEC',
  ink: '#172033',
  muted: '#66758A',
  line: '#DCE6F2',
  surface: '#FFFFFF',
  canvas: '#F4F8FC',
  paleBlue: '#EAF2FA',
});

let sequence = 0;

function id(label) {
  sequence += 1;
  return `modelo_oficial_${label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${sequence}`;
}

function rect(d, t, m) {
  return {
    x: d[0], y: d[1], width: d[2], height: d[3],
    responsive: {
      tablet: { x: t[0], y: t[1], width: t[2], height: t[3] },
      mobile: { x: m[0], y: m[1], width: m[2], height: m[3] },
    },
  };
}

function node(type, name, geometry, props = {}, styles = {}, children = []) {
  const { responsive, ...desktop } = geometry;
  return {
    id: id(name),
    name,
    type,
    props,
    ...desktop,
    locked: false,
    styles,
    zIndex: 0,
    opacity: 1,
    visible: true,
    children,
    rotation: 0,
    responsive,
  };
}

function group(name, geometry, children, styles = {}, props = {}) {
  return node('group', name, geometry, { atomicTemplate: true, ...props }, styles, children);
}

function shape(name, geometry, background, radius = 0, extra = {}) {
  return node('shape', name, geometry, {}, {
    border: '0px solid transparent',
    background,
    backgroundColor: background.startsWith('#') ? background : undefined,
    borderRadius: radius,
    ...extra,
  });
}

function textNode(name, value, geometry, size, weight = 400, color = COLORS.ink, align = 'left', extra = {}) {
  return node('text', name, geometry, { text: value }, {
    color,
    fontSize: size,
    textAlign: align,
    fontFamily: FONT,
    fontWeight: weight,
    lineHeight: 1.25,
    ...extra,
  });
}

function button(name, value, geometry, background = COLORS.navy, color = '#FFFFFF', actionType = 'none', actionValue = '', extra = {}) {
  const { actionTitle, actionMessage, ...styleExtras } = extra;
  return node('button', name, geometry, {
    text: value,
    actionType,
    actionValue,
    actionTarget: 'same',
    ...(actionTitle ? { actionTitle } : {}),
    ...(actionMessage ? { actionMessage } : {}),
  }, {
    color,
    display: 'flex',
    fontSize: 14,
    alignItems: 'center',
    fontFamily: FONT,
    fontWeight: 750,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: background,
    ...styleExtras,
  });
}

function imagePlaceholder(name, geometry, background = COLORS.paleBlue, radius = 18, type = 'image') {
  return node(type, name, geometry, { src: '' }, {
    objectFit: 'cover',
    borderRadius: radius,
    backgroundColor: background,
  });
}

function benefitCard(index, title, body, x, tabletX, tabletY, mobileY) {
  return group(`Benefício ${index} • ${title}`, rect(
    [x, 52, 286, 178], [tabletX, tabletY, 360, 176], [20, mobileY, 350, 164],
  ), [
    shape(`Ícone ${index}`, rect([20, 22, 44, 44], [20, 22, 44, 44], [18, 18, 42, 42]), COLORS.orangeSoft, 12),
    textNode(`Título benefício ${index}`, title, rect([20, 82, 240, 28], [20, 80, 310, 28], [76, 20, 250, 28]), 17, 800, COLORS.navy),
    textNode(`Texto benefício ${index}`, body, rect([20, 116, 246, 46], [20, 114, 315, 46], [76, 54, 250, 72]), 12, 450, COLORS.muted),
  ], { border: `1px solid ${COLORS.line}`, borderRadius: 16, backgroundColor: COLORS.surface, boxShadow: '0 8px 24px rgba(18,63,125,0.06)' });
}

function productCard(index, x, tabletX, tabletY, mobileY) {
  const names = ['Produto Essencial 01', 'Solução Profissional 02', 'Seleção Premium 03', 'Destaque Comercial 04'];
  const prices = ['R$ 29,90', 'R$ 48,50', 'R$ 76,80', 'Consulte'];
  return group(`Produto editável ${index}`, rect(
    [x, 246, 278, 430], [tabletX, tabletY, 332, 430], [20, mobileY, 350, 410],
  ), [
    imagePlaceholder(`Imagem do produto ${index}`, rect([16, 16, 246, 220], [16, 16, 300, 220], [15, 15, 320, 205]), '#F4F8FC', 14, 'productimage'),
    node('productbrand', `Marca produto ${index}`, rect([18, 252, 200, 18], [18, 252, 270, 18], [18, 235, 270, 18]), { text: 'MARCA EDITÁVEL' }, { color: COLORS.orange, fontSize: 10, textAlign: 'left', fontFamily: FONT, fontWeight: 800, lineHeight: 1.25 }),
    node('productname', `Nome produto ${index}`, rect([18, 278, 240, 46], [18, 278, 286, 46], [18, 261, 310, 46]), { text: names[index - 1] }, { color: COLORS.ink, fontSize: 16, textAlign: 'left', fontFamily: FONT, fontWeight: 750, lineHeight: 1.25 }),
    node('productprice', `Preço produto ${index}`, rect([18, 342, 120, 28], [18, 342, 150, 28], [18, 326, 150, 28]), { text: prices[index - 1] }, { color: COLORS.navy, fontSize: 19, textAlign: 'left', fontFamily: FONT, fontWeight: 850, lineHeight: 1.25 }),
    node('productbutton', `Ação produto ${index}`, rect([154, 336, 106, 40], [204, 336, 110, 40], [220, 320, 112, 42]), { text: 'Detalhes', actionType: 'product-info', actionValue: '' }, { color: '#FFFFFF', display: 'flex', fontSize: 13, alignItems: 'center', fontFamily: FONT, fontWeight: 750, borderRadius: 10, justifyContent: 'center', backgroundColor: COLORS.navy }),
  ], { border: `1px solid ${COLORS.line}`, borderRadius: 18, backgroundColor: COLORS.surface, boxShadow: '0 10px 30px rgba(18,63,125,0.08)' });
}

function faqItem(index, title, body, y, tabletY, mobileY) {
  return group(`FAQ ${index} • ${title}`, rect(
    [722, y, 606, 118], [50, tabletY, 734, 116], [20, mobileY, 350, 152],
  ), [
    textNode(`Pergunta ${index}`, title, rect([22, 20, 500, 26], [22, 18, 640, 26], [18, 16, 292, 44]), 15, 800, COLORS.navy),
    textNode(`Resposta ${index}`, body, rect([22, 56, 540, 44], [22, 52, 670, 46], [18, 68, 310, 68]), 12, 450, COLORS.muted),
    textNode(`Sinal FAQ ${index}`, '+', rect([554, 18, 30, 30], [680, 16, 30, 30], [312, 16, 22, 30]), 22, 600, COLORS.orange, 'center'),
  ], { border: `1px solid ${COLORS.line}`, borderRadius: 14, backgroundColor: COLORS.surface });
}

export function buildModeloOficial() {
  sequence = 0;

  const header = group('Header principal editável', rect(
    [0, 0, 1440, 190], [0, 0, 834, 250], [0, 0, 390, 310],
  ), [
    shape('Barra superior', rect([0, 0, 1440, 36], [0, 0, 834, 36], [0, 0, 390, 34]), COLORS.navyDeep),
    textNode('Aviso superior', 'Atendimento consultivo • Entrega planejada • Compra segura', rect([86, 9, 620, 18], [40, 9, 520, 18], [18, 8, 350, 18]), 11, 650, '#FFFFFF'),
    textNode('Marca editável', 'SUA MARCA', rect([86, 67, 240, 42], [40, 65, 220, 42], [18, 54, 190, 38]), 29, 900, COLORS.navy),
    node('search', 'Busca de produtos', rect([370, 61, 590, 50], [276, 59, 510, 50], [18, 108, 354, 48]), { placeholder: 'Busque produtos, marcas ou categorias' }, { border: `1px solid ${COLORS.line}`, borderRadius: 25, backgroundColor: COLORS.canvas }),
    button('Área administrativa', 'Área do lojista', rect([1130, 64, 220, 46], [594, 122, 192, 44], [198, 170, 174, 42]), COLORS.navy, '#FFFFFF', 'url', '/admin'),
    button('CTA cabeçalho', 'Solicitar cotação', rect([970, 64, 145, 46], [420, 122, 158, 44], [18, 170, 164, 42]), COLORS.orange, '#FFFFFF', 'scroll', '#contato'),
    shape('Barra de navegação', rect([0, 132, 1440, 58], [0, 180, 834, 70], [0, 230, 390, 80]), COLORS.navy),
    button('Menu início', 'Início', rect([86, 140, 100, 42], [40, 194, 92, 42], [14, 244, 74, 42]), 'transparent', '#FFFFFF', 'top', '', { fontSize: 12 }),
    button('Menu catálogo', 'Catálogo', rect([190, 140, 110, 42], [136, 194, 100, 42], [92, 244, 84, 42]), 'transparent', '#FFFFFF', 'scroll', '#catalogo', { fontSize: 12 }),
    button('Menu empresa', 'Quem somos', rect([304, 140, 138, 42], [240, 194, 130, 42], [180, 244, 104, 42]), 'transparent', '#FFFFFF', 'scroll', '#quem-somos', { fontSize: 12 }),
    button('Menu contato', 'Contato', rect([446, 140, 105, 42], [374, 194, 102, 42], [288, 244, 88, 42]), 'transparent', '#FFFFFF', 'scroll', '#contato', { fontSize: 12 }),
  ], { backgroundColor: COLORS.surface, boxShadow: '0 2px 14px rgba(18,63,125,0.08)' });

  const hero = group('Hero banner principal', rect(
    [0, 190, 1440, 640], [0, 250, 834, 680], [0, 310, 390, 880],
  ), [
    shape('Fundo do hero', rect([0, 0, 1440, 640], [0, 0, 834, 680], [0, 0, 390, 880]), 'linear-gradient(135deg, #F4F8FC 0%, #EAF2FA 100%)'),
    textNode('Selo do hero', 'SOLUÇÕES PARA NEGÓCIOS', rect([86, 100, 400, 24], [50, 74, 350, 24], [20, 54, 320, 24]), 12, 850, COLORS.orange, 'left', { letterSpacing: '0.08em' }),
    textNode('Título principal', 'Catálogo inteligente para negócios que querem crescer.', rect([86, 140, 610, 166], [50, 112, 650, 140], [20, 92, 350, 176]), 46, 900, COLORS.navy, 'left', { lineHeight: 1.12 }),
    textNode('Texto do hero', 'Apresente seu portfólio, organize oportunidades e facilite o contato comercial em uma experiência moderna e configurável.', rect([86, 328, 570, 90], [50, 272, 620, 76], [20, 286, 350, 110]), 17, 450, COLORS.muted, 'left', { lineHeight: 1.45 }),
    button('CTA hero catálogo', 'Explorar catálogo', rect([86, 458, 180, 52], [50, 376, 180, 50], [20, 426, 168, 50]), COLORS.orange, '#FFFFFF', 'scroll', '#catalogo'),
    button('CTA hero contato', 'Falar com especialista', rect([282, 458, 210, 52], [246, 376, 210, 50], [202, 426, 168, 50]), COLORS.surface, COLORS.navy, 'scroll', '#contato', { border: `1px solid ${COLORS.line}` }),
    imagePlaceholder('Imagem principal substituível', rect([800, 70, 550, 500], [50, 462, 734, 184], [20, 516, 350, 330]), '#DCE6F2', 28),
    textNode('Legenda placeholder hero', 'PLACEHOLDER DE IMAGEM OU BANNER', rect([870, 292, 410, 30], [202, 540, 430, 28], [62, 660, 266, 48]), 12, 750, '#FFFFFF', 'center'),
  ]);

  const benefits = group('Benefícios e diferenciais', rect(
    [0, 830, 1440, 300], [0, 930, 834, 460], [0, 1190, 390, 810],
  ), [
    textNode('Título benefícios', 'Uma estrutura pronta para vender melhor', rect([86, 20, 650, 38], [40, 18, 650, 38], [20, 18, 350, 60]), 28, 850, COLORS.navy),
    benefitCard(1, 'Portfólio organizado', 'Categorias, marcas e produtos com gestão centralizada.', 86, 40, 78, 96),
    benefitCard(2, 'Compra simplificada', 'Busca, filtros e chamadas comerciais em poucos cliques.', 390, 434, 78, 276),
    benefitCard(3, 'Atendimento próximo', 'Canais configuráveis para orçamento e relacionamento.', 694, 40, 270, 456),
    benefitCard(4, 'Conteúdo flexível', 'Blocos, textos, cores e imagens totalmente editáveis.', 998, 434, 270, 636),
  ], { backgroundColor: COLORS.surface });

  const brands = group('Marcas em destaque', rect(
    [0, 1130, 1440, 250], [0, 1390, 834, 270], [0, 2000, 390, 430],
  ), [
    textNode('Título marcas', 'Marcas em destaque', rect([86, 34, 400, 36], [40, 28, 400, 36], [20, 24, 350, 38]), 26, 850, COLORS.navy),
    textNode('Texto marcas', 'Cadastre e reorganize os itens pelo painel.', rect([86, 76, 500, 26], [40, 70, 500, 26], [20, 66, 350, 42]), 13, 450, COLORS.muted),
    ...Array.from({ length: 5 }, (_, i) => group(`Marca placeholder ${i + 1}`, rect(
      [86 + (i * 250), 126, 220, 82],
      [40 + ((i % 3) * 252), 120 + (Math.floor(i / 3) * 94), 228, 78],
      [20 + ((i % 2) * 180), 124 + (Math.floor(i / 2) * 92), 170, 72],
    ), [textNode(`Nome marca ${i + 1}`, `MARCA ${String(i + 1).padStart(2, '0')}`, rect([20, 28, 180, 26], [20, 26, 188, 26], [12, 24, 146, 26]), 13, 800, COLORS.navy, 'center')], { border: `1px solid ${COLORS.line}`, borderRadius: 12, backgroundColor: COLORS.canvas })),
  ], { backgroundColor: COLORS.canvas });

  const promos = group('Banners promocionais editáveis', rect(
    [0, 1380, 1440, 460], [0, 1660, 834, 540], [0, 2430, 390, 780],
  ), [
    group('Banner campanha principal', rect([86, 58, 790, 344], [40, 42, 754, 230], [20, 34, 350, 330]), [
      shape('Fundo campanha principal', rect([0, 0, 790, 344], [0, 0, 754, 230], [0, 0, 350, 330]), 'linear-gradient(120deg, #214C8F 0%, #1E5EAA 100%)', 22),
      textNode('Selo campanha', 'CAMPANHA EDITÁVEL', rect([42, 48, 280, 22], [34, 30, 260, 22], [24, 28, 260, 22]), 11, 850, '#FFBC85'),
      textNode('Título campanha', 'Condições especiais para o seu negócio', rect([42, 84, 440, 92], [34, 60, 420, 70], [24, 62, 300, 102]), 31, 850, '#FFFFFF'),
      textNode('Texto campanha', 'Troque título, texto, chamada e imagem diretamente no editor.', rect([42, 190, 430, 56], [34, 136, 420, 46], [24, 176, 300, 64]), 14, 450, '#DCE8F4'),
      button('CTA campanha', 'Conhecer condições', rect([42, 268, 190, 46], [34, 178, 190, 42], [24, 258, 190, 46]), COLORS.orange, '#FFFFFF', 'scroll', '#contato'),
      imagePlaceholder('Imagem campanha', rect([540, 40, 210, 264], [534, 25, 190, 180], [236, 246, 88, 60]), '#40658A', 16),
    ]),
    group('Banner oferta secundária', rect([902, 58, 452, 344], [40, 292, 754, 206], [20, 382, 350, 350]), [
      shape('Fundo oferta secundária', rect([0, 0, 452, 344], [0, 0, 754, 206], [0, 0, 350, 350]), COLORS.orangeSoft, 22),
      textNode('Selo oferta', 'DESTAQUE DA SEMANA', rect([34, 42, 260, 22], [32, 26, 280, 22], [24, 30, 280, 22]), 11, 850, COLORS.orange),
      textNode('Título oferta', 'Oferta personalizada', rect([34, 78, 350, 76], [32, 56, 360, 46], [24, 64, 290, 70]), 27, 850, COLORS.navy),
      textNode('Texto oferta', 'Use este espaço para promoções, lançamentos ou avisos comerciais.', rect([34, 166, 350, 70], [410, 56, 300, 70], [24, 146, 290, 76]), 14, 450, COLORS.muted),
      button('CTA oferta', 'Ver ofertas', rect([34, 266, 150, 44], [410, 132, 150, 42], [24, 246, 145, 44]), COLORS.navy, '#FFFFFF', 'scroll', '#promocoes'),
      imagePlaceholder('Imagem oferta', rect([276, 246, 140, 70], [590, 116, 130, 70], [192, 242, 132, 80]), '#F4C29B', 14),
    ]),
  ], { backgroundColor: COLORS.surface });

  const showcase = group('Curadoria de produtos editável', rect(
    [0, 1840, 1440, 1010], [0, 2200, 834, 1240], [0, 3210, 390, 2020],
  ), [
    textNode('Selo produtos', 'CURADORIA DO CATÁLOGO', rect([86, 60, 350, 22], [40, 44, 350, 22], [20, 34, 330, 22]), 11, 850, COLORS.orange),
    textNode('Título produtos', 'Produtos que merecem destaque', rect([86, 94, 720, 48], [40, 76, 700, 48], [20, 64, 350, 76]), 34, 880, COLORS.navy),
    textNode('Texto produtos', 'Os cards são vinculáveis ao cadastro e cada elemento pode ser ajustado individualmente.', rect([86, 150, 760, 46], [40, 128, 720, 46], [20, 148, 350, 62]), 14, 450, COLORS.muted),
    button('Ação ver todos', 'Ver catálogo completo', rect([1130, 100, 224, 46], [570, 174, 224, 46], [20, 220, 350, 46]), COLORS.navy, '#FFFFFF', 'scroll', '#catalogo'),
    productCard(1, 86, 40, 246, 300),
    productCard(2, 390, 462, 246, 730),
    productCard(3, 694, 40, 704, 1160),
    productCard(4, 998, 462, 704, 1590),
    group('Faixa comercial da curadoria', rect([86, 730, 1216, 200], [40, 1170, 754, 54], [20, 2020, 350, 1]), [
      shape('Fundo faixa comercial', rect([0, 0, 1216, 200], [0, 0, 754, 54], [0, 0, 350, 1]), COLORS.paleBlue, 18),
      textNode('Título faixa comercial', 'Precisa de uma seleção personalizada?', rect([40, 46, 620, 42], [24, 14, 440, 28], [0, 0, 1, 1]), 25, 850, COLORS.navy),
      textNode('Texto faixa comercial', 'Use o canal comercial para montar uma proposta conforme sua operação.', rect([40, 98, 650, 46], [24, 38, 500, 1], [0, 0, 1, 1]), 14, 450, COLORS.muted),
      button('CTA faixa comercial', 'Solicitar proposta', rect([950, 76, 220, 48], [546, 6, 184, 42], [0, 0, 1, 1]), COLORS.orange, '#FFFFFF', 'scroll', '#contato'),
    ]),
  ], { backgroundColor: COLORS.canvas });

  const institutional = group('Quem somos institucional', rect(
    [0, 2850, 1440, 700], [0, 3440, 834, 760], [0, 5230, 390, 920],
  ), [
    imagePlaceholder('Imagem institucional', rect([86, 80, 570, 540], [40, 52, 754, 260], [20, 36, 350, 320]), '#B8C5D4', 24),
    textNode('Selo institucional', 'QUEM SOMOS', rect([742, 108, 260, 22], [40, 350, 260, 22], [20, 390, 260, 22]), 11, 850, COLORS.orange),
    textNode('Título institucional', 'Uma história fictícia pronta para receber a sua marca', rect([742, 146, 560, 118], [40, 384, 720, 80], [20, 424, 350, 126]), 34, 880, COLORS.navy),
    textNode('Texto institucional', 'Este conteúdo é demonstrativo e não reproduz textos de terceiros. Edite a trajetória, os valores, os diferenciais e os números da sua empresa pelo painel.', rect([742, 286, 550, 118], [40, 482, 720, 90], [20, 566, 350, 138]), 15, 450, COLORS.muted, 'left', { lineHeight: 1.5 }),
    button('CTA institucional', 'Saiba mais', rect([742, 438, 150, 48], [40, 600, 150, 48], [20, 730, 150, 48]), COLORS.navy, '#FFFFFF', 'custom-page', '#quem-somos'),
    group('Indicador institucional 1', rect([742, 524, 160, 70], [40, 670, 220, 60], [20, 812, 104, 70]), [textNode('Número indicador 1', '+20', rect([0, 0, 150, 36], [0, 0, 210, 34], [0, 0, 100, 34]), 25, 900, COLORS.orange), textNode('Rótulo indicador 1', 'anos de experiência', rect([0, 38, 150, 22], [0, 34, 210, 22], [0, 36, 104, 32]), 11, 550, COLORS.muted)]),
    group('Indicador institucional 2', rect([934, 524, 160, 70], [292, 670, 220, 60], [140, 812, 104, 70]), [textNode('Número indicador 2', '+500', rect([0, 0, 150, 36], [0, 0, 210, 34], [0, 0, 100, 34]), 25, 900, COLORS.orange), textNode('Rótulo indicador 2', 'clientes atendidos', rect([0, 38, 150, 22], [0, 34, 210, 22], [0, 36, 104, 32]), 11, 550, COLORS.muted)]),
    group('Indicador institucional 3', rect([1126, 524, 176, 70], [544, 670, 220, 60], [260, 812, 110, 70]), [textNode('Número indicador 3', '98%', rect([0, 0, 166, 36], [0, 0, 210, 34], [0, 0, 106, 34]), 25, 900, COLORS.orange), textNode('Rótulo indicador 3', 'satisfação estimada', rect([0, 38, 166, 22], [0, 34, 210, 22], [0, 36, 110, 32]), 11, 550, COLORS.muted)]),
  ], { backgroundColor: COLORS.surface }, { anchorId: 'quem-somos' });

  const testimonials = group('Depoimentos de clientes', rect(
    [0, 3550, 1440, 500], [0, 4200, 834, 620], [0, 6150, 390, 1060],
  ), [
    textNode('Selo depoimentos', 'DEPOIMENTOS', rect([86, 52, 280, 22], [40, 36, 280, 22], [20, 30, 300, 22]), 11, 850, COLORS.orange),
    textNode('Título depoimentos', 'Experiências que constroem confiança', rect([86, 84, 700, 48], [40, 68, 700, 48], [20, 60, 350, 82]), 32, 880, COLORS.navy),
    ...[1, 2, 3].map((index) => group(`Depoimento ${index}`, rect(
      [86 + ((index - 1) * 416), 178, 384, 244],
      [40 + (((index - 1) % 2) * 394), 156 + (Math.floor((index - 1) / 2) * 240), 360, 218],
      [20, 166 + ((index - 1) * 286), 350, 260],
    ), [
      textNode(`Aspas depoimento ${index}`, '“', rect([24, 18, 36, 40], [22, 16, 36, 40], [20, 18, 36, 40]), 36, 900, COLORS.orange),
      textNode(`Texto depoimento ${index}`, `Depoimento fictício ${index}. Substitua este texto por uma experiência real autorizada pelo cliente.`, rect([24, 66, 336, 86], [22, 62, 316, 82], [20, 68, 310, 92]), 14, 450, COLORS.ink, 'left', { lineHeight: 1.45 }),
      textNode(`Nome depoimento ${index}`, `Cliente Exemplo ${index}`, rect([24, 174, 220, 24], [22, 160, 220, 24], [20, 182, 240, 24]), 13, 800, COLORS.navy),
      textNode(`Cargo depoimento ${index}`, 'Empresa demonstrativa', rect([24, 202, 230, 20], [22, 186, 230, 20], [20, 212, 240, 20]), 11, 500, COLORS.muted),
    ], { border: `1px solid ${COLORS.line}`, borderRadius: 16, backgroundColor: COLORS.surface, boxShadow: '0 8px 26px rgba(18,63,125,0.06)' })),
  ], { backgroundColor: COLORS.canvas }, { anchorId: 'depoimentos' });

  const faq = group('Perguntas frequentes', rect(
    [0, 4050, 1440, 700], [0, 4820, 834, 850], [0, 7210, 390, 1210],
  ), [
    textNode('Selo FAQ', 'DÚVIDAS FREQUENTES', rect([86, 70, 300, 22], [40, 48, 300, 22], [20, 34, 320, 22]), 11, 850, COLORS.orange),
    textNode('Título FAQ', 'Informações rápidas para facilitar a decisão', rect([86, 106, 520, 106], [40, 82, 720, 78], [20, 66, 350, 112]), 34, 880, COLORS.navy),
    textNode('Texto FAQ', 'Todas as perguntas e respostas podem ser substituídas ou removidas conforme a necessidade.', rect([86, 236, 500, 82], [40, 176, 720, 52], [20, 194, 350, 82]), 15, 450, COLORS.muted, 'left', { lineHeight: 1.5 }),
    button('CTA FAQ', 'Ainda tenho dúvidas', rect([86, 356, 190, 48], [40, 252, 190, 48], [20, 296, 190, 48]), COLORS.orange, '#FFFFFF', 'scroll', '#contato'),
    faqItem(1, 'Como personalizo este modelo?', 'Selecione qualquer elemento no editor e altere textos, cores, posições, imagens e ações.', 66, 330, 390),
    faqItem(2, 'Os produtos são dinâmicos?', 'Sim. Os cards podem ser vinculados aos produtos cadastrados no catálogo.', 204, 466, 562),
    faqItem(3, 'O layout funciona no celular?', 'Sim. O modelo inclui posições específicas para desktop, tablet e mobile.', 342, 602, 734),
    faqItem(4, 'Posso ocultar uma seção?', 'Sim. Cada bloco pode ser desativado, reorganizado, duplicado ou excluído.', 480, 738, 906),
  ], { backgroundColor: COLORS.surface });

  const newsletter = group('Contato e newsletter', rect(
    [0, 4750, 1440, 450], [0, 5670, 834, 440], [0, 8420, 390, 600],
  ), [
    shape('Fundo contato newsletter', rect([86, 66, 1268, 300], [40, 46, 754, 348], [20, 38, 350, 520]), 'linear-gradient(120deg, #214C8F 0%, #123F7D 100%)', 24),
    textNode('Selo contato', 'MANTENHA O RELACIONAMENTO', rect([132, 112, 340, 22], [76, 82, 330, 22], [44, 72, 300, 22]), 11, 850, '#FFBC85'),
    textNode('Título contato', 'Receba novidades e oportunidades', rect([132, 146, 510, 82], [76, 116, 660, 54], [44, 106, 300, 104]), 30, 880, '#FFFFFF'),
    textNode('Texto contato', 'Conteúdo demonstrativo para newsletter ou chamada comercial.', rect([132, 238, 500, 50], [76, 178, 650, 46], [44, 220, 300, 62]), 14, 450, '#DCE8F4'),
    node('search', 'Campo de e-mail', rect([760, 150, 370, 54], [76, 248, 500, 52], [44, 312, 302, 52]), { placeholder: 'Seu melhor e-mail' }, { border: '1px solid rgba(255,255,255,0.35)', borderRadius: 12, backgroundColor: '#FFFFFF' }),
    button('Cadastrar newsletter', 'Cadastrar', rect([1146, 150, 160, 54], [594, 248, 150, 52], [44, 380, 302, 52]), COLORS.orange, '#FFFFFF', 'custom-form', 'newsletter', { actionTitle: 'Cadastro de newsletter' }),
    button('Contato comercial', 'Falar com atendimento', rect([760, 230, 240, 50], [76, 318, 240, 50], [44, 454, 302, 50]), COLORS.surface, COLORS.navy, 'custom-form', 'contato', { actionTitle: 'Fale com atendimento' }),
  ], { backgroundColor: COLORS.canvas }, { anchorId: 'contato' });

  const footer = group('Rodapé completo editável', rect(
    [0, 5200, 1440, 550], [0, 6110, 834, 700], [0, 9020, 390, 960],
  ), [
    shape('Fundo do rodapé', rect([0, 0, 1440, 550], [0, 0, 834, 700], [0, 0, 390, 960]), COLORS.navyDeep),
    textNode('Marca rodapé', 'SUA MARCA', rect([86, 80, 250, 38], [40, 54, 250, 38], [20, 42, 260, 38]), 25, 900, '#FFFFFF'),
    textNode('Descrição rodapé', 'Apresente aqui uma descrição curta e autoral sobre sua empresa.', rect([86, 132, 330, 72], [40, 104, 330, 72], [20, 94, 350, 72]), 13, 450, '#C8D5E2'),
    textNode('Título coluna empresa', 'Empresa', rect([520, 80, 180, 28], [40, 222, 180, 28], [20, 214, 180, 28]), 15, 800, '#FFFFFF'),
    textNode('Links empresa', 'Quem somos\nBenefícios\nDepoimentos\nContato', rect([520, 122, 220, 140], [40, 264, 260, 120], [20, 256, 300, 130]), 13, 450, '#C8D5E2', 'left', { lineHeight: 1.8 }),
    textNode('Título coluna catálogo', 'Catálogo', rect([790, 80, 180, 28], [312, 222, 180, 28], [20, 410, 180, 28]), 15, 800, '#FFFFFF'),
    textNode('Links catálogo', 'Produtos\nCategorias\nMarcas\nOfertas', rect([790, 122, 220, 140], [312, 264, 220, 120], [20, 452, 300, 130]), 13, 450, '#C8D5E2', 'left', { lineHeight: 1.8 }),
    textNode('Título coluna atendimento', 'Atendimento', rect([1060, 80, 220, 28], [560, 222, 220, 28], [20, 606, 220, 28]), 15, 800, '#FFFFFF'),
    textNode('Dados atendimento', 'Segunda a sexta • 08h às 18h\ncontato@suaempresa.com.br\n(00) 0000-0000', rect([1060, 122, 290, 120], [560, 264, 230, 120], [20, 648, 350, 114]), 13, 450, '#C8D5E2', 'left', { lineHeight: 1.7 }),
    button('Botão voltar ao topo', 'Voltar ao topo', rect([1130, 330, 220, 46], [574, 432, 220, 46], [20, 786, 350, 46]), COLORS.orange, '#FFFFFF', 'top'),
    shape('Linha do rodapé', rect([86, 414, 1268, 1], [40, 522, 754, 1], [20, 862, 350, 1]), '#3B526B'),
    textNode('Copyright editável', '© 2026 Sua Marca • Template premium 100% editável', rect([86, 448, 720, 28], [40, 552, 700, 28], [20, 890, 350, 48]), 12, 500, '#91A4B7'),
  ]);

  const page = node('page', 'Modelo Oficial', rect(
    [0, 0, 1440, 5750], [0, 0, 834, 6810], [0, 0, 390, 9980],
  ), { autoExtend: true, continuous: true, viewportGuide: true }, { backgroundColor: COLORS.canvas }, [
    header,
    hero,
    benefits,
    brands,
    promos,
    showcase,
    institutional,
    testimonials,
    faq,
    newsletter,
    footer,
  ]);

  return {
    id: 'tpl_modelo_oficial',
    company_id: 'cmp_asteryon',
    system_key: 'modelo-oficial',
    name: 'Modelo Oficial',
    description: 'Template premium modular, responsivo e totalmente editável, com header, hero, benefícios, marcas, campanhas, produtos, institucional, depoimentos, FAQ, contato e rodapé.',
    category: 'premium',
    tags: ['premium', 'responsivo', 'b2b', 'catálogo', 'editável'],
    accent: COLORS.orange,
    nodes: [page],
    active: true,
    data: {
      isSystem: true,
      editable: true,
      responsive: true,
      versionLabel: 'Modelo Oficial v1',
      palette: COLORS,
    },
  };
}

export { COLORS };

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(JSON.stringify(buildModeloOficial()));
}
