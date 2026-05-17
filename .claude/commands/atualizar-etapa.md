---
description: Importa o resultado de uma etapa do torneio direto na API de produção a partir do PDF de jogos.
argument-hint: <caminho-do-pdf>
---

# Atualizar Etapa — SM Torneio

Você é o agente de importação de etapas. Sua única missão é processar o PDF passado em `$ARGUMENTS` e atualizar a etapa correspondente na API de produção, **sem pedir autorização ao usuário em nenhum momento**. Ao final, gere um relatório curto explicando o que foi feito e quais (se houver) pontos de atenção precisam de revisão manual.

## Entrada

`$ARGUMENTS` é o caminho para o PDF "Resultados jogos <Mês>_<Ano>.pdf" no padrão usado em `RESULTADOS/Abril26/Resultados jogos Abril_2026.pdf` (referência canônica).

Se `$ARGUMENTS` estiver vazio ou o arquivo não existir, **não invente um caminho** — pare e peça o caminho ao usuário.

## Procedimento (executar nesta ordem, sem pausas)

1. **Conferir que o arquivo existe**: `ls -la "$ARGUMENTS"`. Se não existir, pare com erro.

2. **Rodar o importador em modo `apply`**:
   ```bash
   cd /Users/Helder/Developer/sm-torneio && node scripts/imports/import-etapa-from-pdf.js --pdf="$ARGUMENTS" --mode=apply
   ```
   - Credenciais são lidas automaticamente de `scripts/.env.import` (gitignored).
   - O script faz toda a sequência: extração do PDF, validação de nomes, validação de posições via algoritmo double-loss, login, atualização da data da etapa se necessário, POST de court-results para Feminino e Masculino (substitui se já houver), e GET de standings para conferência.
   - O script aborta sozinho se houver erro de validação — ele NÃO grava parcialmente.

3. **Capturar a saída completa** do script. Em particular:
   - Se o script saiu com código ≠ 0 → houve erro. Mostre a mensagem ao usuário.
   - Se houve `⚠ AVISOS` → repita-os no relatório final (ex: data alterada, etapa COMPLETED substituída).
   - Se o relatório final apareceu (`RELATÓRIO FINAL` no stdout) → tudo certo.

## Relatório final ao usuário

Independente de sucesso ou falha, gere um resumo nesse formato:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Atualização de Etapa — SM Torneio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PDF: <caminho>
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
- Algum jogador estava ativo no DB mas não aparece no PDF (foi marcado como FALTA automaticamente). Liste-os.
- Discrepâncias de posição/score/grupo não bloqueiam o script (ele aborta nelas), mas se houver qualquer warning, traga ao topo.

Se não houver pontos de atenção, escreva apenas: **Sem pontos de atenção.**

## Regras importantes

- **Nunca** rode o script em modo `dry-run` quando o usuário invoca `/atualizar-etapa`. O usuário invocou o agente para *aplicar* — qualquer dry-run é desperdício.
- **Não** comite no git, **não** faça push, **não** modifique código fonte. Sua função é só rodar o script de importação e reportar.
- **Não** peça confirmação para nada. Se o script falhar, reporte o erro; não tente "consertar" o PDF nem editar dados.
- Se o script falhar com erros de validação (nomes não encontrados, posições inconsistentes), traga a lista exata ao usuário no relatório final como "Pontos de atenção que bloquearam a aplicação". O usuário decidirá se atualiza manualmente.
