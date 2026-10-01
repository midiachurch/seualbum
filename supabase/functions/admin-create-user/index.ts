import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Cria uma conta real (auth.users + profiles, via o trigger handle_new_user
 * já existente) para um novo membro de equipe ou cliente. Só pode ser
 * chamada por um usuário já autenticado com papel admin/gestor — por isso
 * revalida o papel do chamador aqui dentro, mesmo com verify_jwt=true na
 * borda (isso só garante "é alguém logado", não "é admin").
 *
 * SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY são injetadas
 * automaticamente no runtime de Edge Functions — nunca precisam ser
 * configuradas manualmente aqui.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomTempPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return "SeuAlbum-" + btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
}

type Body = {
  kind: "equipe" | "cliente";
  email: string;
  nomeCompleto: string;
  role?: "admin" | "gestor" | "operador" | "designer"; // só para kind: 'equipe'
  telefone?: string;
  // 'cliente': se informado, a conta nova é ligada a este registro de CRM já existente.
  linkClienteId?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), { status: 401, headers: CORS_HEADERS });
    }

    const { data: callerProfile } = await anonClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    const body = (await req.json()) as Body;
    const callerRole = callerProfile?.role;

    const podeEquipe = callerRole === "admin";
    const podeCliente = callerRole === "admin" || callerRole === "gestor";
    if (body.kind === "equipe" && !podeEquipe) {
      return new Response(JSON.stringify({ error: "Só o admin cria contas de equipe." }), { status: 403, headers: CORS_HEADERS });
    }
    if (body.kind === "cliente" && !podeCliente) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar contas de cliente." }), { status: 403, headers: CORS_HEADERS });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const tempPassword = randomTempPassword();
    const PAPEIS_EQUIPE = ["admin", "gestor", "operador", "designer"];
    if (body.kind === "equipe" && body.role && !PAPEIS_EQUIPE.includes(body.role)) {
      return new Response(JSON.stringify({ error: "Papel de equipe inválido." }), { status: 400, headers: CORS_HEADERS });
    }
    const role = body.kind === "equipe" ? (body.role ?? "operador") : "cliente";

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
      // O papel vai em app_metadata: só a service role escreve ali, e é a
      // única fonte que `handle_new_user` aceita para papéis de equipe
      // (migration 0014). user_metadata o próprio usuário controla no signUp.
      app_metadata: { role },
      user_metadata: { nome_completo: body.nomeCompleto, telefone: body.telefone ?? "" },
    });
    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? "Não foi possível criar o usuário." }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    if (body.kind === "cliente" && body.linkClienteId) {
      await admin.from("clientes").update({ user_id: created.user.id }).eq("id", body.linkClienteId);
    }

    return new Response(JSON.stringify({ userId: created.user.id, tempPassword }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: CORS_HEADERS });
  }
});
