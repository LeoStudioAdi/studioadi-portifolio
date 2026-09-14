# Studio ADI — como publicar e editar o site

Este é o seu novo site, reconstruído a partir do que estava publicado em
`portfoliostudioadi.netlify.app`, mas agora 100% seu: você vai ter acesso
completo (conta própria) e um painel de edição para trocar fotos e textos
sem precisar de programador.

Leia tudo antes de começar — são só dois cadastros gratuitos e uns 15
minutos.

## O que tem nesta pasta

- `content/` — todos os textos do site (é isso que o painel de edição
  altera).
- `img/` — todas as fotos.
- `admin/` — o painel de edição (Decap CMS).
- `build.js` — o programinha que junta tudo isso e monta o site. Você não
  precisa entender nem mexer nisso.
- `dist/` **não está aqui** — ele é gerado automaticamente pelo Netlify
  toda vez que você salva uma alteração.

## Passo 1 — Criar uma conta no GitHub (gratuito)

O GitHub é onde o conteúdo do site fica guardado (como um "Google Drive"
para o site).

1. Acesse **github.com** e clique em **Sign up**.
2. Crie a conta com o e-mail `leo.arc@outlook.com` (ou outro de sua
   preferência).
3. Depois de logar, clique no **+** no canto superior direito → **New
   repository**.
4. Dê um nome, por exemplo `studioadi-site`. Deixe como **Public** ou
   **Private** (tanto faz). Clique em **Create repository**.
5. Na página do repositório recém-criado, clique no link **uploading an
   existing file**.
6. Arraste **todo o conteúdo desta pasta** (os arquivos e pastas
   `content`, `img`, `admin`, `build.js`, `package.json`, `netlify.toml`,
   `.gitignore` — não precisa arrastar a pasta em si, arraste o que está
   dentro dela) para a área de upload do GitHub.
7. Role para baixo e clique em **Commit changes**.

Pronto — seu site (o código-fonte dele) já está no GitHub, sob seu
controle.

## Passo 2 — Criar uma conta no Netlify (gratuito) e publicar

O Netlify é quem efetivamente coloca o site no ar.

1. Acesse **netlify.com** e clique em **Sign up**. O jeito mais rápido é
   entrar com **"Sign up with GitHub"**, usando a conta que você acabou
   de criar.
2. No painel do Netlify, clique em **Add new site → Import an existing
   project**.
3. Escolha **GitHub** e autorize o Netlify a acessar seus repositórios.
4. Selecione o repositório `studioadi-site` que você criou no Passo 1.
5. O Netlify já vai detectar sozinho as configurações de build (porque
   elas estão no arquivo `netlify.toml`): comando `node build.js`, pasta
   `dist`. Não precisa mudar nada — clique em **Deploy site**.
6. Espere um ou dois minutos. Quando terminar, o Netlify te dá um
   endereço tipo `nome-aleatorio-123.netlify.app` — esse já é o seu site
   no ar! (Depois, em **Site settings → Change site name**, você pode
   trocar esse endereço por algo como `studioadi.netlify.app`, e mais pra
   frente também dá pra usar um domínio próprio, tipo
   `studioadi.com.br`.)

## Passo 3 — Ativar o painel de edição (Identity + Git Gateway)

Isso é o que permite você editar o site pelo navegador, sem mexer em
código.

1. No painel do seu site no Netlify, vá em **Site configuration →
   Identity** (ou **Site settings → Identity**, dependendo da versão) e
   clique em **Enable Identity**.
2. Ainda em Identity, procure **Registration** e deixe como **Invite
   only** (assim só você consegue criar login no painel).
3. Procure a seção **Services → Git Gateway** e clique em **Enable Git
   Gateway**.
4. Volte para a aba principal de **Identity** e clique em **Invite
   users**. Convide seu próprio e-mail (`leo.arc@outlook.com`).
5. Você vai receber um e-mail do Netlify com um convite — abra-o e
   defina uma senha para acessar o painel.

## Passo 4 — Usar o painel para editar o site

1. Acesse `SEU-SITE.netlify.app/admin` (troque pelo endereço real do seu
   site).
2. Faça login com o e-mail e a senha que você definiu no passo anterior.
3. Você verá duas seções:
   - **Conteúdo geral do site** — capa, manifesto, índice, categorias,
     contato.
   - **Projetos** — adicionar, editar ou remover projetos (fotos,
     textos, categoria, dados como área/ano/tipo).
4. Depois de editar, clique em **Publish** (ou "Save" e depois
   "Publish", dependendo da tela). Isso salva a alteração e o Netlify
   reconstrói o site automaticamente — a mudança aparece no ar em
   1–2 minutos.

Dica: em qualquer campo de texto de título (marcado no painel como "use
`**assim**` para destacar"), colocar duas palavras entre `**dois
asteriscos**` deixa aquele trecho destacado, do mesmo jeito que já
aparece no site hoje (ex.: em "Onde a paisagem **manda mais**", só
"manda mais" fica destacado).

## Identidade visual oficial (manual de marca)

Depois da primeira entrega, vocês me passaram o manual de marca da
equipe de marketing. Conferi tudo e apliquei:

- **Cores ajustadas para o hex exato do manual**: verde `#41886E`,
  terracota `#BF663D`, preto `#000000`, bege/papel `#E6E0D5`, cinza-claro
  `#E4E4E4` e branco `#FFFFFF`. (Curiosidade: o site já estava usando
  cores praticamente idênticas a essas — a diferença era de 1 dígito no
  código da cor, imperceptível a olho nu. Agora está exatamente igual ao
  manual.)
- **Logo**: o ícone "ADI." que já estava no site é exatamente o mesmo do
  manual — não precisou trocar nada aí.
- **Tipografia**: a fonte Sora, usada em todo o site, também já é a
  fonte oficial do manual — sem alteração necessária.
- **Slogan da marca** ("Arquitetura que pertence à terra") — adicionei
  na capa do site, embaixo do logo grande. Dá pra editar ou mover esse
  texto a qualquer momento pelo painel (campo "Slogan" dentro de
  "Conteúdo geral do site → Capa").

Se no futuro vocês tiverem uma versão atualizada do manual de marca (ou
quiserem mudar as cores de novo), é só me mandar de novo — todas essas
cores ficam guardadas em um único lugar no código (`style.css`), então
qualquer ajuste futuro é rápido.

## O que eu descobri ao reconstruir o site (importante ler)

O site original publicado tinha alguns números e textos que não batiam
com o conteúdo real — provavelmente sobras de uma versão anterior do
site. Eu corrigi o que dava para corrigir automaticamente e sinalizei o
que precisa da sua atenção:

- **Contagens de projeto agora são automáticas.** O site antigo dizia,
  por exemplo, "07 projetos" em Habitações remotas, mas só existiam 4
  projetos reais publicados. Agora esse número é calculado sozinho a
  partir dos projetos cadastrados — nunca mais vai ficar
  desatualizado.
- **Duas categorias ainda não têm nenhum projeto publicado**: "Comercial"
  e "Outros". Elas aparecem no menu e no índice, mas ainda sem a "página
  de abertura" grande (ela só aparece automaticamente quando você
  cadastrar o primeiro projeto de cada uma). As frases de abertura que
  deixei prontas para essas duas categorias são placeholders meus — vale
  reescrevê-las pelo painel quando adicionar os projetos.
- **Dois projetos têm textos com "a confirmar" no site original**: em
  "Casa Vista" (localização e área) e "Apto Manoel" (ano). Mantive
  exatamente como estava publicado — são informações que, pelo visto, o
  studio ainda não tinha fechado. Dá pra completar isso a qualquer
  momento pelo painel.
- **Três projetos têm parágrafos de descrição marcados como
  "[Texto a definir — placeholder.]"** diretamente no site publicado
  (Casa Vista, Casa Paraty, Apto Manoel) — não é erro meu, é texto que já
  estava assim no ar. Vale revisar e trocar por texto definitivo pelo
  painel.
- **Uma logo do rodapé (`logo-02-branco.png`) estava quebrada** no site
  original (dava erro 404). Troquei por outra logo já existente no site
  (a mesma usada na capa/aside) — se você tiver o arquivo correto, é só
  subir pelo painel.
- **Todas as fotos foram comprimidas para WebP**, o formato mais leve
  para web hoje, mantendo a mesma qualidade visual — o site carrega mais
  rápido que o original.

## Dúvidas comuns

**"Publiquei mas a alteração não apareceu."**
Espere 1–2 minutos (o Netlify reconstrói o site a cada alteração) e
depois dê um refresh "forçado" na página (Ctrl+Shift+R ou Cmd+Shift+R).

**"Quero trocar o endereço do site para o meu domínio (studioadi.com.br)."**
No Netlify: **Site configuration → Domain management → Add a domain**, e
siga as instruções (você vai precisar acessar onde comprou o domínio
para apontar o DNS para o Netlify).

**"Posso adicionar uma sétima categoria (além das seis atuais)?"**
As seis categorias (com suas cores/paletas) foram desenhadas
especificamente para este site. Adicionar uma sétima exigiria um pequeno
ajuste no arquivo `style.css` — é uma mudança pontual que qualquer
desenvolvedor consegue fazer rapidamente, ou você pode pedir minha ajuda
de novo se precisar.
