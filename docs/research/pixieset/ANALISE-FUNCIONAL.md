# ANALISE FUNCIONAL

## Observado até agora

O dashboard autenticado organiza o acesso por produto e oferece atalhos contextuais. O Client Gallery apresenta onboarding na ausência de coleções e navegação distinta para coleções, biblioteca de fotos, favoritos e lixeira. Estas observações vêm da interface visível do Chrome habitual; ainda não há captura autenticada pelo Craft Anything.

## Limites

Não foi criada coleção, nem acionada a carga de fotos demonstrativas, pois isso poderia persistir conteúdo. Não houve upload, publicação, envio de mensagem, compra, mudança de plano, configuração ou exclusão. Não foi verificado como favoritos, downloads, permissões e comércio se comportam em uma coleção real.

## Matriz de observação para continuidade

- Coleções: formulário antes de salvar, presets, estrutura, organização, capa, ordenação e estados publicados/rascunho quando disponíveis.
- Fotografias: tipos e limites visíveis, progresso, erro, retomada, lotes e seleção; sem enviar arquivos.
- Cliente final: prévia acessível, favoritos, comentários, compartilhamento e download; sem registrar identificação de clientes.
- Store: onboarding, lista de preços, catálogo, pedidos, entrega e pagamentos; sem concluir ativação ou transação.
- Studio Manager: contatos, projetos, documentos, sessões, caixa de entrada e pagamentos; sem criar registros nem enviar comunicação.
- Website: seleção de templates e editor apenas se o acesso não criar site, ativar trial ou publicar alterações.
- Conta: estrutura das preferências e planos, sem registrar valores pessoais ou alterar assinatura.

Funcionalidades bloqueadas por plano ou falta de dados devem constar como não verificadas, com a condição exibida na interface.

## Configurações e regras observadas na sessão habitual

Referências UI-01 a UI-19 no inventário. São observações externas da interface; não provam implementação interna nem equivalem a um teste de ponta a ponta.

- **Coleções e biblioteca:** a biblioteca reúne fotos das coleções. O estado vazio oferece busca e ação para criar coleção. Nesta conta a criação retorna ao onboarding, cuja ação principal inclui fotos demonstrativas; não executada.
- **Estrelas:** a área administrativa separa coleções e fotos com estrela. Isso não comprova o fluxo de favoritos do cliente final.
- **Lixeira:** o texto da interface informa retenção de 30 dias e consumo de armazenamento durante a retenção. Não foi testada exclusão ou recuperação.
- **Página inicial pública:** ativação global, senha opcional, biografia com contador de 500 caracteres, controle de campos de contato e ordenação das coleções. O texto informa que cada coleção controla sua exposição na página inicial. Nenhuma opção foi alterada.
- **Marca:** domínio próprio, logotipo completo, favicon e ocultação da marca possuem indicação de upgrade. Favicon admite GIF, PNG ou ICO até 32×32 px, segundo o texto visível.
- **Marca d’água:** a interface distingue uso nas fotos e nos downloads em tamanho web; informa que a marca não aparece nas impressões compradas na Store. Não foram baixados arquivos para confirmar o processamento.
- **Predefinições:** aplicam configurações padrão a novas coleções; não há predefinição personalizada inspecionada.
- **Comunicação:** modelos de compartilhamento e lembrete de expiração são separados. O editor de um modelo existente mostra nome, assunto opcional, corpo e prévia lateral. Nada foi salvo ou enviado.
- **Preferências:** idioma padrão com ajuste posterior por coleção, visibilidade de nomes de arquivo e indexação em buscadores. Nitidez se aplica à apresentação web, sem alterar os originais, conforme texto visível. RAW está condicionado ao plano Pro. Termos, privacidade e aviso de cookies são configuráveis.
- **Integrações:** Photo Editor, plugin Lightroom e Google Analytics. A interface informa que o plugin exige senha de conta; não foi criada senha nem instalada integração.

## Store

- Menu próprio: onboarding, pedidos, clientes, produtos, impostos, envio, cupons e configurações.
- Lista de preços associável a coleções; a tabela padrão mostra oito itens e nenhuma coleção vinculada. Separação em impressões e decoração de parede, produção manual e valor mínimo de pedido.
- O menu de adicionar produto apresenta produção manual, download digital entregue por link seguro e pacote de produtos. Nenhum produto foi criado.
- Plano Free indica comissão de 15%, além das taxas do processador; a comparação de planos pagos anuncia comissão zero. Registro contextual da interface da conta, não cotação permanente ou orientação financeira.
- Ativação global da loja está desligada. Stripe, PayPal e pagamento alternativo aparecem como métodos configuráveis, sem conexão realizada.
- Moeda BRL vinculada ao país comercial. Há atraso para revisão antes do processamento, manutenção de margem quando o laboratório altera custos e arredondamento de preços.
- Termos de venda e licença de imagem digital são campos distintos, exibidos no checkout conforme descrito na tela.
- Não foi realizado pedido, carrinho, checkout ou teste de entrega. Impostos e demais listas comerciais ainda não têm cobertura integral.

## Studio Manager

- Home agrupa recebimentos, projetos recentes, próximas sessões, faturas e documentos, além de atalhos de criação. As listas operacionais estão vazias; há contato/modelos demonstrativos.
- Projetos: quadro, lista e arquivados; filtros de tipo/data; etapas Inquiry, Booked, Post-production e Completed. O formulário anterior à criação contém cliente, nome e tipo. Não foi criado projeto ou alterada etapa.
- Contatos: grupos de clientes, leads e outros; busca, tabela e acesso a formulários de contato. Dados identificadores não foram transcritos para a documentação.
- Faturas: resumo de pago, futuro e vencido; listas de rascunho, futuro, vencido, pago e cancelado. Pagamentos também anunciam links, transações e relatórios, ainda sem inspeção completa.
- Reservas: bloqueadas por confirmação obrigatória de fuso horário. Não confirmada para preservar as preferências da conta.
- Documentos: contratos, questionários e orçamentos. Contratos possuem estados de rascunho, em andamento, concluído e cancelado. Não foi gerado nem assinado documento.
- Modelos: categorias de contrato, fatura, questionário, orçamento e e-mail; modelos de exemplo existentes. Nenhum texto contratual foi copiado.
- Inbox: estado sem conversas e ação de nova mensagem; nenhuma mensagem enviada.
- Branding: logo condicionado ao Plus, remoção da marca ao Pro, imagem de capa padrão, tema de cores e fonte, prévias de documento, e-mail e site de reservas. Tema exibido: fundo `#F3F3F3`, destaque `#1D1D1D`, fonte descrita como Sans serif. Nenhuma personalização foi alterada.

## Website Builder

O seletor agrupa sites empresariais, portfólios, sites de uma página e temas clássicos. Uma miniatura abriu prévia com esquemas claro/escuro e link de demo público, mantendo um botão separado de selecionar modelo. O botão de aplicação não foi acionado. O editor de um site real e publicação não foram examinados, pois exigiriam escolher/criar um site. O demo público apresentou proteção de acesso no navegador do Craft, portanto não serviu para medidas ou responsividade.
