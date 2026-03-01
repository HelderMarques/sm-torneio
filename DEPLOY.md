# Deploy no Railway — passo a passo

Este projeto está preparado para deploy no [Railway](https://railway.app) com **um único serviço**: o backend Node serve a API e o frontend (build do Vite).

## 1. Repositório no GitHub

- Coloca o projeto num repositório GitHub (se ainda não estiver).
- Não faças commit da pasta `node_modules/` nem do ficheiro `.env` (já devem estar no `.gitignore`).

## 2. Conta no Railway

1. Acede a [railway.app](https://railway.app) e faz login com **GitHub**.
2. Clica em **New Project**.

## 3. Deploy a partir do repositório

1. Escolhe **Deploy from GitHub repo**.
2. Autoriza o Railway e seleciona o repositório **sm-torneio** (ou o nome que tiveres).
3. O Railway cria um serviço. Clica nele para abrir as definições.

## 4. Configuração do serviço

Em **Settings** do serviço:

- **Root Directory**: deixa **vazio** (usa a raiz do repositório).
- **Build Command**: `npm run build`  
  (instala e faz build do frontend, instala o backend e gera o Prisma client.)
- **Start Command**: `npm start`  
  (aplica migrações e inicia o servidor Node.)
- **Watch Paths**: opcional; podes deixar em branco.

## 5. Variáveis de ambiente

Em **Variables** (ou **Settings** → **Variables**), adiciona:

| Nome            | Valor (exemplo)                    | Obrigatório |
|-----------------|------------------------------------|-------------|
| `NODE_ENV`      | `production`                       | Sim         |
| `DATABASE_URL`  | `file:/data/prisma.sqlite`         | Sim (ver 6) |
| `JWT_SECRET`    | uma string longa e aleatória       | Sim         |

- **JWT_SECRET**: gera uma string segura (ex.: `openssl rand -base64 32` no terminal) e cola aqui. Não partilhes este valor.

## 6. Volume para o SQLite (dados persistentes)

Para os dados não se perderem em cada deploy:

1. Em **Settings** do serviço, vai a **Volumes**.
2. Clica em **Add Volume**.
3. **Mount Path**: `/data`.
4. Garante que `DATABASE_URL` está como `file:/data/prisma.sqlite` (o Prisma criará o ficheiro na primeira migração).

## 7. Domínio público

1. Em **Settings** do serviço, abre **Networking** (ou **Generate Domain**).
2. Clica em **Generate Domain**.
3. O Railway atribui um URL tipo `https://sm-torneio-production-xxxx.up.railway.app`. Este é o URL público do site.

## 8. Dados iniciais (opcional)

Na primeira vez, a base de dados fica vazia após as migrações. Para ter torneios, etapas e participantes:

- **Opção A**: Usa a aplicação (regista um admin em `/admin/login` e cria torneios/participantes/etapas pela interface).
- **Opção B**: Corres os seeds a partir da tua máquina, apontando para a base do Railway (mais avançado; normalmente usa-se a opção A).

Para correr o seed **localmente** com a mesma base (ex.: para testes), mantém o teu `.env` local; em produção o Railway usa as variáveis que definiste no passo 5.

## 9. Verificar

1. Abre o URL gerado no passo 7 no browser.
2. Deves ver a página de escolha de torneio (Secos & Molhados).
3. A API está no mesmo domínio (ex.: `https://teu-dominio.up.railway.app/api/health`). O frontend usa `/api`, por isso funciona sem alterações.

## Resumo dos comandos (raiz do repo)

- **Build** (no Railway): `npm run build` → instala frontend, build do Vite, instala backend, `prisma generate`.
- **Start** (no Railway): `npm start` → `prisma migrate deploy` + `node backend/src/index.js`.
- Em produção, o Express serve a pasta `frontend/dist` e responde com `index.html` para todas as rotas do frontend (SPA).

Se algo falhar, consulta os **logs** do serviço no dashboard do Railway (aba **Deployments** ou **Logs**).
