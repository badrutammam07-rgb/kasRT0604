import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const db = supabaseAdmin;

// Token session in-memory cache dengan masa berlaku 7 hari
const activeTokens = new Map<string, number>();

export async function createAdminSession(token: string) {
  const expiresAtMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  activeTokens.set(token, expiresAtMs);
  // Coba persist ke DB jika diizinkan RLS
  try {
    await db.from("admin_sessions").insert({
      token,
      expires_at: new Date(expiresAtMs).toISOString(),
    });
  } catch {}
}

export async function deleteAdminSession(token: string) {
  activeTokens.delete(token);
  try {
    await db.from("admin_sessions").delete().eq("token", token);
  } catch {}
}

export async function requireAdmin(token: string | null | undefined) {
  if (!token) throw new Error("Sesi pusat tidak valid. Silakan login kembali.");

  // 1. Cek memory session
  const exp = activeTokens.get(token);
  if (exp) {
    if (exp > Date.now()) return true;
    activeTokens.delete(token);
    throw new Error("Sesi pusat sudah kedaluwarsa. Silakan login kembali.");
  }

  // 2. Cek database session
  try {
    const { data, error } = await db
      .from("admin_sessions")
      .select("token, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!error && data) {
      if (new Date(data.expires_at).getTime() >= Date.now()) {
        activeTokens.set(token, new Date(data.expires_at).getTime());
        return true;
      } else {
        await db.from("admin_sessions").delete().eq("token", token);
        throw new Error("Sesi pusat sudah kedaluwarsa. Silakan login kembali.");
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes("kedaluwarsa")) throw err;
  }

  throw new Error("Sesi pusat tidak valid. Silakan login kembali.");
}

export async function writeLog(entry: {
  entity: string;
  entity_label?: string | null;
  action: string;
  description: string;
  old_value?: string | null;
  new_value?: string | null;
}) {
  await db.from("change_logs").insert({
    entity: entry.entity,
    entity_label: entry.entity_label ?? null,
    action: entry.action,
    description: entry.description,
    old_value: entry.old_value ?? null,
    new_value: entry.new_value ?? null,
  });
}

export function rp(n: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));
}

export function newToken() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

export const DEFAULT_ADMIN_PASSWORD = "123456";
export const FORGOT_PASSWORD_CODE = "gh1gh415";

// In-memory runtime cache for server process
let runtimeAdminPassword = DEFAULT_ADMIN_PASSWORD;

export async function getAdminPassword(): Promise<string> {
  // 1. Cek admin_settings di DB
  try {
    const { data, error } = await db
      .from("admin_settings")
      .select("password")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data?.password) {
      runtimeAdminPassword = data.password;
      return data.password;
    }
  } catch {}

  // 2. Cek apakah ada di metadata config database
  try {
    const { data: cfg } = await db
      .from("app_config")
      .select("opening_note")
      .eq("id", 1)
      .maybeSingle();
    const note = cfg?.opening_note || "";
    if (note.includes("__ADMIN_PW:")) {
      const match = note.match(/__ADMIN_PW:([^\s_]+)/);
      if (match && match[1]) {
        runtimeAdminPassword = match[1];
        return runtimeAdminPassword;
      }
    }
  } catch {}

  return runtimeAdminPassword || DEFAULT_ADMIN_PASSWORD;
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  runtimeAdminPassword = newPassword;

  // 1. Coba update admin_settings
  try {
    await db.from("admin_settings").upsert({
      id: 1,
      password: newPassword,
      reset_code: FORGOT_PASSWORD_CODE,
      default_password: DEFAULT_ADMIN_PASSWORD,
      updated_at: new Date().toISOString(),
    });
  } catch {}

  // 2. Persist ke app_config opening_note (selalu dizinkan update)
  try {
    const { data: cfg } = await db
      .from("app_config")
      .select("opening_note")
      .eq("id", 1)
      .maybeSingle();
    let currentNote = cfg?.opening_note || "";
    currentNote = currentNote.replace(/__ADMIN_PW:[^\s_]+/g, "").trim();
    const updatedNote = `${currentNote} __ADMIN_PW:${newPassword}`.trim();
    await db
      .from("app_config")
      .update({ opening_note: updatedNote, updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch {}
}

export async function resetAdminPasswordToDefault(): Promise<void> {
  await setAdminPassword(DEFAULT_ADMIN_PASSWORD);
}
