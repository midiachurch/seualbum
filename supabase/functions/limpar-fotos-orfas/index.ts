import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Apaga fotos de rascunhos abandonados do bucket `pedidos_fotos` (migration
 * 0015). Chamada de hora em hora pelo pg_cron; QUAIS arquivos apagar vem de
 * `fotos_orfas_pedidos()` no banco — aqui só executamos a remoção pela API do
 * Storage, que é o único caminho permitido para apagar objetos.
 *
 * Autenticação: header `x-cron-secret`, conferido contra o segredo do Vault
 * (`validar_segredo_limpeza_fotos`). Por isso verify_jwt=false: o pg_cron não
 * tem JWT de usuário, e a function não confia em mais nada além do segredo.
 *
 * Corpo opcional: { "dry_run": true } só lista o que seria apagado. Em
 * dry_run também dá para passar "horas" (ex.: 0) para inspecionar; a remoção
 * de verdade sempre usa no mínimo 72h.
 */

const HORAS_MINIMAS = 72; // SLA do rascunho (migration 0016)
const MAX_LOTES = 10; // até 10 mil arquivos por execução; o resto vai na próxima hora

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const segredo = req.headers.get("x-cron-secret") ?? "";
  const { data: valido, error: segredoError } = await admin.rpc("validar_segredo_limpeza_fotos", { p_segredo: segredo });
  if (segredoError || valido !== true) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { dry_run?: boolean; horas?: number } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio: execução normal
  }
  const dryRun = body.dry_run === true;
  const horas = dryRun && typeof body.horas === "number" ? Math.max(0, body.horas) : HORAS_MINIMAS;

  const removidos: string[] = [];
  for (let lote = 0; lote < MAX_LOTES; lote++) {
    const { data, error } = await admin.rpc("fotos_orfas_pedidos", { p_horas: horas, p_limite: 1000 });
    if (error) {
      console.error("[limpar-fotos-orfas] listar", error);
      return Response.json({ error: "falha ao listar", removidos: removidos.length }, { status: 500 });
    }
    const nomes = (data ?? []).map((linha: { nome: string }) => linha.nome);
    if (nomes.length === 0) break;

    if (dryRun) {
      return Response.json({ dry_run: true, horas, arquivos: nomes.length, exemplos: nomes.slice(0, 20) });
    }

    const { error: removeError } = await admin.storage.from("pedidos_fotos").remove(nomes);
    if (removeError) {
      console.error("[limpar-fotos-orfas] remover", removeError);
      return Response.json({ error: "falha ao remover", removidos: removidos.length }, { status: 500 });
    }
    removidos.push(...nomes);
    if (nomes.length < 1000) break;
  }

  if (removidos.length > 0) console.log(`[limpar-fotos-orfas] ${removidos.length} arquivo(s) órfão(s) removido(s)`);
  return Response.json({ dry_run: dryRun, horas, removidos: removidos.length });
});
