import { describe, expect, it } from 'vitest'
import { itemWorkspaceAtivo, navegacaoWorkspace } from './navegacao'

describe('navegação dos workspaces', () => {
  it('preserva as áreas de produção do designer sem exibir gestão de pessoas ou loja', () => {
    const links = navegacaoWorkspace('admin', 'designer').map(i => i.href)
    expect(links).toContain('/admin/design')
    expect(links).toContain('/admin/albuns')
    expect(links).not.toContain('/admin/clientes')
    expect(links).not.toContain('/admin/fotografos')
    expect(links).not.toContain('/admin/equipe')
    expect(links).not.toContain('/admin/catalogo')
    // A proxy limita o designer à própria fila, aos álbuns e a detalhes de
    // projetos abertos pela fila. O menu não promete listas que a proxy nega.
    expect(links).toEqual(['/admin/design', '/admin/albuns'])
  })
  it('não monta navegação administrativa sem um papel', () => {
    expect(navegacaoWorkspace('admin', null)).toEqual([])
  })
  it('destaca expedição sem destacar produção junto', () => {
    const itens = navegacaoWorkspace('admin', 'admin')
    expect(itemWorkspaceAtivo(itens, '/admin/producao/grafica/exemplo', '')?.href).toBe('/admin/producao/grafica')
  })
  it('identifica a aba de tarefas ao abrir diretamente ou voltar pelo histórico', () => {
    const itens = navegacaoWorkspace('previa')
    expect(itemWorkspaceAtivo(itens, '/previa/estudio', 'aba=tarefas')?.nome).toBe('Tarefas')
    expect(itemWorkspaceAtivo(itens, '/previa/estudio', 'aba=modelos')?.nome).toBe('Modelos de mensagem')
    expect(itemWorkspaceAtivo(itens, '/previa/estudio', '')?.nome).toBe('Clientes e propostas')
  })
  it('mantém a prova do fotógrafo dentro de Meus álbuns', () => {
    expect(itemWorkspaceAtivo(navegacaoWorkspace('fotografo'), '/dashboard/albuns/exemplo/prova', '')?.nome).toBe('Meus álbuns')
  })
  it('não oferece destinos da prévia quando o servidor local não os habilitou', () => {
    expect(navegacaoWorkspace('local', null, false).some(i => i.href.startsWith('/previa'))).toBe(false)
    expect(navegacaoWorkspace('editor', null, false).map(i => i.href)).toEqual(['/editor-preview', '/'])
  })
})
