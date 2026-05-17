# Importação da Etapa de Abril/2026 via API

**Data:** 2026-05-09
**Etapa alvo:** 2ª Etapa, Abril/2026, realizada em **12/04/2026**
**Origem dos dados:** `RESULTADOS/Abril26/Resultados jogos Abril_2026.pdf`
**Validação:** `RESULTADOS/Abril26/Classificação Geral Feminino Abril_2026.pdf` e `Classificação Geral Masculino Abril_2026.pdf`
**Ambiente:** produção (`https://www.sm-ttc.com.br`)

## Objetivo

Carregar os resultados da 2ª etapa do torneio 2026 diretamente via API REST, sem usar o fluxo manual da UI de cadastro um-a-um.

## Decisões aprovadas

1. **Fidelidade:** total. Usar `POST /rounds/:id/court-results` com jogos individuais (placar de cada partida) — o backend calcula posições, sets e games via algoritmo `computeDoubleLossPositions`.
2. **Acesso:** login direto com `admin@smtorneio.com` / `admin123` (token JWT, válido 24h).
3. **Slug do torneio:** `2026`.
4. **Data:** atualizar a etapa de `2026-04-19` para `2026-04-12` (a etapa foi antecipada).
5. **Acentos — Kátia:** chamar a API com `"Katia"` (sem acento), pois é como está no banco.
6. **Willy e Ximenes:** marcar como FALTA. Estão `active=true` no DB mas não compareceram em Abril. O backend marca automaticamente todos ativos não-em-quadra-nem-sorteio como FALTA — comportamento desejado.

## Escopo

Quadras e duplas extraídas do PDF de jogos:

### Feminino — Quadra 4 (5 duplas, double-loss)

| Dupla | Jogadoras            | Resultado    | Pts |
|-------|----------------------|--------------|-----|
| 6A    | Núbia, Ana           | 5º LUGAR     | 50  |
| 6B    | Letícia, Rose        | 3º LUGAR     | 70  |
| 6C    | Natalia, Mariana     | CAMPEÃ       | 100 |
| 6D    | Giovana, Jeovana     | VICE-CAMPEÃ  | 80  |
| 6E    | Andrea, Sandra       | 4º LUGAR     | 60  |

**Sorteio:** Katia (tipo SORTEIO, 80 pts).
**Faltas (auto):** Adriane, Cristina, Valéria.

### Masculino — Quadra 5 (6 duplas)

| Dupla | Jogadores              | Resultado     | Pts |
|-------|------------------------|---------------|-----|
| 7A    | Vitor, Gustavo         | CAMPEÃO       | 100 |
| 7B    | Flavio, Foguete        | 4º LUGAR      | 60  |
| 7C    | Vita, Cláudio          | 5º LUGAR      | 50  |
| 7D    | Colonese, Vanzillota   | 6º LUGAR      | 40  |
| 7E    | Lincoln, Edu Caetano   | 3º LUGAR      | 70  |
| 7F    | Aranha, Fitipaldi      | VICE-CAMPEÃO  | 80  |

### Masculino — Estádio (6 duplas)

| Dupla | Jogadores                   | Resultado     | Pts |
|-------|-----------------------------|---------------|-----|
| 8A    | Neco, Michel                | 4º LUGAR      | 60  |
| 8B    | Luiz Henrique, Júlio Cesar  | 5º LUGAR      | 50  |
| 8C    | Edu Carneiro, Bottino       | 6º LUGAR      | 40  |
| 8D    | Reco, José Felipe           | VICE-CAMPEÃO  | 80  |
| 8E    | João Reis, Fernando         | CAMPEÃO       | 100 |
| 8F    | Romulo, Tuninho             | 3º LUGAR      | 70  |

**Faltas Masculino (auto):** Cascardo, Helder, João Barreto, Taylor, Willy, Ximenes.

## Arquitetura

### Componente único: script Node.js `scripts/imports/import-abril-2026.js`

- Stand-alone (apenas `node`, dependência `node-fetch` ou nativo `fetch` do Node 18+).
- Configuração via env vars: `API_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MODE`.
- Modos:
  - `MODE=dry-run` (default): valida nomes contra `/participants`, roda algoritmo de posições localmente, imprime resumo. **Não escreve nada.**
  - `MODE=apply`: executa login + PUT date + 2× POST court-results + GET de verificação.

### Estrutura interna

```
const ETAPA = {
  date: "2026-04-12",
  feminino: {
    courts: [
      { label: "Quadra 4", pairs: [{playerA, playerB}, ...], games: [{pairAIndex, pairBIndex, scoreA, scoreB}, ...] }
    ],
    sorteados: [{ name: "Katia", type: "sorteio" }]
  },
  masculino: {
    courts: [
      { label: "Quadra 5", pairs: [...], games: [...] },
      { label: "Estádio", pairs: [...], games: [...] }
    ],
    sorteados: []
  }
}
```

### Fluxo de execução (modo `apply`)

1. `POST /api/auth/login` → token JWT.
2. `GET /api/tournaments/2026/rounds` → IDs das etapas Feminino e Masculino nº 2.
3. `PUT /api/tournaments/2026/rounds/{idF}` body `{ date: "2026-04-12" }`.
4. `PUT /api/tournaments/2026/rounds/{idM}` body `{ date: "2026-04-12" }`.
5. `POST /api/tournaments/2026/rounds/{idF}/court-results` body `{ courts, sorteados }` (Feminino).
6. `POST /api/tournaments/2026/rounds/{idM}/court-results` body `{ courts, sorteados }` (Masculino).
7. `GET /api/tournaments/2026/rounds/{idF}/results` + `GET .../{idM}/results` — confere persistência.
8. `GET /api/tournaments/2026/standings?group=F` + `?group=M` — confere classificação.

### Validações pré-apply (no dry-run)

- Cada nome em `pairs` e `sorteados` resolve para um participante ativo do grupo correto.
- Para cada quadra: número de jogos suficiente para que double-loss elimine `n-1` duplas.
- Posições calculadas pelo algoritmo local batem com as do PDF (CAMPEÃO=1, VICE=2, …, último lugar = `n` ou `n+1`).
- Sets/games agregados por dupla (somatório dos jogos) batem com os agregados visíveis no PDF de Classificação Geral (após considerar Março).

## Reconstrução dos jogos a partir do PDF

O PDF mostra cada coluna de "Nº Jogo" com os placares marcados nas linhas das duas duplas que disputaram. Cada coluna tem exatamente 2 placares preenchidos (uma vitória `V` e uma derrota `D`).

**Algoritmo de extração:**
1. Para cada coluna `c`: identificar as duas duplas com placar; o vencedor e o perdedor.
2. Validar: `scoreA` da vencedora + `scoreB` da perdedora — devem ser inversos (ex: `5x3` na vencedora ↔ `3x5` na perdedora).
3. Construir `games[]` em ordem cronológica.
4. Rodar `computeDoubleLossPositions(n, games)` localmente e validar contra posições anunciadas no PDF.

Os dados específicos dos jogos serão extraídos manualmente do PDF visual (não via OCR) e codificados no script. O dry-run mostra a tabela final ao usuário antes do apply.

## Riscos e mitigações

| Risco                                              | Mitigação                                                                  |
|----------------------------------------------------|----------------------------------------------------------------------------|
| Erro na leitura de placares do PDF                 | Dry-run mostra todos os jogos extraídos; usuário valida antes do apply.   |
| Posição calculada não bate com a do PDF             | Dry-run aborta com erro claro indicando a quadra problemática.            |
| Etapa já tem resultados (re-execução)              | `court-results` já faz `deleteMany` antes de inserir → idempotente.        |
| Token JWT expira                                   | Apply roda em < 1 min, dentro da janela de 24h. Sem mitigação adicional.   |
| Nome divergente (acento, espaço extra, etc)        | Resolver replica `.toLowerCase().trim()` do backend; se falhar, dry-run aponta. |
| Falha de rede no meio                              | Cada chamada é tratada; em caso de erro, o usuário decide retry/rollback.  |

## Verificação pós-apply

Comparar standings retornados com os PDFs `Classificação Geral`:
- **Feminino:** Natalia 200 pts (1º), Giovana 160 (2º), Núbia 150 (3º), Mariana 140, Letícia 140, Andrea 140, Katia 130, Sandra 120, Jeovana 110, Rose 110, Ana 100, Adriane 70, Cristina 60, Valéria 30.
- **Masculino:** mesma comparação com `Classificação Geral Masculino Abril_2026.pdf` (a ler na fase de verificação).

Saldo de sets e saldo de games devem bater na precisão exata.
