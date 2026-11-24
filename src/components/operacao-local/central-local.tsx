'use client'

/* eslint-disable @next/next/no-img-element -- arquivos do próprio navegador e assets locais. */
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react'
import { Aperture, Images, CalendarDays, Plus, Search, Upload, Heart, ChevronLeft, ChevronRight, X, Download, LockKeyhole, Eye, Users, Camera, Check, Package, Info, FileCheck2 } from 'lucide-react'
import { aplicarComando, criarEstadoInicial, verificarAcessoLocal, type EstadoLocal, type ComandoLocal, type FotoLocal, type GaleriaLocal, type ProdutoLocal } from '@/lib/operacao-local/modelo'
import { carregarEstado, salvarEstado, salvarArquivo, lerArquivo, apagarArquivo, exportarEstado, CHAVE_ESTADO_LOCAL } from '@/lib/operacao-local/repositorio'
import { lerConfigComercial, calcularFinanceiroLocal } from '@/lib/operacao-local/comercial'
import { PlanosLocais, ConfiguracaoComercial, EditarProdutoLocal, ResumoFinanceiroLocal } from './comercial-local'
import { ProducaoLocal } from './producao-local'
import { LojaLocal } from './loja-local'
import { AssinaturaLocal } from './assinatura-local'
import { NotificacoesLocais, ConversaHistoricoLocal } from './atividade-local'
import s from './central-local.module.css'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'

type Tela = 'galerias' | 'eventos' | 'catalogo' | 'operacao'
type Aba = 'fotos' | 'selecoes' | 'acesso' | 'produtos' | 'producao' | 'loja' | 'conversa'
const moeda = (centavos: number | null) => centavos === null ? 'Sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100)
const dataHora = (data: string) => new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const lerCampo = (dados: FormData, campo: string) => String(dados.get(campo) ?? '').trim()
function baixar(conteudo: Blob | string, nome: string, tipo = 'application/json') {
  const url = URL.createObjectURL(typeof conteudo === 'string' ? new Blob([conteudo], { type: tipo }) : conteudo)
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const celulaCsv = (valor: string) => `"${(/^[=+\-@\t\r]/.test(valor) ? "'" : '') + valor.replaceAll('"', '""')}"`

export function CentralLocal({ previaDisponivel = false }: { previaDisponivel?: boolean }) {
  const [estado, setEstado] = useState<EstadoLocal | null>(null)
  const estadoRef = useRef<EstadoLocal | null>(null)
  const [tela, setTela] = useState<Tela>('galerias')
  const [galeriaId, setGaleriaId] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('fotos')
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('todas')
  const [soFavoritas, setSoFavoritas] = useState(false)
  const [participante, setParticipante] = useState('')
  const [cliente, setCliente] = useState(false)
  const [clienteLiberado, setClienteLiberado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const [enviando, setEnviando] = useState<{ atual: number; total: number } | null>(null)
  const [zipEmCurso, setZipEmCurso] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [fotoAberta, setFotoAberta] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [tentativaSelecao, setTentativaSelecao] = useState<{ galeriaId: string; fotoIds: string[]; revisaoEsperada: number; chave: string } | null>(null)
  const [marcacao, setMarcacao] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLDialogElement>(null)
  const marcarRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [persistenciaDisponivel, setPersistenciaDisponivel] = useState(true)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hidratação do estado persistido exclusivo do navegador.
    try { const inicial = carregarEstado(); salvarEstado(inicial); estadoRef.current = inicial; setEstado(inicial) }
    catch (erro) { const inicial = criarEstadoInicial(); estadoRef.current = inicial; setEstado(inicial); setPersistenciaDisponivel(false); setAviso({ texto: erro instanceof Error ? erro.message : 'Não foi possível recuperar os dados locais. Exporte o trabalho antes de fechar.', erro: true }) }
  }, [])

  useEffect(() => {
    const sincronizar = (evento: StorageEvent) => {
      if (evento.key !== CHAVE_ESTADO_LOCAL) return
      try {
        const atualizado = carregarEstado()
        const acessoMudou = estadoRef.current?.galerias.some(antes => {
          const depois = atualizado.galerias.find(item => item.id === antes.id)
          return !depois || antes.acesso.codigo !== depois.acesso.codigo || antes.acesso.ativo !== depois.acesso.ativo
        })
        estadoRef.current = atualizado; setEstado(atualizado)
        if (acessoMudou) setClienteLiberado(false)
      }
      catch (erro) { setPersistenciaDisponivel(false); setAviso({ texto: erro instanceof Error ? erro.message : 'Os dados locais mudaram e não puderam ser lidos.', erro: true }) }
    }
    window.addEventListener('storage', sincronizar)
    return () => window.removeEventListener('storage', sincronizar)
  }, [])

  useEffect(() => {
    if (!estado) return
    let cancelado = false
    const criadas: string[] = []
    const fotos = estado.galerias.flatMap(g => g.fotos).filter(f => f.url.startsWith('arquivo-local:'))
    void Promise.all(fotos.map(async foto => {
      const blob = await lerArquivo(foto.id)
      if (!blob) return [foto.id, ''] as const
      if (cancelado) return [foto.id, ''] as const
      const url = URL.createObjectURL(blob); criadas.push(url); return [foto.id, url] as const
    })).then(itens => { if (!cancelado) setUrls(Object.fromEntries(itens)) }).catch(() => { if (!cancelado) setAviso({ texto: 'Alguns arquivos locais não puderam ser recuperados. Os demais dados foram preservados.', erro: true }) })
    return () => { cancelado = true; criadas.forEach(url => URL.revokeObjectURL(url)) }
  }, [estado?.galerias.map(g => `${g.id}:${g.fotos.length}`).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (fotoAberta && !dialogRef.current?.open) dialogRef.current?.showModal() }, [fotoAberta])
  useEffect(() => { if (confirmar && !confirmRef.current?.open) confirmRef.current?.showModal() }, [confirmar])
  useEffect(() => { if (marcacao && !marcarRef.current?.open) marcarRef.current?.showModal() }, [marcacao])

  function executar(comando: ComandoLocal, mensagem?: string): EstadoLocal | null {
    try {
      if (!estadoRef.current) return null
      if (!persistenciaDisponivel) throw new Error('A gravação está bloqueada para preservar os dados locais existentes. Recupere o armazenamento e recarregue a página.')
      const maisRecente = carregarEstado()
      estadoRef.current = maisRecente; setEstado(maisRecente)
      const atualizado = aplicarComando(maisRecente, comando)
      if (atualizado !== maisRecente) salvarEstado(atualizado)
      estadoRef.current = atualizado; setEstado(atualizado)
      if (mensagem) setAviso({ texto: mensagem, erro: false })
      return atualizado
    } catch (erro) { setAviso({ texto: erro instanceof Error ? erro.message : 'Não foi possível concluir esta ação.', erro: true }); return null }
  }

  const galeria = estado?.galerias.find(g => g.id === galeriaId)
  const galeriaVisivel = Boolean(galeria && (!cliente || clienteLiberado && galeria.acesso.ativo))
  const fonteFoto = (foto: FotoLocal) => foto.url.startsWith('arquivo-local:') ? urls[foto.id] : foto.url
  const fotosVisiveis = galeria?.fotos.filter(f => (!soFavoritas || galeria.favoritas.includes(f.id)) && (!participante || f.participantes.includes(participante))) ?? []
  const fotoModal = galeria?.fotos.find(f => f.id === fotoAberta)
  const participantes = [...new Set(galeria?.fotos.flatMap(f => f.participantes) ?? [])].sort()

  function navegar(destino: Tela) { setTela(destino); setGaleriaId(null); setNovo(false); setBusca(''); setCliente(false); setClienteLiberado(false) }
  function abrirGaleria(id: string) { setTentativaSelecao(null); setGaleriaId(id); setTela('galerias'); setAba('fotos'); setSoFavoritas(false); setParticipante(''); setNovo(false); setCliente(false); setClienteLiberado(false) }
  function criarGaleria(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const dados = new FormData(e.currentTarget)
    const atualizado = executar({ tipo: 'criar_galeria', nome: lerCampo(dados, 'nome'), cliente: lerCampo(dados, 'cliente'), galeriaTipo: lerCampo(dados, 'tipo') as 'selecao' | 'inteligente', codigo: lerCampo(dados, 'codigo') }, 'Galeria criada neste navegador.')
    if (atualizado) abrirGaleria(atualizado.galerias[0].id)
  }
  async function importar(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []); e.target.value = ''
    if (!galeria || arquivos.length === 0) return
    const idGaleria = galeria.id
    setEnviando({ atual: 0, total: arquivos.length })
    const falhas: string[] = []
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i]
      try {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(arquivo.type)) throw new Error('use JPG, PNG, WebP ou GIF')
        if (arquivo.size > 25 * 1024 * 1024) throw new Error('o limite local é 25 MB por arquivo')
        const imagem = await createImageBitmap(arquivo)
        if (imagem.width === 0 || imagem.height === 0) { imagem.close(); throw new Error('imagem inválida') }
        imagem.close()
        const foto: FotoLocal = { id: crypto.randomUUID(), nome: arquivo.name, url: '', bytes: arquivo.size, tipo: arquivo.type, participantes: [] }
        foto.url = `arquivo-local:${foto.id}`
        await salvarArquivo(foto.id, arquivo)
        if (!executar({ tipo: 'adicionar_fotos', galeriaId: idGaleria, fotos: [foto] })) { await apagarArquivo(foto.id); falhas.push(`${arquivo.name}: não foi possível salvar os metadados`) }
      } catch (erro) { falhas.push(`${arquivo.name}: ${erro instanceof Error ? erro.message : 'falha na importação'}`) }
      setEnviando({ atual: i + 1, total: arquivos.length })
    }
    setEnviando(null); setAviso({ texto: falhas.length ? `Importação parcial. ${falhas.join('; ')}` : `${arquivos.length} foto(s) importada(s) e armazenada(s) neste navegador.`, erro: falhas.length > 0 })
  }
  function favoritar(foto: FotoLocal) { if (galeria && galeriaVisivel) executar({ tipo: 'definir_favorita', galeriaId: galeria.id, fotoId: foto.id, favorita: !galeria.favoritas.includes(foto.id) }) }
  function entregar() {
    const tentativa = tentativaSelecao
    if (!galeria || !galeriaVisivel || !tentativa || tentativa.galeriaId !== galeria.id) return
    if (executar({ tipo: 'entregar_selecao', ...tentativa }, 'Seleção entregue. Uma revisão independente do rascunho foi preservada.')) { setConfirmar(false); confirmRef.current?.close() }
  }
  function abrirConfirmacao() { if (galeria) { setTentativaSelecao({ galeriaId: galeria.id, fotoIds: [...galeria.favoritas], revisaoEsperada: galeria.selecoes.length, chave: crypto.randomUUID() }); setConfirmar(true) } }
  function exportarSelecao(g: GaleriaLocal, revisao: number) {
    const selecao = g.selecoes.find(item => item.revisao === revisao)
    if (!selecao) return
    const linhas = [['revisao', 'id', 'nome_original', 'entregue_em'], ...selecao.fotoIds.map(id => [String(revisao), id, g.fotos.find(f => f.id === id)?.nome ?? '', selecao.entregueEm])]
    baixar('\uFEFF' + linhas.map(linha => linha.map(celulaCsv).join(';')).join('\r\n'), `selecao-revisao-${revisao}.csv`, 'text/csv;charset=utf-8')
  }
  async function baixarFoto(foto: FotoLocal) {
    try {
      let blob: Blob | null
      if (foto.url.startsWith('arquivo-local:')) blob = await lerArquivo(foto.id)
      else { const resposta = await fetch(foto.url); if (!resposta.ok) throw new Error('O original não pôde ser recuperado.'); blob = await resposta.blob() }
      if (!blob) throw new Error('O arquivo original não foi encontrado neste navegador.')
      baixar(blob, foto.nome)
    } catch (erro) { setAviso({ texto: erro instanceof Error ? erro.message : 'Não foi possível baixar o arquivo.', erro: true }) }
  }
  async function baixarSelecaoZip(g: GaleriaLocal, revisao: number) {
    if (zipEmCurso) return
    const selecao = g.selecoes.find(item => item.revisao === revisao)
    if (!selecao) return
    setZipEmCurso(true)
    try {
      const bytesDeclarados = selecao.fotoIds.reduce((total, fotoId) => total + (g.fotos.find(foto => foto.id === fotoId)?.bytes ?? 0), 0)
      if (bytesDeclarados > 100 * 1024 * 1024) throw new Error('O ZIP local está limitado a 100 MB por operação. Baixe os originais individualmente.')
      const arquivos: Record<string, Uint8Array> = {}
      let bytes = 0
      for (let i = 0; i < selecao.fotoIds.length; i++) {
        const foto = g.fotos.find(item => item.id === selecao.fotoIds[i])
        if (!foto) throw new Error('Uma foto desta revisão não foi encontrada.')
        let blob: Blob | null
        if (foto.url.startsWith('arquivo-local:')) blob = await lerArquivo(foto.id)
        else { const resposta = await fetch(foto.url); if (!resposta.ok) throw new Error(`Não foi possível recuperar ${foto.nome}.`); blob = await resposta.blob() }
        if (!blob) throw new Error(`O original ${foto.nome} não foi encontrado neste navegador.`)
        bytes += blob.size
        if (bytes > 100 * 1024 * 1024) throw new Error('O ZIP local está limitado a 100 MB por operação para preservar a memória do navegador. Baixe os originais individualmente.')
        const nomeSeguro = foto.nome.replace(/[\\/\u0000-\u001f]/g, '_').replaceAll('..', '_').replace(/^\.+/, '_')
        arquivos[`${String(i + 1).padStart(4, '0')}_${nomeSeguro}`] = new Uint8Array(await blob.arrayBuffer())
      }
      const { zipSync } = await import('fflate')
      const zip = zipSync(arquivos, { level: 0 })
      baixar(new Blob([new Uint8Array(zip)], { type: 'application/zip' }), `selecao-revisao-${revisao}.zip`)
      setAviso({ texto: `ZIP da revisão ${revisao} preparado com ${selecao.fotoIds.length} originais.`, erro: false })
    } catch (erro) { setAviso({ texto: erro instanceof Error ? erro.message : 'Não foi possível preparar o ZIP. Nenhum arquivo parcial foi baixado.', erro: true }) }
    finally { setZipEmCurso(false) }
  }
  function formularioEvento(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const dados = new FormData(e.currentTarget)
    if (executar({ tipo: 'criar_evento', nome: lerCampo(dados, 'nome'), data: lerCampo(dados, 'data'), local: lerCampo(dados, 'local'), galeriaId: lerCampo(dados, 'galeria') }, 'Evento criado e vinculado à galeria.')) setNovo(false)
  }
  function formularioProduto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const dados = new FormData(e.currentTarget); const preco = lerCampo(dados, 'preco')
    if (executar({ tipo: 'criar_produto', nome: lerCampo(dados, 'nome'), produtoTipo: lerCampo(dados, 'tipo') as ProdutoLocal['tipo'], descricao: lerCampo(dados, 'descricao'), precoCentavos: preco === '' ? null : Math.round(Number(preco.replace(',', '.')) * 100) }, 'Item criado no catálogo local.')) setNovo(false)
  }

  if (!estado) return <div className={s.empty} role="status"><Aperture aria-hidden="true" size={36} /><p>Preparando sua operação local…</p></div>
  const titulo: Record<Tela, string> = { galerias: 'Suas galerias', eventos: 'Eventos e encontros', catalogo: 'Produtos e serviços', operacao: 'Sua operação' }
  const descricao: Record<Tela, string> = { galerias: 'Cada história merece uma entrega especial.', eventos: 'Organize os encontros e conecte cada um à sua galeria.', catalogo: 'Conecte seus produtos e serviços à experiência das galerias.', operacao: 'Acompanhe solicitações e o que acontece no seu estúdio.' }
  const configComercial = lerConfigComercial(estado)
  const galeriasFiltradas = estado.galerias.filter(g => (tipoFiltro === 'todas' || g.tipo === tipoFiltro) && `${g.nome} ${g.cliente}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))

  return <WorkspaceShell previaDisponivel={previaDisponivel} area="local" nome="Estúdio demonstração" demonstracao acaoLocal={tela} aoNavegarLocal={destino => navegar(destino as Tela)}><div className={s.shell}>
    <div className={s.workspace}>
      <div className={s.content}>
        <div className={s.notice}><Info aria-hidden="true" size={20} className="shrink-0" /><p><strong>Ambiente local de desenvolvimento.</strong> Use arquivos de teste. A prévia do cliente, os pedidos e a assinatura são simulações neste navegador. Não há publicação, pagamento ou reconhecimento facial automático.</p></div>
        {aviso && <div className={`${s.status} ${aviso.erro ? s.error : ''}`} role={aviso.erro ? 'alert' : 'status'}><span>{aviso.texto}</span><button aria-label="Fechar aviso" onClick={() => setAviso(null)}><X aria-hidden="true" size={17} /></button></div>}
        {!persistenciaDisponivel && <p role="alert" className={s.notice}>A persistência local está indisponível. Exporte os dados antes de fechar esta página.</p>}
        {!galeria && <><div className={s.heading}><div><span className={s.eyebrow}>Seu estúdio digital</span><h1>{titulo[tela]}</h1><p className={s.muted}>{descricao[tela]}</p></div>{tela !== 'operacao' && <button className={s.button} onClick={() => setNovo(!novo)}><Plus aria-hidden="true" size={17} />{tela === 'galerias' ? 'Nova galeria' : tela === 'eventos' ? 'Novo evento' : 'Novo item'}</button>}</div>
          {tela === 'galerias' && <><div className={s.stats}>{[{ icon: Images, total: estado.galerias.length, nome: 'Galerias criadas' }, { icon: Camera, total: estado.galerias.reduce((n, g) => n + g.fotos.length, 0), nome: 'Fotografias' }, { icon: FileCheck2, total: estado.galerias.reduce((n, g) => n + g.selecoes.length, 0), nome: 'Seleções entregues' }, { icon: CalendarDays, total: estado.eventos.length, nome: 'Eventos' }].map(item => <div className={s.stat} key={item.nome}><item.icon aria-hidden="true" size={21} /><strong>{item.total}</strong><span>{item.nome}</span></div>)}</div>
            {novo && <section className={s.panel}><h2>Nova galeria</h2><form className={s.form} onSubmit={criarGaleria}><label className={s.field}>Nome da galeria<input required maxLength={160} name="nome" placeholder="Ex.: Ensaio de família" /></label><label className={s.field}>Cliente<input required maxLength={160} name="cliente" placeholder="Nome do cliente ou do evento" /></label><label className={s.field}>Tipo de galeria<select name="tipo"><option value="selecao">Seleção de fotos</option><option value="inteligente">Inteligente / participantes</option></select></label><label className={s.field}>Código de acesso local<input required minLength={4} maxLength={32} pattern="[a-zA-Z0-9-]+" name="codigo" defaultValue="LOCAL2026" /></label><div className={s.formFooter}><button type="button" className={s.secondary} onClick={() => setNovo(false)}>Cancelar</button><button className={s.button}>Criar galeria</button></div></form></section>}
            <div className={s.toolbar}><div className={s.tabs}>{[{ id: 'todas', nome: 'Todas as galerias' }, { id: 'selecao', nome: 'Seleção' }, { id: 'inteligente', nome: 'Inteligentes' }].map(item => <button key={item.id} aria-pressed={tipoFiltro === item.id} onClick={() => setTipoFiltro(item.id)}>{item.nome}</button>)}</div><label className={s.search}><Search aria-hidden="true" size={18} /><span className={s.screenReader}>Buscar galerias</span><input placeholder="Buscar galerias ou clientes" value={busca} onChange={e => setBusca(e.target.value)} /></label></div>
            <div className={s.grid}>{galeriasFiltradas.map(g => <article className={s.card} key={g.id}><button className={s.cover} onClick={() => abrirGaleria(g.id)} aria-label={`Abrir galeria ${g.nome}`}>{g.fotos[0] && fonteFoto(g.fotos[0]) ? <img src={fonteFoto(g.fotos[0])} alt="" /> : <Images aria-hidden="true" />}<span className={s.badge}>{g.tipo === 'selecao' ? 'Seleção de fotos' : 'Inteligente · agrupamento manual'}</span></button><div className={s.cardBody}><button onClick={() => abrirGaleria(g.id)}><h2>{g.nome}</h2></button><p className={s.muted}>{g.cliente}</p><div className={s.cardMeta}><span>{g.fotos.length} fotos · {g.selecoes.length} seleções</span><span>{g.acesso.ativo ? 'Acesso local ativo' : 'Acesso revogado'}</span></div></div></article>)}</div>{galeriasFiltradas.length === 0 && <div className={s.empty}><Images aria-hidden="true" size={35} /><h2>Nenhuma galeria encontrada</h2><p>Crie uma galeria ou ajuste sua busca para começar.</p></div>}
          </>}
          {tela === 'eventos' && <>{novo && <section className={s.panel}><h2>Novo evento</h2><form className={s.form} onSubmit={formularioEvento}><label className={s.field}>Nome do evento<input name="nome" required maxLength={160} /></label><label className={s.field}>Data do evento<input type="date" name="data" required /></label><label className={s.field}>Local<input name="local" required maxLength={160} /></label><label className={s.field}>Galeria vinculada<select name="galeria" required>{estado.galerias.map(g => <option value={g.id} key={g.id}>{g.nome}</option>)}</select></label><div className={s.formFooter}><button className={s.button}>Criar evento</button></div></form></section>}<div className={s.grid}>{estado.eventos.map(evento => <article className={`${s.card} ${s.catalogCard}`} key={evento.id}><CalendarDays aria-hidden="true" size={28} color="#e8634b" /><span className={s.badge}>{new Date(`${evento.data}T12:00:00`).toLocaleDateString('pt-BR')}</span><h2>{evento.nome}</h2><p className={s.muted}>{evento.local}</p><p className={s.small}>{estado.galerias.find(g => g.id === evento.galeriaId)?.nome}</p><button className={s.secondary} onClick={() => abrirGaleria(evento.galeriaId)}>Abrir galeria do evento</button></article>)}</div></>}
          {tela === 'catalogo' && <>{novo && <section className={s.panel}><h2>Novo item do catálogo</h2><form className={s.form} onSubmit={formularioProduto}><label className={s.field}>Nome do item<input name="nome" required maxLength={160} /></label><label className={s.field}>Tipo de item<select name="tipo"><option value="produto">Produto</option><option value="servico">Serviço</option></select></label><label className={s.field}>Valor de teste (R$)<input name="preco" type="number" min="0" step="0.01" placeholder="Deixe vazio para sob consulta" /></label><label className={s.field}>Descrição<textarea name="descricao" maxLength={2000} /></label><div className={s.formFooter}><button className={s.button}>Adicionar ao catálogo</button></div></form></section>}<div className={s.grid}>{estado.catalogo.map(produto => <article className={`${s.card} ${s.catalogCard}`} key={produto.id}><Package aria-hidden="true" size={28} color="#e8634b" /><span className={s.badge}>{produto.tipo === 'produto' ? 'Produto' : 'Serviço'}</span><h3>{produto.nome}</h3><p className={s.muted}>{produto.descricao}</p><p className={s.price}>{moeda(produto.precoCentavos)}</p><p className={s.small}>Vincule este item na aba Produtos de uma galeria.</p><EditarProdutoLocal produto={produto} executar={executar} /></article>)}</div></>}
          {tela === 'operacao' && <><AssinaturaLocal key={estado.cicloAssinatura?.id ?? "sem-ciclo"} estado={estado} executar={executar} /><NotificacoesLocais estado={estado} executar={executar} /><PlanosLocais estado={estado} config={configComercial} executar={executar} /><div className={s.split}><div><section className={s.panel}><h2>Solicitações locais</h2>{estado.pedidos.length === 0 ? <p className={s.muted}>As solicitações dos produtos e serviços das galerias aparecem aqui. Nenhum pagamento será processado.</p> : <div className={s.list}>{estado.pedidos.map(pedido => <div className={s.row} key={pedido.id}><div><h3>{pedido.produtoNome}</h3><p>{estado.galerias.find(g => g.id === pedido.galeriaId)?.nome} · {moeda(pedido.totalCentavos)}</p><p>{pedido.fotoIds.length} fotos · {pedido.status.replaceAll('_', ' ')}</p><ResumoFinanceiroLocal totalCentavos={pedido.totalCentavos} financeiro={pedido.financeiro} registrado /></div><div className={s.actions}>{pedido.status === 'solicitado' && <button className={s.secondary} onClick={() => executar({ tipo: 'alterar_pedido', pedidoId: pedido.id, status: 'em_preparacao' })}>Preparar</button>}{pedido.status === 'em_preparacao' && <button className={s.secondary} onClick={() => executar({ tipo: 'alterar_pedido', pedidoId: pedido.id, status: 'concluido' })}>Concluir</button>}{['solicitado', 'em_preparacao'].includes(pedido.status) && <button className={s.danger} onClick={() => executar({ tipo: 'alterar_pedido', pedidoId: pedido.id, status: 'cancelado' })}>Cancelar</button>}</div></div>)}</div>}</section><section className={s.panel}><h2>Atividade do estúdio</h2>{estado.atividades.length ? <ol className={s.timeline}>{estado.atividades.slice(0, 30).map(item => <li key={item.id}><p>{item.texto}</p><time>{dataHora(item.criadaEm)}</time></li>)}</ol> : <p className={s.muted}>As ações realizadas aqui serão registradas com a data real.</p>}</section></div><div><ConfiguracaoComercial config={configComercial} executar={executar} /><section className={s.panel}><h2>Assinatura de serviços</h2><p className={s.muted}>Simulação avançada com nome livre. Use os planos acima para registrar preço e franquia ilustrativos.</p><p className="my-5"><span className={s.badge}>{estado.assinatura.status === 'simulada' ? `Simulada: ${estado.assinatura.plano}` : 'Nenhuma assinatura simulada'}</span></p><form onSubmit={e => { e.preventDefault(); executar({ tipo: 'simular_assinatura', plano: lerCampo(new FormData(e.currentTarget), 'plano') }, 'Assinatura simulada. Nenhuma cobrança ou renovação foi ativada.') }}><label className={s.field}>Nome do plano de teste<input name="plano" required maxLength={160} placeholder="Ex.: Galerias do estúdio" /></label><button className={`${s.secondary} mt-4`}>Simular assinatura</button></form></section><section className={s.panel}><h2>Cópia dos dados</h2><p className={s.muted}>Exporte cadastros e histórico em JSON. Os arquivos das fotos ficam no IndexedDB e devem ser baixados individualmente pela galeria.</p><button className={`${s.secondary} mt-4`} onClick={() => baixar(exportarEstado(estado), 'seualbum-operacao-local.json')}><Download aria-hidden="true" size={16} />Exportar dados locais</button></section></div></div></>}
        </>}

        {galeria && <><button className={s.back} onClick={() => { setGaleriaId(null); setCliente(false); setClienteLiberado(false) }}><ChevronLeft aria-hidden="true" size={17} />Todas as galerias</button><section className={s.galleryHeader}><div className={s.heading}><div><span className={s.eyebrow}>{galeria.tipo === 'inteligente' ? 'Galeria inteligente · agrupamento manual' : 'Galeria de seleção'}</span><h1>{galeria.nome}</h1><p className={s.muted}>{galeria.cliente} · {galeria.fotos.length} fotos</p></div><div className={s.actions}><button className={s.secondary} onClick={() => { setCliente(!cliente); setClienteLiberado(false); setAba('fotos') }}><Eye aria-hidden="true" size={16} />{cliente ? 'Visão do fotógrafo' : 'Visão do cliente'}</button>{!cliente && <><input ref={inputRef} className={s.fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={importar} aria-label="Arquivos de fotos" /><button className={s.button} disabled={Boolean(enviando)} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" size={16} />Importar fotos</button></>}</div></div><div className={s.galleryControls}><div className={s.tabs}>{([{ id: 'fotos', nome: 'Fotografias' }, { id: 'selecoes', nome: 'Seleções entregues' }, { id: 'produtos', nome: 'Produtos e serviços' }, { id: 'producao', nome: 'Diagramação e prova' }, { id: 'loja', nome: 'Loja e compras' }, { id: 'conversa', nome: 'Mensagens e histórico' }, ...(!cliente ? [{ id: 'acesso', nome: 'Acesso local' }] : [])] as { id: Aba; nome: string }[]).map(item => <button key={item.id} onClick={() => setAba(item.id)} aria-pressed={aba === item.id}>{item.nome}</button>)}</div><span className={s.badge}>{cliente ? 'Prévia local do cliente' : 'Área do fotógrafo'}</span></div>{enviando && <div role="status"><p className={`${s.muted} mt-4`}>Importando {enviando.atual} de {enviando.total} arquivos…</p><div className={s.progress}><span style={{ width: `${100 * enviando.atual / enviando.total}%` }} /></div></div>}</section>
          {cliente && !galeriaVisivel ? <section className={s.empty}><LockKeyhole aria-hidden="true" size={38} /><h2>Prévia local do cliente</h2><p>Este acesso simula a jornada neste navegador. O código não cria um link privado real nem compartilha fotos com outros dispositivos.</p>{galeria.acesso.ativo ? <form onSubmit={e => { e.preventDefault(); if (verificarAcessoLocal(galeria, lerCampo(new FormData(e.currentTarget), 'codigo'))) { setClienteLiberado(true); setAviso(null) } else setAviso({ texto: 'Código local incorreto.', erro: true }) }}><label className={s.field}>Código de acesso<input name="codigo" required autoComplete="off" /></label><button className={`${s.button} mt-4`}>Entrar na prévia</button></form> : <p role="status">O acesso local desta galeria foi revogado pelo fotógrafo.</p>}</section> : <>
            {galeria.tipo === 'inteligente' && aba === 'fotos' && <div className={s.notice}><Users aria-hidden="true" size={20} className="shrink-0" /><p>Organize fotos por participante manualmente e filtre os grupos abaixo. O reconhecimento por selfie já existente será conectado ao serviço facial em outra etapa; ele não é executado nesta central local.</p></div>}
            {aba === 'producao' && <ProducaoLocal estado={estado} galeria={galeria} cliente={cliente} executar={executar} />}
            {aba === 'loja' && <LojaLocal estado={estado} galeria={galeria} cliente={cliente} executar={executar} />}
            {aba === 'conversa' && <ConversaHistoricoLocal estado={estado} galeria={galeria} cliente={cliente} executar={executar} />}
            {aba === 'fotos' && <><div className={s.toolbar}><label className={s.check}><input type="checkbox" checked={soFavoritas} onChange={e => setSoFavoritas(e.target.checked)} />Somente favoritas ({galeria.favoritas.length})</label>{galeria.tipo === 'inteligente' && <label className={s.field}>Participante<select value={participante} onChange={e => setParticipante(e.target.value)}><option value="">Todos os participantes</option>{participantes.map(p => <option key={p}>{p}</option>)}</select></label>}</div>{fotosVisiveis.length > 0 ? <div className={s.photoGrid}>{fotosVisiveis.map(foto => <article className={s.photo} key={foto.id}><button className={s.photoImage} onClick={() => setFotoAberta(foto.id)} aria-label={`Ampliar ${foto.nome}`}>{fonteFoto(foto) ? <img src={fonteFoto(foto)} alt={foto.nome} loading="lazy" /> : <span className={s.muted}>Arquivo local indisponível</span>}</button><button className={s.favorite} aria-pressed={galeria.favoritas.includes(foto.id)} aria-label={`Favoritar ${foto.nome}`} onClick={() => favoritar(foto)}><Heart aria-hidden="true" size={18} fill={galeria.favoritas.includes(foto.id) ? 'currentColor' : 'none'} /></button><div className={s.photoCaption}><span>{foto.nome}</span>{!cliente && galeria.tipo === 'inteligente' && <button aria-label={`Marcar participante em ${foto.nome}`} onClick={() => setMarcacao(foto.id)}><Users aria-hidden="true" size={16} /></button>}<button aria-label={`Baixar ${foto.nome}`} onClick={() => void baixarFoto(foto)}><Download aria-hidden="true" size={15} /></button></div></article>)}</div> : <div className={s.empty}><Camera aria-hidden="true" size={40} /><h2>{galeria.fotos.length ? 'Nenhuma foto neste filtro' : 'Esta história começa com suas fotos'}</h2><p>{galeria.fotos.length ? 'Ajuste os filtros para ver outras imagens.' : 'Importe JPG, PNG, WebP ou GIF. Os arquivos são guardados neste navegador, inclusive após recarregar a página.'}</p></div>}<div className={s.selectionBar}><div><strong>{galeria.favoritas.length} fotos favoritas</strong><span>Favoritos são rascunho. Entregar cria uma revisão preservada.</span></div><button className={s.button} disabled={galeria.favoritas.length === 0} onClick={abrirConfirmacao}><Check aria-hidden="true" size={16} />Entregar seleção</button></div></>}
            {aba === 'selecoes' && <section className={s.panel}><h2>Seleções entregues</h2><p className={`${s.muted} mb-5`}>Cada entrega preserva os IDs confirmados. Alterar favoritas não muda revisões anteriores e não aprova um álbum.</p>{galeria.selecoes.length === 0 ? <p className={s.muted}>Nenhuma seleção entregue. Marque suas fotos favoritas e confirme a entrega.</p> : <div className={s.list}>{[...galeria.selecoes].reverse().map(selecao => <div className={s.row} key={selecao.id}><div><h3>Revisão {selecao.revisao} · {selecao.fotoIds.length} fotos</h3><p>{dataHora(selecao.entregueEm)}</p><p>{selecao.fotoIds.map(id => galeria.fotos.find(f => f.id === id)?.nome).filter(Boolean).join(', ')}</p></div><div className={s.actions}><button className={s.secondary} onClick={() => exportarSelecao(galeria, selecao.revisao)}><Download aria-hidden="true" size={16} />Exportar CSV</button><button className={s.secondary} disabled={zipEmCurso} onClick={() => void baixarSelecaoZip(galeria, selecao.revisao)}><Download aria-hidden="true" size={16} />{zipEmCurso ? 'Preparando ZIP…' : 'Baixar originais ZIP'}</button></div></div>)}</div>}</section>}
            {aba === 'acesso' && !cliente && <section className={s.panel}><h2>Acesso à prévia local</h2><p className={s.muted}>O portal privado real da aplicação continua preservado. Aqui, o código apenas exercita o fluxo de acesso local no mesmo navegador.</p><form className={`${s.form} mt-5`} onSubmit={e => { e.preventDefault(); executar({ tipo: 'alterar_acesso', galeriaId: galeria.id, ativo: true, codigo: lerCampo(new FormData(e.currentTarget), 'codigo') }, 'Código local atualizado e acesso habilitado.') }}><label className={s.field}>Código local<input name="codigo" defaultValue={galeria.acesso.codigo} required minLength={4} maxLength={32} pattern="[a-zA-Z0-9-]+" /></label><div className={s.actions}><button className={s.button}>Salvar e habilitar acesso</button><button className={s.danger} type="button" disabled={!galeria.acesso.ativo} onClick={() => executar({ tipo: 'alterar_acesso', galeriaId: galeria.id, ativo: false }, 'Acesso local revogado.')}>Revogar acesso</button></div></form><p className={`${s.muted} mt-4`}>Estado: {galeria.acesso.ativo ? 'ativo' : 'revogado'}</p></section>}
            {aba === 'produtos' && <section className={s.panel}><h2>{cliente ? 'Complemente sua entrega' : 'Itens vinculados à galeria'}</h2><p className={`${s.muted} mb-5`}>{cliente ? 'Solicitações de demonstração, sem pagamento ou contratação real.' : 'Escolha os produtos e serviços que aparecem na prévia do cliente.'}</p><div className={s.list}>{estado.catalogo.filter(produto => !cliente || galeria.produtoIds.includes(produto.id)).map(produto => <div className={s.row} key={produto.id}><div><h3>{produto.nome}</h3><p>{produto.descricao}</p><p>Valor do item: {moeda(produto.precoCentavos)}</p>{!cliente && <ResumoFinanceiroLocal totalCentavos={produto.precoCentavos} financeiro={calcularFinanceiroLocal(galeria.tipo, produto.tipo, produto.precoCentavos, configComercial)} />}</div>{cliente ? <button className={s.button} onClick={() => executar({ tipo: 'criar_pedido', galeriaId: galeria.id, produtoId: produto.id, fotoIds: [...galeria.favoritas] }, 'Solicitação simulada criada. Nenhuma cobrança foi realizada.')}>Simular solicitação</button> : <label className={s.check}><input type="checkbox" checked={galeria.produtoIds.includes(produto.id)} onChange={e => executar({ tipo: 'vincular_produto', galeriaId: galeria.id, produtoId: produto.id, vinculado: e.target.checked })} />Disponível nesta galeria</label>}</div>)}</div>{cliente && galeria.produtoIds.length === 0 && <p className={s.muted}>Nenhum produto ou serviço disponível nesta galeria.</p>}</section>}
          </>}
        </>}
      </div>
    </div>
    <dialog ref={dialogRef} className={s.dialog} onClose={() => setFotoAberta(null)} onKeyDown={e => { if (!galeria || !fotoAberta) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const i = fotosVisiveis.findIndex(f => f.id === fotoAberta); const nova = fotosVisiveis[(i + (e.key === 'ArrowRight' ? 1 : -1) + fotosVisiveis.length) % fotosVisiveis.length]; if (nova) setFotoAberta(nova.id) } }} aria-label="Visualização da fotografia">{fotoModal && <><div className={s.dialogHeader}><span>{fotoModal.nome}</span><button aria-label="Fechar fotografia" onClick={() => dialogRef.current?.close()}><X aria-hidden="true" size={20} /></button></div>{fonteFoto(fotoModal) && <img className={s.dialogPhoto} src={fonteFoto(fotoModal)} alt={fotoModal.nome} />}<div className={s.dialogNav}><button aria-label="Foto anterior" onClick={() => { const i = fotosVisiveis.findIndex(f => f.id === fotoModal.id); setFotoAberta(fotosVisiveis[(i - 1 + fotosVisiveis.length) % fotosVisiveis.length]?.id ?? null) }}><ChevronLeft aria-hidden="true" size={22} /></button><button aria-label="Favoritar fotografia ampliada" aria-pressed={galeria?.favoritas.includes(fotoModal.id)} onClick={() => favoritar(fotoModal)}><Heart aria-hidden="true" size={20} fill={galeria?.favoritas.includes(fotoModal.id) ? '#e8634b' : 'none'} /></button><button aria-label="Próxima foto" onClick={() => { const i = fotosVisiveis.findIndex(f => f.id === fotoModal.id); setFotoAberta(fotosVisiveis[(i + 1) % fotosVisiveis.length]?.id ?? null) }}><ChevronRight aria-hidden="true" size={22} /></button></div></>}</dialog>
    <dialog ref={confirmRef} className={s.dialog} onClose={() => setConfirmar(false)} aria-labelledby="confirmar-selecao-titulo"><div className={s.dialogForm}><h2 id="confirmar-selecao-titulo">Confirmar entrega da seleção</h2><p className={s.muted}>Você está entregando {tentativaSelecao?.fotoIds.length ?? 0} fotos. Esta será a revisão {(tentativaSelecao?.revisaoEsperada ?? 0) + 1}. As revisões anteriores serão preservadas.</p><div className={`${s.actions} mt-6`}><button className={s.secondary} onClick={() => confirmRef.current?.close()}>Continuar escolhendo</button><button className={s.button} onClick={entregar}>Confirmar entrega</button></div></div></dialog>
    <dialog ref={marcarRef} className={s.dialog} onClose={() => setMarcacao(null)} aria-labelledby="marcar-participante-titulo"><div className={s.dialogForm}><h2 id="marcar-participante-titulo">Identificar participante manualmente</h2><p className={s.muted}>Marcação feita por você, sem processamento facial automático.</p><form onSubmit={e => { e.preventDefault(); if (!galeria || !marcacao) return; if (executar({ tipo: 'marcar_participante', galeriaId: galeria.id, fotoId: marcacao, participante: lerCampo(new FormData(e.currentTarget), 'participante'), presente: true }, 'Participante marcado manualmente.')) marcarRef.current?.close() }}><label className={s.field}>Nome do participante<input name="participante" required maxLength={80} /></label><div className={s.actions}><button type="button" className={s.secondary} onClick={() => marcarRef.current?.close()}>Cancelar</button><button className={s.button}>Marcar participante</button></div></form>{galeria?.fotos.find(f => f.id === marcacao)?.participantes.map(p => <button className={`${s.secondary} mt-4 mr-2`} key={p} onClick={() => { if (galeria && marcacao) executar({ tipo: 'marcar_participante', galeriaId: galeria.id, fotoId: marcacao, participante: p, presente: false }) }}>{p}<X aria-hidden="true" size={14} aria-label="Remover participante" /></button>)}</div></dialog>
  </div></WorkspaceShell>
}
