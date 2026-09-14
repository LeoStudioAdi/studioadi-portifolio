#!/usr/bin/env node
/**
 * Studio ADI — gerador do site estático.
 *
 * Lê tudo que está em /content (texto e imagens que o painel /admin edita)
 * e gera /dist (o site pronto que o Netlify publica). Não usa nenhuma
 * biblioteca externa de propósito — assim o "npm install" no Netlify não
 * depende de nada além do Node.js, o que torna o deploy mais rápido e
 * muito mais difícil de quebrar.
 *
 * Rodar localmente:  node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');
const DIST_DIR = path.join(ROOT, 'dist');

// =====================================================================
// 1) Um parser de YAML "suficiente" — sem dependências externas.
//    Entende exatamente o que o Decap CMS (o painel /admin) escreve:
//    strings, números, booleanos, listas de objetos e mapas aninhados,
//    com indentação de 2 espaços. Não é um parser de YAML completo de
//    propósito geral — é o bastante para o conteúdo deste site.
// =====================================================================

function stripQuotes(s) {
  s = s.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    const q = s[0];
    let inner = s.slice(1, -1);
    if (q === '"') {
      inner = inner
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else {
      inner = inner.replace(/''/g, "'");
    }
    return inner;
  }
  return s;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return stripQuotes(s);
}

function indentOf(line) {
  const m = line.match(/^ */);
  return m[0].length;
}

// Recebe as linhas (já sem comentários/linhas vazias) a partir de `start`,
// e devolve [valor, próximoÍndice] respeitando a indentação mínima `minIndent`.
function parseBlock(lines, start, minIndent) {
  if (start >= lines.length) return [null, start];
  const firstIndent = indentOf(lines[start]);
  if (firstIndent < minIndent) return [null, start];

  const isList = lines[start].trim().startsWith('- ') || lines[start].trim() === '-';

  if (isList) {
    const arr = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }
      const ind = indentOf(line);
      if (ind < firstIndent) break;
      if (ind > firstIndent) break; // pertence a outro nível, tratado recursivamente
      const trimmed = line.trim();
      if (!(trimmed.startsWith('- '))) break;
      const rest = trimmed.slice(2);
      if (rest.includes(':')) {
        // item de lista é um mapa — o resto da linha é o primeiro par key: value
        const fakeLine = ' '.repeat(firstIndent + 2) + rest;
        const [obj, next] = parseBlock([...lines.slice(0, i), fakeLine, ...lines.slice(i + 1)], i, firstIndent + 2);
        arr.push(obj);
        i = next;
      } else {
        arr.push(parseScalar(rest));
        i++;
      }
    }
    return [arr, i];
  }

  // mapa
  const obj = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const ind = indentOf(line);
    if (ind < firstIndent) break;
    if (ind > firstIndent) break; // não deveria acontecer se chamado corretamente
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) { i++; continue; }
    const key = trimmed.slice(0, colonIdx).trim();
    const valueRaw = trimmed.slice(colonIdx + 1).trim();
    if (valueRaw === '') {
      // O valor está no bloco seguinte: um mapa aninhado (indentação maior
      // que a chave) ou uma lista "sem indentação extra" (o estilo padrão
      // do js-yaml/PyYAML, onde os "- item" ficam no MESMO nível da chave).
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      let childMinIndent = ind + 1;
      if (j < lines.length) {
        const nextTrim = lines[j].trim();
        const nextInd = indentOf(lines[j]);
        if ((nextTrim.startsWith('- ') || nextTrim === '-') && nextInd === ind) {
          childMinIndent = ind; // lista sem indentação extra
        }
      }
      const [child, next] = parseBlock(lines, i + 1, childMinIndent);
      obj[key] = child === null ? '' : child;
      i = next;
    } else {
      obj[key] = parseScalar(valueRaw);
      i++;
    }
  }
  return [obj, i];
}

function parseYaml(text) {
  const rawLines = text.split('\n');
  const lines = [];
  for (const line of rawLines) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) { lines.push(''); continue; }
    lines.push(line.replace(/\s+$/, ''));
  }
  const [obj] = parseBlock(lines, 0, 0);
  return obj || {};
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  return { data: parseYaml(m[1]), body: m[2] };
}

// =====================================================================
// 2) Texto: "**destaque**" -> <em>destaque</em> (títulos e frases curtas)
//    Markdown simples para o corpo dos projetos (parágrafos + itálico).
// =====================================================================

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Para campos curtos (frontmatter): não escapa — o texto já é confiável
// (vem do CMS do próprio dono do site), só converte **destaque**.
function accent(s) {
  if (s == null) return '';
  return String(s).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>');
}

function linesToBr(...lines) {
  return lines.filter((l) => l !== undefined && l !== null && l !== '').map(accent).join('<br/>\n      ');
}

// Corpo markdown -> HTML (parágrafos separados por linha em branco,
// *itálico* e **negrito**). Propositalmente simples.
function renderBody(md) {
  const escaped = escapeHtml(md.trim());
  const withMarks = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
  const paragraphs = withMarks
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `      <p class="projeto-desc">${p.replace(/\n/g, ' ')}</p>`);
  return paragraphs.join('\n');
}

// =====================================================================
// 3) Cores das paletas e categorias — precisam bater com dist/css/style.css.
//    Usadas só para decidir automaticamente quando o menu lateral deve
//    ficar claro ou escuro sobre cada trecho da página (evita ter que
//    manter essa lista manualmente, como no site original).
// =====================================================================

const CATEGORIA_BG = {
  'cat-01': '#000000',
  'cat-02': '#E6E0D5',
  'cat-03': '#ebe3d3',
  'cat-04': '#E4E4E4',
  'cat-05': '#2a2a2a',
  'cat-06': '#E6E0D5',
};

const PALETA_BG = {
  'paleta-areia': '#ebe3d3',
  'paleta-neblina': '#eef2f1',
  'paleta-carvao': '#000000',
  'paleta-pedra': '#e8e6df',
  'paleta-nogueira': '#1f1a14',
  'paleta-osso': '#f0eadd',
  'paleta-marfim': '#f1ede4',
  'paleta-cacau': '#2e2519',
  'paleta-grafite': '#1d2226',
};

function isDarkHex(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma < 140;
}

// =====================================================================
// 4) Números por extenso (para "Sete projetos", como no site original)
// =====================================================================

const NUM_EXTENSO = [
  'Zero', 'Um', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito',
  'Nove', 'Dez', 'Onze', 'Doze', 'Treze', 'Catorze', 'Quinze', 'Dezesseis',
  'Dezessete', 'Dezoito', 'Dezenove', 'Vinte',
];
function numeroExtenso(n) {
  if (n >= 0 && n < NUM_EXTENSO.length) return NUM_EXTENSO[n];
  return String(n);
}

// =====================================================================
// 5) Leitura do conteúdo
// =====================================================================

function readSettings() {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, 'settings.yml'), 'utf-8');
  return parseYaml(raw);
}

function readProjetos() {
  const dir = path.join(CONTENT_DIR, 'projetos');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  return files.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    const { data, body } = parseFrontmatter(raw);
    return { slug: f.replace(/\.md$/, ''), ...data, bodyHtml: renderBody(body) };
  });
}

// =====================================================================
// 6) Templates HTML
// =====================================================================

function renderDado(d) {
  return `      <div class="dado">
        <span class="label">${accent(d.label)}</span>
        <span class="val">${accent(d.valor)}</span>
      </div>`;
}

function renderGaleriaItem(g) {
  return `    <figure class="${escapeHtml(g.formato)}">
      <img src="${escapeHtml(g.imagem)}" alt="${escapeHtml(g.alt)}" loading="lazy" />
    </figure>`;
}

function renderProjeto(p, indexInCat, totalInCat) {
  const num = String(indexInCat).padStart(2, '0');
  const total = String(totalInCat).padStart(2, '0');
  const heroStyle = p.hero_foco ? ` style="object-position: ${escapeHtml(p.hero_foco)};"` : '';
  const linhaDestaque = p.linha_destaque ? '\n    <div class="accent-line"></div>' : '';
  return `
  <article class="projeto ${escapeHtml(p.paleta)}">
    <div class="projeto-head">
      <span>Projeto · ${num} / ${total}</span>
      <span>${accent(p.categoria_nome)} · ${accent(p.titulo).replace(/<\/?em>/g, '')}</span>
    </div>
    <div class="projeto-hero">
      <img src="${escapeHtml(p.hero_imagem)}" alt="${escapeHtml(p.hero_alt)}"${heroStyle} />
      ${p.hero_legenda ? `<span class="projeto-hero-cap">— ${escapeHtml(p.hero_legenda)}</span>` : ''}
    </div>${linhaDestaque}
    <div class="projeto-corpo">
      <div>
        <h3 class="projeto-titulo">${accent(p.titulo)}</h3>
        <p class="projeto-localizacao">${escapeHtml(p.local)}</p>
${p.bodyHtml}
      </div>
      <div class="projeto-dados">
${(p.dados || []).map(renderDado).join('\n')}
      </div>
    </div>
    <div class="projeto-galeria">
${(p.galeria || []).map(renderGaleriaItem).join('\n')}
    </div>
  </article>`;
}

function renderCategoriaAbertura(cat, projetos, paginaNum) {
  const count = projetos.length;
  const badge = String(count).padStart(2, '0');
  const extenso = `${numeroExtenso(count)} projeto${count === 1 ? '' : 's'}`;
  return `
  <section class="cat-abrir ${escapeHtml(cat.slug)}" id="${escapeHtml(cat.slug)}">
    <div class="cat-abrir-top">
      <div>
        <div class="cat-abrir-marca">Studio ADI<em>®</em></div>
        <div class="cat-abrir-num">— ${cat.slug.replace('cat-', '')} / ${escapeHtml(cat.nome)}</div>
      </div>
      <div class="cat-abrir-info">
        ${escapeHtml(extenso)}<br/>
        ${escapeHtml(cat.periodo)}<br/>
        ${escapeHtml(cat.local)}
      </div>
    </div>
    <div class="cat-abrir-meio">
      <h2 class="cat-abrir-titulo">
        ${linesToBr(cat.frase_abertura_linha1, cat.frase_abertura_linha2, cat.frase_abertura_linha3)}
      </h2>
    </div>
    <div class="cat-abrir-foot">
      <div class="cat-abrir-foot-titulo">${escapeHtml(cat.nome)} · ${badge} projeto${count === 1 ? '' : 's'}</div>
      <div class="cat-abrir-foot-pag">— ${String(paginaNum).padStart(2, '0')}</div>
    </div>
  </section>`;
}

function renderAsideItem(cat, count) {
  return `      <li>
        <a href="#${escapeHtml(cat.slug)}">
          <span class="aside-num">${cat.slug.replace('cat-', '')}</span>
          <span class="aside-name">${escapeHtml(cat.nome)}</span>
          <span class="aside-count">${String(count).padStart(2, '0')}</span>
        </a>
      </li>`;
}

function renderIndiceItem(cat, count) {
  return `    <a class="indice-item" href="#${escapeHtml(cat.slug)}">
      <span class="num">${cat.slug.replace('cat-', '')}</span>
      <span class="nome">${accent(cat.nome_indice)}</span>
      <span class="desc">${escapeHtml(cat.desc_indice)}</span>
      <span class="count">${String(count).padStart(2, '0')} projeto${count === 1 ? '' : 's'}</span>
    </a>`;
}

function build() {
  const settings = readSettings();
  const projetos = readProjetos();

  // nome da categoria em cada projeto (útil no cabeçalho "Projeto · 01/07")
  const catBySlug = {};
  (settings.categorias || []).forEach((c) => { catBySlug[c.slug] = c; });
  projetos.forEach((p) => { p.categoria_nome = (catBySlug[p.categoria] || {}).nome || ''; });

  // agrupa e ordena projetos por categoria
  const porCategoria = {};
  for (const p of projetos) {
    if (!porCategoria[p.categoria]) porCategoria[p.categoria] = [];
    porCategoria[p.categoria].push(p);
  }
  Object.values(porCategoria).forEach((arr) => arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));

  // seções escuras (para o menu lateral trocar de claro pra escuro)
  const darkSelectors = ['.capa', '.manifesto', '.contato'];
  (settings.categorias || []).forEach((c) => {
    if (CATEGORIA_BG[c.slug] && isDarkHex(CATEGORIA_BG[c.slug])) darkSelectors.push(`.${c.slug}`);
  });
  const paletasUsadas = new Set(projetos.map((p) => p.paleta));
  paletasUsadas.forEach((pal) => {
    if (PALETA_BG[pal] && isDarkHex(PALETA_BG[pal])) darkSelectors.push(`.${pal}`);
  });

  // corpo principal: capa, manifesto, índice, e depois cada categoria
  // (abertura + projetos) na ordem definida em settings.categorias.
  let paginaNum = 1; // capa = página 1
  const categoriasHtml = [];
  for (const cat of settings.categorias || []) {
    const projs = porCategoria[cat.slug] || [];
    if (projs.length === 0) continue; // igual ao site original: sem projeto, sem página de abertura
    paginaNum += 1;
    categoriasHtml.push(renderCategoriaAbertura(cat, projs, paginaNum));
    projs.forEach((p, idx) => {
      categoriasHtml.push(renderProjeto(p, idx + 1, projs.length));
    });
  }

  const asideItens = (settings.categorias || [])
    .map((c) => renderAsideItem(c, (porCategoria[c.slug] || []).length))
    .join('\n');

  const indiceItens = (settings.categorias || [])
    .map((c) => renderIndiceItem(c, (porCategoria[c.slug] || []).length))
    .join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(settings.site_title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@100;200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body class="scope-default dark-aside">
  <aside class="aside">
    <div class="marca">
      <img class="marca-img is-light" src="${escapeHtml(settings.marca.logo_claro)}" alt="Studio ADI" />
      <img class="marca-img is-dark" src="${escapeHtml(settings.marca.logo_escuro)}" alt="Studio ADI" />
      <span class="marca-text">${accent(settings.marca.nome)}<br/>${escapeHtml(settings.marca.subtitulo)}</span>
    </div>
    <div class="aside-tag">Categorias</div>
    <ul class="aside-list">
${asideItens}
    </ul>
    <div class="aside-foot">${escapeHtml(settings.rodape_menu.cidade)}<br/>${escapeHtml(settings.rodape_menu.email)}</div>
  </aside>

  <main>
    <section class="capa" id="capa">
      <div class="capa-top">
        <div class="capa-marca-txt">${accent(settings.marca.nome)}</div>
        <div class="info-block">
          ${escapeHtml(settings.capa.info_linha1)}<br/>
          ${escapeHtml(settings.capa.info_linha2)}<br/>
          ${escapeHtml(settings.capa.info_linha3)}
        </div>
      </div>
      <div class="capa-meio">
        <img class="capa-logo" src="${escapeHtml(settings.marca.logo_escuro)}" alt="Studio ADI" />
        <div class="capa-descritiva">
          <div class="l1">${escapeHtml(settings.capa.descritiva_l1)}</div>
          <div class="l2">${escapeHtml(settings.capa.descritiva_l2)}</div>
          <div class="l3">${escapeHtml(settings.capa.descritiva_l3)}</div>
        </div>
      </div>
      <div class="capa-base">
        <p class="descricao">${escapeHtml(settings.capa.descricao)}</p>
        <span>— 01</span>
      </div>
    </section>

    <section class="manifesto" id="manifesto">
      <div class="manifesto-tag">— Manifesto</div>
      <h2 class="manifesto-frase">
        ${linesToBr(settings.manifesto.frase_linha1, settings.manifesto.frase_linha2, settings.manifesto.frase_linha3)}
      </h2>
      <p class="manifesto-sub">${escapeHtml(settings.manifesto.subtitulo)}</p>
      <div class="manifesto-marca">${escapeHtml(settings.manifesto.marca_linha1)}<br/>${escapeHtml(settings.manifesto.marca_linha2)}</div>
      <div class="manifesto-bg"><img src="${escapeHtml(settings.marca.logo_escuro)}" alt="" style="width:100%; height:auto;" /></div>
    </section>

    <section class="indice" id="indice">
      <div class="indice-top">
        <h2 class="indice-titulo">
          ${linesToBr(settings.indice.titulo_linha1, settings.indice.titulo_linha2, settings.indice.titulo_linha3)}
        </h2>
        <p class="indice-intro">${escapeHtml(settings.indice.intro)}</p>
      </div>
      <nav class="indice-list">
${indiceItens}
      </nav>
    </section>
${categoriasHtml.join('\n')}

    <section class="contato" id="contato">
      <div>
        <div class="contato-tag">${escapeHtml(settings.contato.tag)}</div>
        <h2 class="contato-titulo">${linesToBr(settings.contato.titulo_linha1, settings.contato.titulo_linha2)}</h2>
      </div>
      <div>
        <div class="contato-grid">
          <div class="contato-bloco">
            <span class="contato-label">E-mail</span>
            <a class="contato-valor" href="mailto:${escapeHtml(settings.contato.email)}">${escapeHtml(settings.contato.email)}</a>
          </div>
          <div class="contato-bloco">
            <span class="contato-label">Instagram</span>
            <a class="contato-valor" href="${escapeHtml(settings.contato.instagram_link)}">${escapeHtml(settings.contato.instagram_label)}</a>
          </div>
          <div class="contato-bloco">
            <span class="contato-label">Telefone</span>
            <a class="contato-valor" href="${escapeHtml(settings.contato.telefone_link)}">${escapeHtml(settings.contato.telefone_label)}</a>
          </div>
        </div>
        <div class="contato-foot">
          <span>${escapeHtml(settings.contato.rodape_linha1)}</span>
          <span>${escapeHtml(settings.contato.rodape_linha2)}</span>
        </div>
        <div class="contato-marca-final">
          <img src="${escapeHtml(settings.contato.logo_final)}" alt="Studio ADI Arquitetura" />
        </div>
      </div>
    </section>
  </main>

  <script>
    // Detecta se a seção visível tem fundo escuro e troca o tema do menu lateral.
    // A lista de seções escuras é gerada automaticamente pelo build.js a
    // partir das cores de fundo de cada categoria/paleta.
    const darkSelectors = ${JSON.stringify(darkSelectors)};
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.4) {
          const isDark = darkSelectors.some((sel) => e.target.matches(sel));
          document.body.classList.toggle('dark-aside', isDark);
        }
      });
    }, { threshold: [0.4, 0.6] });
    document.querySelectorAll('section, article').forEach((el) => io.observe(el));
  </script>
</body>
</html>
`;

  // ---------------------------------------------------------------
  // Grava dist/
  // ---------------------------------------------------------------
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf-8');

  fs.mkdirSync(path.join(DIST_DIR, 'css'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'style.css'), path.join(DIST_DIR, 'css', 'style.css'));

  copyDir(path.join(ROOT, 'img'), path.join(DIST_DIR, 'img'));

  // painel de edição (Decap CMS) — arquivos estáticos, não gerados
  fs.mkdirSync(path.join(DIST_DIR, 'admin'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'admin', 'index.html'), path.join(DIST_DIR, 'admin', 'index.html'));
  fs.copyFileSync(path.join(ROOT, 'admin', 'config.yml'), path.join(DIST_DIR, 'admin', 'config.yml'));

  console.log('Build ok:', projetos.length, 'projetos,', (settings.categorias || []).length, 'categorias.');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

build();
