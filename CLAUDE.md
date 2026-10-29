# Laboratório Bola de Ouro — contexto do projeto

Objetivo: recriar os algoritmos do vídeo "I know who wins the Ballon d'Or 2026" (Pogorabona), criar um algoritmo próprio, comparar tudo ano a ano num site, e passar a prever a PRÓXIMA Bola de Ouro com dados atualizados automaticamente.
Língua com o utilizador: português de Portugal.

## Estado atual
- data.js: candidatos 2010–2026 (5–11 por ano). Campos em comentário no topo. Confiança A/B/C por linha. `cont` (médios/defesas/GR) é estimativa subjetiva.
- models.js: Histórico (19 critérios, pesos de fit-result.json), Justo (só individual), Meu (individual + crédito de equipa proporcional). Corre em Node e no browser.
- lp3.py (+ dump.js → feats.json): ajuste por programa linear com hinge. Resultado: 13/15 vencedores 2010–2025 em amostra, 9/15 leave-one-year-out. Falha Messi 2010 e Messi 2023. 2026 previsto Yamal (real: Kane).
- build.js: junta site.src.html + data + models + pesos em index.html (página única, publicada como Artifact).
- Vídeo mostra para 2026 (modelo dele): Kane, Olise, Dembélé, Mbappé, Yamal, Rodri, Haaland, Kvaratskhelia, Díaz, Vitinha. Ajustar a esta ordem com os meus critérios fazia perder vencedores reais.

## Lacunas conhecidas
- Faltam taças nacionais, contagem de troféus, prémios individuais (Chuteira de Ouro, melhor marcador UCL, Bola de Ouro do Mundial), que o vídeo parece usar. Provavelmente é o que impede o 15/15.
- Quase tudo de 2010–2025 vem de memória (confiança B). 2026 fora do top 3 é estimado (C).
- Força das ligas constante no tempo.

## Próximos passos pedidos pelo utilizador
1. Estender os dados o mais atrás possível (mínimo 1992; idealmente desde 1956), marcando confiança.
2. Acrescentar critérios de troféus/prémios individuais e tentar 15/15 sem sobreajustar (reportar sempre dentro da amostra vs leave-one-out).
3. Previsão para a próxima Bola de Ouro (época 2026/27) com atualização automática: pipeline de dados (API com chave em segredo, p.ex. API-Football/football-data.org; fbref bloqueia scraping), agendamento (GitHub Actions cron), publicação do site.
