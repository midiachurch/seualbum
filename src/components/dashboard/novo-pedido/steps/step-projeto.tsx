'use client'

import { useState } from 'react'
import { WizardField } from '@/components/dashboard/novo-pedido/steps/field'
import { usePedidoWizardStore } from '@/store/usePedidoWizardStore'

export function StepProjeto() {
  const dados = usePedidoWizardStore((s) => s.dadosProjeto)
  const atualizar = usePedidoWizardStore((s) => s.atualizarProjeto)
  const [nomeTocado, setNomeTocado] = useState(false)

  const erroNome =
    nomeTocado && dados.nomeProjeto.trim().length < 2 ? 'Informe o nome do casal ou do evento.' : null

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()} noValidate>
      <WizardField
        label="Nome do casal ou evento"
        placeholder="Ex.: Ana & Pedro"
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        value={dados.nomeProjeto}
        onChange={(e) => atualizar({ nomeProjeto: e.target.value })}
        onBlur={() => setNomeTocado(true)}
        erro={erroNome}
        required
      />

      <WizardField
        label="Data do evento"
        opcional
        type="date"
        value={dados.dataEvento}
        onChange={(e) => atualizar({ dataEvento: e.target.value })}
      />

      <fieldset className="space-y-5 rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] p-4">
        <legend className="px-1 text-sm font-semibold text-[#171717]">
          Contato do cliente <span className="font-normal text-[#6B6B6B]">(opcional)</span>
        </legend>
        <p className="-mt-2 text-sm text-[#595959]">
          Usamos só para enviar a prova do álbum direto para o casal, se você quiser.
        </p>

        <WizardField
          label="Nome"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          value={dados.nomeCliente}
          onChange={(e) => atualizar({ nomeCliente: e.target.value })}
        />
        <WizardField
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 90000-0000"
          enterKeyHint="next"
          value={dados.telefoneCliente}
          onChange={(e) => atualizar({ telefoneCliente: e.target.value })}
        />
        <WizardField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          value={dados.emailCliente}
          onChange={(e) => atualizar({ emailCliente: e.target.value })}
        />
      </fieldset>
    </form>
  )
}
