# Experiência e design system SeuAlbum

## Base preservada

Poppins em títulos e Open Sans no corpo (`src/app/layout.tsx`, globals e tailwind.config); Lucide para ícones, Radix e componentes em `src/components/ui`. Tokens locais incluem fundo branco, foreground 224/20%/12%, primary 224/71%/20%, accent 24/95%/53% e radius 0.75rem. Há usos diretos de cinza/preto e estilos próprios de marketing: inventariar e convergir sem trocar marca ou uniformizar cegamente todas as telas.

Não importar fonte, logotipo, foto, ícone proprietário, texto ou CSS do Pixieset. Seus painéis foram observados parcialmente; medidas do login e da verificação não definem este design system.

## Shell e navegação propostos

Cabeçalho com organização ativa, seletor de produtos habilitados, busca contextual e conta. Dashboard mostra próxima ação, projetos e pendências; não agrega dados privados de outra organização. Sidebar muda por módulo e capacidade, com nome do módulo e caminho de retorno. Trocar produto mantém organização e seleciona contexto válido; deep link inválido deve mostrar acesso negado/indisponibilidade, não fallback de dados alheios.

Preservar `/admin` para produção interna, `/dashboard` para estúdio e `/cliente` para cliente. Seletor de produto não concede edição de Design a quem só pode acompanhar o álbum. Cliente mantém marca do estúdio e linguagem de aprovação, sem expor ferramentas administrativas do ecossistema.

## Componentes reutilizáveis

| Componente | Regra |
|---|---|
| Cabeçalho de página | Título, contexto, estado e uma ação principal |
| Tabela/quadro | Mesma entidade e filtros, URL compartilhável sem dados pessoais |
| Filtros e abas | Estados legíveis; seleção e aprovação são abas/ações distintas |
| Estado vazio | Explica motivo e próxima ação autorizada; demo nunca cria dados sem escolha |
| Upload | Estado por arquivo: pendente, enviando, confirmando, concluído, erro recuperável |
| Seleção | Salvar/entregar com confirmação visível; falha reverte ou permite retry |
| Modal/diálogo | Foco contido, Escape quando seguro, retorno ao acionador, rótulos |
| Avisos/cotas | Distinguir sem permissão, recurso de plano e integração indisponível |
| Preview | Separada de salvar/enviar/publicar; sem efeito permanente ao visualizar |

## Responsividade e acessibilidade propostas

Validar conteúdo em 360/390/768/1280/1440 CSS px, zoom 200%, teclado e leitor de tela nos percursos principais. Mobile usa navegação por módulo recolhível, ações essenciais acessíveis e grade adaptativa; tabelas podem ter overflow indicado, sem esconder comandos. Alvos de toque de 44px como meta interna. Contraste deve ser medido, não inferido das cores.

Respeitar prefers-reduced-motion já presente em globals; não transmitir estado só por cor. Não anunciar conformidade de acessibilidade até auditoria específica. Upload precisa de status acessível, erro acionável e possibilidade de continuar sem perder progresso. Lightbox precisa de navegação, Escape e retorno ao item de origem, sujeitos a teste.

## Critério de entrega de UI

Reusar componentes antes de criar outro Button/Modal/Tabs; provar estados vazio/carregando/erro/sem acesso; validar isolamento e contexto; testar teclado/mobile; preservar contratos de prova e pagamento. Layout novo não pode depender de dados reais para ser revisado: fixtures sintéticas em ambiente isolado, quando implementação/testes forem autorizados.
