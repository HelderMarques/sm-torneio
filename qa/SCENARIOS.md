# SM Torneio — Cenários de Teste QA

> Usado pelo QA Agent antes de cada release.
> Execute `/qa` no Claude Code para rodar automaticamente.

---

## Legenda
- ✅ PASS  — funcionando corretamente
- ❌ FAIL  — quebrado
- ⚠️ WARN  — funcionando mas com comportamento inesperado
- ⏭️ SKIP  — não testado nesta rodada

---

## 1. AUTENTICAÇÃO

| # | Cenário | Tipo |
|---|---------|------|
| 1.1 | Login com email/senha corretos → redireciona para `/admin/tournaments` | UI |
| 1.2 | Login com senha errada → exibe mensagem de erro | UI |
| 1.3 | Acesso a rota protegida sem token → redireciona para `/admin/login` | UI |
| 1.4 | Token expirado → redireciona para login | UI |
| 1.5 | `GET /api/auth/me` com token válido → retorna dados do usuário | API |
| 1.6 | `GET /api/auth/me` sem token → 401 | API |
| 1.7 | Fluxo de convite: gerar convite → link de email → definir senha → login | UI |
| 1.8 | Token de convite expirado (72h) → exibe erro ao acessar link | UI |

---

## 2. SITE PÚBLICO

### 2.1 Landing / Seletor de Torneios
| # | Cenário | Tipo |
|---|---------|------|
| 2.1.1 | Página lista todos os torneios | UI |
| 2.1.2 | Redireciona automaticamente para o torneio do ano atual | UI |
| 2.1.3 | Clique em torneio navega para `/t/:slug` | UI |

### 2.2 Home do Torneio
| # | Cenário | Tipo |
|---|---------|------|
| 2.2.1 | Exibe contagem regressiva para próxima etapa | UI |
| 2.2.2 | Exibe pódio da última etapa concluída | UI |
| 2.2.3 | Toggle Feminino/Masculino atualiza standings | UI |
| 2.2.4 | Tabela de classificação exibe posição, pontos válidos, descarte, bônus, penalidade | UI |
| 2.2.5 | Clicar em participante navega para perfil | UI |
| 2.2.6 | "Simular Etapa" aparece apenas se simulateEnabled = true | UI |

### 2.3 Classificação
| # | Cenário | Tipo |
|---|---------|------|
| 2.3.1 | `/t/:slug/classificacao/F` exibe grupo Feminino | UI |
| 2.3.2 | `/t/:slug/classificacao/M` exibe grupo Masculino | UI |
| 2.3.3 | Colunas: posição, nome, Pts, Ganhos, Desc, Bônus, Pen, 1º…7º, SV, SP, SS, GV, GP, SG | UI |
| 2.3.4 | Participante com descarte > 0 exibe valor correto | UI |
| 2.3.5 | Participante com bônus (100% presença) exibe +20 | UI |

### 2.4 Calendário Público
| # | Cenário | Tipo |
|---|---------|------|
| 2.4.1 | Lista etapas com status (Agendada/Realizada/Cancelada) | UI |
| 2.4.2 | Etapa COMPLETED tem link para ver resultado | UI |
| 2.4.3 | Etapa SCHEDULED não tem link de resultado | UI |

### 2.5 Resultado de Etapa (Público)
| # | Cenário | Tipo |
|---|---------|------|
| 2.5.1 | Exibe pódio (1º, 2º, 3º) | UI |
| 2.5.2 | Exibe resultados por quadra: duplas, placar de sets e games | UI |
| 2.5.3 | Exibe sorteados com pontos corretos (80 ou 60) | UI |
| 2.5.4 | Exibe ausentes (0 pts — falta) | UI |

### 2.6 Perfil do Participante
| # | Cenário | Tipo |
|---|---------|------|
| 2.6.1 | Exibe posição atual e pontos válidos | UI |
| 2.6.2 | Gráfico de evolução de posição por etapa | UI |
| 2.6.3 | Histórico de partidas (games contra quem, placar) | UI |
| 2.6.4 | Possíveis parceiros para próxima etapa | UI |

### 2.7 Simular Etapa
| # | Cenário | Tipo |
|---|---------|------|
| 2.7.1 | Cada participante tem seletor de status (Jogou/Sorteada/etc.) | UI |
| 2.7.2 | Status "Jogou" exige posição selecionada (1º–7º) | UI |
| 2.7.3 | Máximo 2 participantes por posição | UI |
| 2.7.4 | Calcular simulação exibe tabela com variação ↑↓ | UI |
| 2.7.5 | Simulação NÃO altera standings reais | UI |

### 2.8 Regulamento
| # | Cenário | Tipo |
|---|---------|------|
| 2.8.1 | Exibe pontos por colocação (100/80/70/60/50/40/30) | UI |
| 2.8.2 | Exibe regras de ausência (Sorteada=80, Voluntária=60, Falta=0) | UI |
| 2.8.3 | Exibe regra de descarte (a partir da 5ª etapa) | UI |
| 2.8.4 | Exibe regra de bônus de presença (+20) | UI |
| 2.8.5 | Exibe critérios de desempate | UI |

---

## 3. ADMIN — PARTICIPANTES

| # | Cenário | Tipo |
|---|---------|------|
| 3.1 | Lista participantes filtrado pelo toggle Fem/Masc | UI |
| 3.2 | Adicionar participante simples → aparece na lista | UI |
| 3.3 | Adicionar participantes em bulk (nomes separados por vírgula/linha) | UI |
| 3.4 | Editar nome do participante → reflete na lista | UI |
| 3.5 | Desativar participante → não aparece nas etapas seguintes | UI |
| 3.6 | Reativar participante | UI |
| 3.7 | Deletar participante → remove da lista e dos resultados associados | UI |

---

## 4. ADMIN — REGISTRO DE RESULTADOS DE ETAPA

| # | Cenário | Tipo |
|---|---------|------|
| 4.1 | Etapa SCHEDULED mostra botão "Registrar" | UI |
| 4.2 | Etapa COMPLETED mostra botão "Reeditar" | UI |
| 4.3 | Página de registro carrega: dados da etapa + participantes ativos | UI |
| 4.4 | Adicionar quadra: inserir nome da quadra | UI |
| 4.5 | Adicionar duplas na quadra com autocomplete de participantes | UI |
| 4.6 | Autocomplete ignora participantes já em uso | UI |
| 4.7 | Score input aceita 0 a `games_to_win_set` (padrão 5) | UI |
| 4.8 | Score empate não é aceito (placar igual é ignorado no algoritmo) | UI |
| 4.9 | Algoritmo double-loss calcula posições corretamente | UI |
| 4.10 | Adicionar sorteado com tipo "Sorteio" (80 pts) ou "A pedido" (60 pts) | UI |
| 4.11 | Preview etapa (passo 1): exibe posição e pontos de cada dupla por quadra | UI |
| 4.12 | Preview classificação (passo 2): exibe standings simulados com variação ↑↓ | UI |
| 4.13 | Salvar resultados → etapa muda para COMPLETED | UI |
| 4.14 | Salvar resultados → standings são recalculados corretamente | UI |
| 4.15 | Descarte é aplicado a partir da 5ª etapa concluída | UI |
| 4.16 | Bônus de presença (+20) aplicado na última etapa para participante 100% presente | UI |
| 4.17 | Excluir resultados da etapa → volta para SCHEDULED | UI |
| 4.18 | Gerar dados de teste (testResultEnabled) preenche quadras automaticamente | UI |

---

## 5. ADMIN — CLASSIFICAÇÃO

| # | Cenário | Tipo |
|---|---------|------|
| 5.1 | Lista standings com todas as colunas corretas | UI |
| 5.2 | Editar standing manualmente → salva e reflete no site público | UI |
| 5.3 | Recalcular standings → valores batem com histórico de resultados | UI |

---

## 6. ADMIN — CALENDÁRIO

| # | Cenário | Tipo |
|---|---------|------|
| 6.1 | Criar nova etapa com data e número | UI |
| 6.2 | Cancelar etapa → status muda para CANCELLED | UI |

---

## 7. ADMIN — REGRAS DO TORNEIO (/regras)

| # | Cenário | Tipo |
|---|---------|------|
| 7.1 | Página carrega com todas as 7 categorias de configurações | UI |
| 7.2 | Categoria "Pontuação": exibe e permite editar pontos por colocação (1º–7º) | UI |
| 7.3 | Categoria "Bonificações": editar bônus de presença, pontos de sorteio, penalidade | UI |
| 7.4 | Categoria "Descarte": editar a partir de qual rodada o descarte é ativado | UI |
| 7.5 | Categoria "Formato das Partidas": editar games_to_win_set, scoring_mode | UI |
| 7.6 | Categoria "Inscrições": M e F exibidos lado a lado | UI |
| 7.7 | Categoria "Quadras": exibe limites de quadras por grupo | UI |
| 7.8 | Categoria "Financeiro": exibe taxa por rodada e valores anuais | UI |
| 7.9 | "Salvar seção" salva apenas aquela categoria | UI |
| 7.10 | "Salvar tudo" salva todas as configurações de uma vez | UI |
| 7.11 | Alterar pontos e salvar → standings recalculados refletem novos valores | UI |
| 7.12 | Alterar `games_to_win_set` → input de score na etapa usa novo máximo | UI |

---

## 8. ADMIN — CONFIGURAÇÕES DO TORNEIO (/configuracoes)

| # | Cenário | Tipo |
|---|---------|------|
| 8.1 | Toggle simulateEnabled liga/desliga | UI |
| 8.2 | simulateEnabled=true → botão "Simular Etapa" aparece no site público | UI |
| 8.3 | Toggle testResultEnabled liga/desliga | UI |
| 8.4 | testResultEnabled=true → botão "Gerar dados de teste" aparece no registro de etapa | UI |

---

## 9. ADMIN — GERENCIAMENTO DE USUÁRIOS

| # | Cenário | Tipo |
|---|---------|------|
| 9.1 | Lista usuários com role (Master/Admin) e status | UI |
| 9.2 | Convidar usuário → email enviado com link | UI |
| 9.3 | Reenviar convite para usuário PENDING | UI |
| 9.4 | Desativar/reativar usuário | UI |
| 9.5 | Deletar usuário (não-master) | UI |
| 9.6 | Usuário ADMIN não pode acessar `/admin/usuarios` (master only) | UI |

---

## 10. API — SMOKE TESTS (automatizados)

| # | Endpoint | Esperado |
|---|----------|----------|
| 10.1 | `GET /api/health` | 200 `{status: "ok"}` |
| 10.2 | `GET /api/tournaments` | 200 array |
| 10.3 | `GET /api/tournaments/:slug` | 200 objeto |
| 10.4 | `GET /api/settings` | 200 objeto agrupado por categoria |
| 10.5 | `GET /api/settings/flat` | 200 array com 42+ settings |
| 10.6 | `POST /api/auth/login` (credenciais corretas) | 200 com token |
| 10.7 | `POST /api/auth/login` (senha errada) | 401 |
| 10.8 | `GET /api/auth/me` (sem token) | 401 |
| 10.9 | `GET /api/tournaments/:slug/participants` | 200 array |
| 10.10 | `GET /api/tournaments/:slug/rounds` | 200 array |
| 10.11 | `GET /api/tournaments/:slug/standings/F` | 200 array |
| 10.12 | `GET /api/tournaments/:slug/standings/M` | 200 array |
| 10.13 | `PUT /api/settings/bulk` sem auth | 401 |
| 10.14 | `PUT /api/settings/bulk` com auth → 200 | API |

---

## 11. LÓGICA DE NEGÓCIO — CÁLCULO DE PONTOS

| # | Cenário | Verificação |
|---|---------|-------------|
| 11.1 | 1º lugar → 100 pts | standingsService |
| 11.2 | Sorteado por sorteio → 80 pts | standingsService |
| 11.3 | Sorteado voluntariamente → 60 pts | standingsService |
| 11.4 | Faltou → 0 pts | standingsService |
| 11.5 | Penalidade de uniforme → -20 pts | standingsService |
| 11.6 | Descarte começa na 5ª etapa, remove menor score positivo | standingsService |
| 11.7 | Bônus +20 se presente em TODAS as etapas ao final | standingsService |
| 11.8 | Pontos válidos = raw − descarte + bônus − penalidade | standingsService |

---

## 12. REGRESSÃO — ÚLTIMAS FUNCIONALIDADES ENTREGUES

| # | Funcionalidade | Testado em |
|---|----------------|------------|
| 12.1 | Preview em 2 passos antes de salvar resultado | 4.11, 4.12, 4.13 |
| 12.2 | Algoritmo double-loss no input de quadra | 4.9 |
| 12.3 | Exclusão de resultado de etapa | 4.17 |
| 12.4 | Busca de jogadores com acentos/case insensitivo | 4.6 |
| 12.5 | Gerar dados de teste (testResultEnabled) | 4.18 |
| 12.6 | Regras configuráveis via admin | 7.1–7.12 |
| 12.7 | Standingservice usa valores do banco (não hardcoded) | 11.1–11.8 |

---

## Notas de Execução

- **URL base local:** `http://localhost:3001`
- **Credenciais padrão:** `admin@smtorneio.com` / `admin123`
- **Torneio de teste:** slug `demo` (dados de amostra)
- **Executar smoke tests API:** `node qa/api-smoke-test.js`
