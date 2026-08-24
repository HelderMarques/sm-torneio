---
description: Importa o resultado de uma etapa do torneio direto na API de produção, lendo do site público do rollin (Firestore).
argument-hint: [YYYY-MM ou caminho para PDF (fallback)]
---

# Atualizar Etapa — SM Torneio

Você é o agente de importação de etapas. Sua única missão é buscar os resultados da etapa mais recente (ou do mês passado em `$ARGUMENTS`, se informado) no site público [`tenis.rollin.com.br`](https://tenis.rollin.com.br) e aplicá-los na API de produção do SM Torneio, **sem pedir autorização ao usuário em nenhum momento**. Ao final, gere um relatório curto explicando o que foi feito e quais (se houver) pontos de atenção precisam de revisão manual.

## Entrada

`$ARGUMENTS` é opcional. Formatos aceitos:
- **Vazio** → importa a etapa mais recente encontrada em `apuracoes` (Firestore do rollin).
- **`YYYY-MM`** (ex: `2026-08`) → importa a etapa daquele mês.
- **Caminho para um PDF** `Resultados jogos <Mês>_<Ano>.pdf` → usa o importador antigo por PDF (compatibilidade com meses até 07/2026). Se o arquivo não existir, pare com erro.

## Procedimento (executar nesta ordem, sem pausas)

1. **Decidir qual importador usar**:
   - Se `$ARGUMENTS` termina em `.pdf` → usar o importador de PDF. Confirme antes com `ls -la "$ARGUMENTS"`; se não existir, pare com erro.
   - Caso contrário (vazio ou `YYYY-MM`) → usar o importador do rollin (caminho padrão daqui em diante).

2. **Rodar o importador em modo `apply`**:

   Caminho padrão (rollin), sem argumento:
   ```bash
   cd /Users/Helder/Developer/sm-torneio && node scripts/imports/import-etapa-from-rollin.js --mode=apply
   ```

   Caminho padrão (rollin), com mês `YYYY-MM`:
   ```bash
   cd /Users/Helder/Developer/sm-torneio && node scripts/imports/import-etapa-from-rollin.js --month="$ARGUMENTS" --mode=apply
   ```

   Compatibilidade (PDF):
   ```bash
   cd /Users/Helder/Developer/sm-torneio && node scripts/imports/import-etapa-from-pdf.js --pdf="$ARGUMENTS" --mode=apply
   ```

   - Credenciais lidas automaticamente de `scripts/.env.import` (gitignored).
   - O importador do rollin lê `apuracoes`, `drawHistory` e `pontosSorteio` no Firestore público do projeto `secosmolhados-25ee0`, resolve nomes contra a API do SM Torneio, calcula posições finais com o mesmo algoritmo double-loss do backend e envia court-results F e M para `/tournaments/{slug}/rounds/{id}/court-results`. Aborta sozinho em erros de validação — NÃO grava parcialmente.
   - Convenção de quadras aplicada pelo script: **Feminino** chave única → `Estádio`; **Masculino** chave 1 → `Quadra 4`, chave 2 → `Quadra 5`.

3. **Capturar a saída completa** do script:
   - Se saiu com código ≠ 0 → houve erro. Mostre a mensagem exata ao usuário.
   - Se houve `⚠ AVISOS` → repita-os no relatório final (data alterada, etapa COMPLETED substituída, etc.).
   - Se o `RELATÓRIO FINAL` apareceu no stdout → tudo certo.

## Relatório final ao usuário

Independente de sucesso ou falha, gere um resumo nesse formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Atualização de Etapa — SM Torneio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fonte: rollin  /  PDF
Status: ✅ APLICADO  /  ❌ FALHOU

Data da etapa: YYYY-MM-DD
Quadras F: N  | Quadras M: N
Sorteios: N
Faltas detectadas: F=[lista], M=[lista]

Top 3 Feminino: …
Top 3 Masculino: …
```

Logo abaixo, em "Pontos de atenção", liste qualquer um destes que tenha aparecido:
- Data da etapa foi alterada (de X para Y)
- Etapa já estava COMPLETED — resultados anteriores foram substituídos
- Algum jogador estava ativo no DB mas não aparece na fonte (foi marcado como FALTA automaticamente). Liste-os.
- Nomes não encontrados, duplas ausentes em `drawHistory`, etc. (o script aborta nesses casos).

Se não houver pontos de atenção, escreva apenas: **Sem pontos de atenção.**

## Regras importantes

- **Nunca** rode o script em modo `dry-run` quando o usuário invoca `/atualizar-etapa`. O usuário invocou o agente para *aplicar* — qualquer dry-run é desperdício.
- **Não** comite no git, **não** faça push, **não** modifique código fonte. Sua função é só rodar o script de importação e reportar.
- **Não** peça confirmação para nada. Se o script falhar, reporte o erro; não tente "consertar" nem editar dados.
- Se o script falhar com erros de validação (nomes não encontrados, dupla ausente em drawHistory, dupla em grupo errado etc.), traga a lista exata ao usuário no relatório final como "Pontos de atenção que bloquearam a aplicação". O usuário decidirá se atualiza manualmente.
