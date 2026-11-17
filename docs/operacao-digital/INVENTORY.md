# Inventário — 16/11/2026

Baseline local `01176cb`; árvore inventariada estruturalmente, com revisão focal de favoritos, upload, autorização, prova, cobrança, configuração e testes. Não é revisão linha a linha dos 456 arquivos de src/.github/docs nem certificação de segurança. [Inventário histórico detalhado](../architecture/TECHNICAL-INVENTORY.md) e [fluxos auditados](FLOWS.md) complementam este documento.

## Reuso e maturidade

| Área | Evidência / maturidade local |
|---|---|
| Aplicação | 97 arquivos em src/app, 138 componentes, 123 em src/lib; Next 16.3.8 declarado, React 19, TypeScript, Tailwind/Radix |
| Banco | 43 migrations e nove suítes SQL antes da Operação Digital; 0043 testada em banco descartável, sem prova de implantação |
| Upload | R2 assinado, confirmação por HeadObject, identidade persistida e retry em memória da S1; sem fila limitada neste consumidor |
| Galeria | Grid e lightbox existentes; estrela manual era somente local; incremento atual adiciona comando persistido |
| Design/prova | Editor Konva, templates, lâminas, versões, comentários, liberação e aprovação; reuso integral, integrações reais não certificadas |
| Financeiro | Stripe Checkout/webhook e extras; não demonstra assinatura recorrente e franquias de armazenamento/tráfego |
| Portal | Área cliente autenticada e aprovação avulsa por token; portal completo por link e código ainda ausente |
| Timeline | Indicador por status existente; atividades SQL são base futura, com revisão obrigatória de notas internas |
| Integrações | Supabase, R2, AWS Rekognition, Stripe, GitHub e Vercel declarados em código; configuração não comprova serviço operacional |

## Git/GitHub

Branch inicial `fix/s1-isolamento-producao`. HEAD `01176cb`; remoto main `1d90e82` confirmado por `git ls-remote` em 16/11. Quatro commits locais S1 posteriores devem acompanhar qualquer PR, sem omitir a migration 0043. Origin é o repositório público `midiachurch/seualbum`, identificado como Seu Álbum; nenhum outro projeto dessa conta foi consultado. Autenticação GitHub confirmada fora do sandbox; a tentativa no sandbox reportou inválida por restrição de rede.

Criados `checkpoint/pre-operacao-digital-20261116` e `feat/operacao-digital`, mais três branches/worktrees independentes. Vinte arquivos locais de pesquisa não versionados foram preservados e copiados com hashes para `/private/tmp/seualbum-pre-operacao-digital-20261116`; não incluí-los no PR por conter registros de sessão. Backup temporário não substitui armazenamento durável do usuário.

## Supabase

Vínculo CLI local identificado pelo nome `seu-album`; não listado catálogo de outros projetos. `.env.local` contém nomes de chaves de Supabase/Stripe/login de desenvolvimento; somente nomes foram inspecionados, sem imprimir valores. R2 e AWS têm nomes no exemplo, ausentes do arquivo local. Ausência local não determina configuração remota.

`supabase migration list --linked` falhou antes de consultar a baseline, com 403 por privilégios insuficientes no endpoint de login da CLI. Nenhuma migration remota aplicada. Histórico efetivamente implantado continua desconhecido; 0041 tem divergência histórica de documentação.

## Vercel

`.vercel/repo.json` vincula o projeto `seualbum`. Não há CLI Vercel no PATH. GitHub registra deployment Production com sucesso em 25/10/2026, commit `1d90e82`, URL `https://seualbum-eqk569fux-midiachurch.vercel.app`. Isto é metadado histórico, não teste de disponibilidade atual nem novo preview. Variáveis remotas e isolamento de preview ainda não verificados.

## Ferramentas e bloqueios

Docker instalado foi iniciado; imagens oficiais locais permitem testes sem pull, sem rede externa e sem portas host. GitHub CLI e Supabase CLI instalados. CI atual executa tipos, lint e Vitest, sem SQL/Playwright. Navegador demo cobre interface sem backend; API e Auth precisam evidência própria.

Gates comerciais abertos: baseline remota, RLS global de catálogos/avulsos, API/Auth e upload real, portal revogável, seleção entregue/exportação, timeline de eventos, recorrência e cotas, preview isolado e homologação. Sem conclusão de prontidão comercial.
