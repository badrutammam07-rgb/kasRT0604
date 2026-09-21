import { createServerFn } from "@tanstack/react-start";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const { newToken, getAdminPassword, createAdminSession } = await import("./admin.server");
    const currentPassword = await getAdminPassword();
    if (data.password !== currentPassword) {
      return { ok: false as const, message: "Password salah." };
    }
    const token = newToken();
    await createAdminSession(token);
    return { ok: true as const, token };
  });

export const adminCheck = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin.server");
    try {
      await requireAdmin(data.token);
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const adminLogout = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { deleteAdminSession } = await import("./admin.server");
    await deleteAdminSession(data.token);
    return { ok: true as const };
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; oldPassword: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin, writeLog, getAdminPassword, setAdminPassword } = await import("./admin.server");
    await requireAdmin(data.token);
    const currentPassword = await getAdminPassword();
    if (data.oldPassword !== currentPassword) {
      return { ok: false as const, message: "Password lama salah." };
    }
    if (!data.newPassword || data.newPassword.trim().length < 4) {
      return { ok: false as const, message: "Password baru minimal 4 karakter." };
    }
    await setAdminPassword(data.newPassword.trim());
    await writeLog({
      entity: "pengaturan",
      entity_label: "Halaman Pusat",
      action: "ubah",
      description: "Password halaman pusat berhasil diperbarui.",
    });
    return { ok: true as const };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const { writeLog, resetAdminPasswordToDefault, FORGOT_PASSWORD_CODE } = await import("./admin.server");
    const inputCode = (data.code || "").trim();
    if (inputCode !== FORGOT_PASSWORD_CODE) {
      return { ok: false as const, message: "Kode forgot password salah." };
    }
    await resetAdminPasswordToDefault();
    await writeLog({
      entity: "pengaturan",
      entity_label: "Halaman Pusat",
      action: "reset",
      description: "Password halaman pusat berhasil direset ke standar (123456) menggunakan kode pemulihan.",
    });
    return { ok: true as const };
  });

/* ---------------- Warga ---------------- */

export const saveResident = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      id?: string | null;
      name: string;
      address?: string | null;
      active?: boolean;
      start_year?: number | null;
      start_month?: number | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const name = data.name.trim();
    if (!name) return { ok: false as const, message: "Nama warga wajib diisi." };
    if (name.length > 100) return { ok: false as const, message: "Nama terlalu panjang." };

    if (data.id) {
      const { data: old } = await db
        .from("residents")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();
      const patch = {
        name,
        address: data.address ?? null,
        active: data.active ?? true,
        ...(data.start_year ? { start_year: data.start_year } : {}),
        ...(data.start_month ? { start_month: data.start_month } : {}),
      };
      const { error } = await db.from("residents").update(patch).eq("id", data.id);

      if (error) throw new Error(error.message);
      await db.from("contributions").update({ resident_name: name }).eq("resident_id", data.id);
      if (old && old.name !== name) {
        await writeLog({
          entity: "warga",
          entity_label: name,
          action: "ubah",
          description: `Nama warga diubah dari "${old.name}" menjadi "${name}".`,
          old_value: old.name,
          new_value: name,
        });
      } else {
        await writeLog({
          entity: "warga",
          entity_label: name,
          action: "ubah",
          description: `Data warga "${name}" diperbarui.`,
        });
      }
      return { ok: true as const };
    }

    const startYear = Math.max(2026, new Date().getFullYear());
    const sYear = data.start_year ?? startYear;
    const sMonth = Math.min(12, Math.max(1, data.start_month ?? 1));
    const BULAN_ID = [
      "Januari","Februari","Maret","April","Mei","Juni",
      "Juli","Agustus","September","Oktober","November","Desember",
    ];
    const { error } = await db.from("residents").insert({
      name,
      address: data.address ?? null,
      active: true,
      start_year: sYear,
      start_month: sMonth,
    });
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "warga",
      entity_label: name,
      action: "tambah",
      description: `Warga baru "${name}" didaftarkan (iuran dihitung mulai ${BULAN_ID[sMonth - 1]} ${sYear}).`,
    });
    return { ok: true as const };
  });

export const deleteResident = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("residents")
      .select("name")
      .eq("id", data.id)
      .maybeSingle();

    // Data warga TIDAK DIHAPUS, hanya dinonaktifkan (active: false)
    // Semua riwayat setoran, nama, dan histori tetap utuh 100%
    const { error } = await db.from("residents").update({ active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "warga",
      entity_label: old?.name ?? "-",
      action: "ubah",
      description: `Warga "${old?.name ?? "-"}" dinonaktifkan (pindah / arsip). Data dan histori setoran tetap tersimpan 100% utuh.`,
    });
    return { ok: true as const };
  });

/* ---------------- Setoran ---------------- */

export const listContributionsAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: rows, error } = await db
      .from("contributions")
      .select("*")
      .order("sent_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setContributionStatus = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; id: string; status: "pending" | "approved" | "rejected"; admin_note?: string | null }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog, rp } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("contributions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!old) return { ok: false as const, message: "Data tidak ditemukan." };
    const { error } = await db
      .from("contributions")
      .update({ status: data.status, admin_note: data.admin_note ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const label: Record<string, string> = {
      approved: "dikonfirmasi (LUNAS)",
      rejected: "ditolak",
      pending: "dikembalikan ke proses",
    };
    await writeLog({
      entity: "setoran",
      entity_label: old.resident_name,
      action: "status",
      description:
        `Setoran ${old.resident_name} periode ${old.period_month}/${old.period_year} ${label[data.status]} oleh pusat` +
        (data.status === "approved" ? ` (${rp(old.amount)} masuk ke kas).` : ".") +
        (data.admin_note ? ` Keterangan: ${data.admin_note}` : ""),
      old_value: old.status,
      new_value: data.status,
    });
    return { ok: true as const };
  });

export const updateContribution = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      id: string;
      sent_date: string;
      period_month: number;
      period_year: number;
      resident_id: string | null;
      resident_name: string;
      method: string;
      purpose: string;
      amount: number;
      note: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog, rp } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("contributions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!old) return { ok: false as const, message: "Data tidak ditemukan." };

    const { error } = await db
      .from("contributions")
      .update({
        sent_date: data.sent_date,
        period_month: data.period_month,
        period_year: data.period_year,
        resident_id: data.resident_id,
        resident_name: data.resident_name,
        method: data.method,
        purpose: data.purpose,
        amount: data.amount,
        note: data.note,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const perubahan: string[] = [];
    if (Number(old.amount) !== Number(data.amount)) {
      perubahan.push(`nominal ${rp(old.amount)} → ${rp(data.amount)}`);
    }
    if (old.resident_name !== data.resident_name)
      perubahan.push(`nama ${old.resident_name} → ${data.resident_name}`);
    if (old.period_month !== data.period_month || old.period_year !== data.period_year)
      perubahan.push(
        `periode ${old.period_month}/${old.period_year} → ${data.period_month}/${data.period_year}`,
      );
    if (old.method !== data.method) perubahan.push(`metode ${old.method} → ${data.method}`);
    if (old.purpose !== data.purpose) perubahan.push(`tujuan ${old.purpose} → ${data.purpose}`);
    if (old.sent_date !== data.sent_date)
      perubahan.push(`tanggal ${old.sent_date} → ${data.sent_date}`);
    if ((old.note ?? "") !== (data.note ?? ""))
      perubahan.push(`catatan "${old.note ?? "-"}" → "${data.note ?? "-"}"`);

    await writeLog({
      entity: "setoran",
      entity_label: data.resident_name,
      action: "ubah",
      description:
        perubahan.length > 0
          ? `Pusat memperbarui setoran ${data.resident_name}: ${perubahan.join("; ")}.`
          : `Pusat menyimpan ulang setoran ${data.resident_name} tanpa perubahan nilai.`,
      old_value: Number(old.amount) !== Number(data.amount) ? rp(old.amount) : null,
      new_value: Number(old.amount) !== Number(data.amount) ? rp(data.amount) : null,
    });
    return { ok: true as const };
  });

export const deleteContribution = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("contributions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await db.from("contributions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "setoran",
      entity_label: old?.resident_name ?? "-",
      action: "hapus",
      description: `Pusat menghapus setoran ${old?.resident_name ?? "-"} periode ${old?.period_month}/${old?.period_year}.`,
    });
    return { ok: true as const };
  });

/* ---------------- Pengeluaran ---------------- */

export const saveExpense = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token: string;
      id?: string | null;
      spend_date: string;
      purpose: string;
      amount: number;
      note?: string | null;
      is_kasbon?: boolean;
      kasbon_resident_id?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog, rp } = await import("./admin.server");
    await requireAdmin(data.token);
    const isKasbon = data.is_kasbon === true;
    let kasbonId: string | null = null;
    let kasbonName: string | null = null;
    if (isKasbon) {
      if (!data.kasbon_resident_id)
        return { ok: false as const, message: "Pilih nama warga penerima kasbon." };
      const { data: r } = await db
        .from("residents")
        .select("id,name")
        .eq("id", data.kasbon_resident_id)
        .maybeSingle();
      if (!r) return { ok: false as const, message: "Warga tidak ditemukan." };
      kasbonId = r.id;
      kasbonName = r.name;
    }
    const purpose = isKasbon ? `Kasbon ${kasbonName}` : data.purpose.trim();
    if (!purpose) return { ok: false as const, message: "Tujuan penggunaan wajib diisi." };
    if (data.amount < 0) return { ok: false as const, message: "Nominal tidak valid." };

    if (data.id) {
      const { data: old } = await db.from("expenses").select("*").eq("id", data.id).maybeSingle();
      const { error } = await db
        .from("expenses")
        .update({
          spend_date: data.spend_date,
          purpose,
          amount: data.amount,
          note: data.note ?? null,
          is_kasbon: isKasbon,
          kasbon_resident_id: kasbonId,
          kasbon_resident_name: kasbonName,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      const changes: string[] = [];
      if (old && Number(old.amount) !== Number(data.amount))
        changes.push(`nominal ${rp(old.amount)} → ${rp(data.amount)}`);
      if (old && old.purpose !== purpose) changes.push(`tujuan "${old.purpose}" → "${purpose}"`);
      if (old && old.spend_date !== data.spend_date)
        changes.push(`tanggal ${old.spend_date} → ${data.spend_date}`);
      await writeLog({
        entity: "pengeluaran",
        entity_label: purpose,
        action: "ubah",
        description:
          changes.length > 0
            ? `Pusat memperbarui penggunaan kas: ${changes.join("; ")}.`
            : `Pusat menyimpan ulang penggunaan kas "${purpose}".`,
        old_value: old ? rp(old.amount) : null,
        new_value: rp(data.amount),
      });
      return { ok: true as const };
    }

    const { error } = await db.from("expenses").insert({
      spend_date: data.spend_date,
      purpose,
      amount: data.amount,
      note: data.note ?? null,
      is_kasbon: isKasbon,
      kasbon_resident_id: kasbonId,
      kasbon_resident_name: kasbonName,
    });
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "pengeluaran",
      entity_label: purpose,
      action: "tambah",
      description: isKasbon
        ? `Kasbon untuk ${kasbonName} sebesar ${rp(data.amount)} pada ${data.spend_date}.`
        : `Penggunaan kas baru: "${purpose}" sebesar ${rp(data.amount)} pada ${data.spend_date}.`,
      new_value: rp(data.amount),
    });
    return { ok: true as const };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog, rp } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db.from("expenses").select("*").eq("id", data.id).maybeSingle();
    const { error } = await db.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "pengeluaran",
      entity_label: old?.purpose ?? "-",
      action: "hapus",
      description: `Pusat menghapus penggunaan kas "${old?.purpose ?? "-"}" (${rp(old?.amount)}).`,
    });
    return { ok: true as const };
  });

/* ---------------- Tunggakan ---------------- */

export const addWaiver = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; resident_id: string; period_month: number; period_year: number; reason?: string | null }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: r } = await db
      .from("residents")
      .select("name")
      .eq("id", data.resident_id)
      .maybeSingle();
    const { error } = await db.from("waivers").upsert(
      {
        resident_id: data.resident_id,
        period_month: data.period_month,
        period_year: data.period_year,
        reason: data.reason ?? null,
      },
      { onConflict: "resident_id,period_month,period_year" },
    );
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "tunggakan",
      entity_label: r?.name ?? "-",
      action: "hapus",
      description: `Tunggakan ${r?.name ?? "-"} periode ${data.period_month}/${data.period_year} dihapus pusat dan dianggap sudah membayar.${data.reason ? ` Alasan: ${data.reason}` : ""}`,
    });
    return { ok: true as const };
  });

export const deleteWaiver = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db.from("waivers").select("*").eq("id", data.id).maybeSingle();
    let name = "-";
    if (old) {
      const { data: r } = await db
        .from("residents")
        .select("name")
        .eq("id", old.resident_id)
        .maybeSingle();
      name = r?.name ?? "-";
    }
    const { error } = await db.from("waivers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "tunggakan",
      entity_label: name,
      action: "ubah",
      description: `Pembebasan tunggakan ${name} periode ${old?.period_month}/${old?.period_year} dibatalkan, kembali dianggap belum bayar.`,
    });
    return { ok: true as const };
  });

/* ---------------- Saldo awal ---------------- */

export const setOpeningBalance = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; amount: number; note?: string | null }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog, rp } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db
      .from("app_config")
      .select("opening_balance")
      .eq("id", 1)
      .maybeSingle();
    const { error } = await db
      .from("app_config")
      .update({
        opening_balance: data.amount,
        opening_note: data.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "saldo awal",
      entity_label: "Kas awal",
      action: "ubah",
      description: `Saldo kas awal diperbarui dari ${rp(old?.opening_balance)} menjadi ${rp(data.amount)}.`,
      old_value: rp(old?.opening_balance),
      new_value: rp(data.amount),
    });
    return { ok: true as const };
  });

/* ---------------- Export ---------------- */

export const exportYear = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; year: number }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin } = await import("./admin.server");
    await requireAdmin(data.token);
    const from = `${data.year}-01-01`;
    const to = `${data.year}-12-31`;

    // Ambil setoran berdasarkan period_year ATAU sent_date di tahun tersebut
    const { data: masukPeriod } = await db
      .from("contributions")
      .select("*")
      .eq("period_year", data.year)
      .order("sent_date");

    const { data: masukDate } = await db
      .from("contributions")
      .select("*")
      .gte("sent_date", from)
      .lte("sent_date", to)
      .order("sent_date");

    // Gabungkan tanpa duplikat
    const masukMap = new Map<string, any>();
    (masukPeriod ?? []).forEach((m: any) => masukMap.set(m.id, m));
    (masukDate ?? []).forEach((m: any) => masukMap.set(m.id, m));
    const masuk = Array.from(masukMap.values()).sort((a, b) => 
      (a.sent_date || "").localeCompare(b.sent_date || "")
    );

    const { data: keluar } = await db
      .from("expenses")
      .select("*")
      .gte("spend_date", from)
      .lte("spend_date", to)
      .order("spend_date");

    const { data: residents } = await db
      .from("residents")
      .select("*")
      .order("name");

    const { data: appConfig } = await db
      .from("app_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    return {
      masuk: masuk ?? [],
      keluar: keluar ?? [],
      residents: residents ?? [],
      opening_balance: Number(appConfig?.opening_balance ?? 0),
    };
  });

/* ---------------- Berita ---------------- */

export const saveNews = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { token: string; id?: string | null; title: string; body: string; pinned?: boolean }) => d,
  )
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title) return { ok: false as const, message: "Judul berita wajib diisi." };
    if (!body) return { ok: false as const, message: "Isi berita wajib diisi." };

    if (data.id) {
      const { data: old } = await db.from("news").select("*").eq("id", data.id).maybeSingle();
      const { error } = await db
        .from("news")
        .update({ title, body, pinned: data.pinned ?? false })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await writeLog({
        entity: "berita",
        entity_label: title,
        action: "ubah",
        description: `Pusat memperbarui berita "${old?.title ?? title}".`,
        old_value: old?.body ?? null,
        new_value: body,
      });
      return { ok: true as const };
    }

    const { error } = await db.from("news").insert({ title, body, pinned: data.pinned ?? false });
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "berita",
      entity_label: title,
      action: "tambah",
      description: `Pusat menerbitkan berita baru: "${title}".`,
      new_value: body,
    });
    return { ok: true as const };
  });

export const deleteNews = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; id: string }) => d)
  .handler(async ({ data }) => {
    const { db, requireAdmin, writeLog } = await import("./admin.server");
    await requireAdmin(data.token);
    const { data: old } = await db.from("news").select("*").eq("id", data.id).maybeSingle();
    const { error } = await db.from("news").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeLog({
      entity: "berita",
      entity_label: old?.title ?? "-",
      action: "hapus",
      description: `Pusat menghapus berita "${old?.title ?? "-"}".`,
    });
    return { ok: true as const };
  });
