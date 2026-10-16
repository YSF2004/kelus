import type { CourseMaterial } from "@/domain/types";
import { cacheLocalPdf, getMaterialsSnapshot, mergeMaterialMetadata, readLocalPdf, removeMaterial } from "./material-store";
import { getSupabaseBrowserClient } from "./supabase-client";

const BUCKET = "kelus-course-materials";
const QUEUE_KEY = "kelus-material-sync-queue-v2";
const pathFor = (userId: string, materialId: string) => `${userId}/${materialId}.pdf`;
const materialWrites = new Map<string, Promise<void>>();

function serializeMaterialWrite(userId: string, materialId: string, action: () => Promise<void>) {
  const key = `${userId}:${materialId}`;
  const previous = materialWrites.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  materialWrites.set(key, current);
  void current.finally(() => { if (materialWrites.get(key) === current) materialWrites.delete(key); }).catch(() => undefined);
  return current;
}

type MaterialRow = {
  user_id: string;
  id: string;
  course_id: string;
  kind: CourseMaterial["kind"];
  storage: CourseMaterial["storage"];
  title: string;
  source_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  role: CourseMaterial["role"];
  processing_status: CourseMaterial["processingStatus"];
  added_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SyncOperation = { type: "upsert" | "upload" | "delete"; userId: string; materialId: string; material?: CourseMaterial };

type Reconciliation = {
  materials: CourseMaterial[];
  removeLocalIds: string[];
  pushLocal: CourseMaterial[];
};

function materialTimestamp(material: CourseMaterial) {
  return Date.parse(material.updatedAt ?? material.addedAt);
}

function toRow(userId: string, material: CourseMaterial): MaterialRow {
  return {
    user_id: userId,
    id: material.id,
    course_id: material.courseId,
    kind: material.kind,
    storage: material.storage,
    title: material.title,
    source_url: material.sourceUrl,
    file_name: material.fileName,
    mime_type: material.mimeType,
    size_bytes: material.sizeBytes,
    role: material.role,
    processing_status: material.processingStatus,
    added_at: material.addedAt,
    updated_at: material.updatedAt ?? material.addedAt,
    deleted_at: null,
  };
}

function fromRow(row: MaterialRow): CourseMaterial {
  return {
    id: row.id,
    courseId: row.course_id,
    kind: row.kind,
    storage: row.storage,
    title: row.title,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    role: row.role,
    processingStatus: row.processing_status,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

function readQueue(): SyncOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as SyncOperation[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: SyncOperation[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(operation: SyncOperation) {
  const queue = readQueue().filter((item) => !(item.userId === operation.userId && item.materialId === operation.materialId));
  if (operation.type !== "delete" && readQueue().some((item) => item.userId === operation.userId && item.materialId === operation.materialId && item.type === "delete")) return;
  writeQueue([...queue, operation]);
}

export function pendingMaterialDeletes(userId: string) {
  return new Set(readQueue().filter((item) => item.userId === userId && item.type === "delete").map((item) => item.materialId));
}

export function hasPendingMaterialSync(userId: string) {
  return readQueue().some((item) => item.userId === userId);
}

async function upsertMaterialDirect(userId: string, material: CourseMaterial) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Cloud sync is unavailable.");
  const { error } = await client.from("course_materials").upsert(toRow(userId, material), { onConflict: "user_id,id" });
  if (error) throw error;
}

function upsertMaterial(userId: string, material: CourseMaterial) {
  return serializeMaterialWrite(userId, material.id, async () => {
    if (pendingMaterialDeletes(userId).has(material.id)) return;
    await upsertMaterialDirect(userId, material);
  });
}

async function markDeletedDirect(userId: string, materialId: string, material?: CourseMaterial) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Cloud sync is unavailable.");
  const now = new Date().toISOString();
  const { error } = material
    ? await client.from("course_materials").upsert({ ...toRow(userId, material), deleted_at: now, updated_at: now }, { onConflict: "user_id,id" })
    : await client.from("course_materials").update({ deleted_at: now, updated_at: now }).eq("user_id", userId).eq("id", materialId);
  if (error) throw error;
  const { error: storageError } = await client.storage.from(BUCKET).remove([pathFor(userId, materialId)]);
  if (storageError) throw storageError;
}

function markDeleted(userId: string, materialId: string, material?: CourseMaterial) {
  return serializeMaterialWrite(userId, materialId, () => markDeletedDirect(userId, materialId, material));
}

async function uploadPdf(userId: string, material: CourseMaterial, file: Blob) {
  await serializeMaterialWrite(userId, material.id, async () => {
    if (pendingMaterialDeletes(userId).has(material.id)) return;
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error("Cloud sync is unavailable.");
    await upsertMaterialDirect(userId, material);
    const { error } = await client.storage.from(BUCKET).upload(pathFor(userId, material.id), file, {
      contentType: material.mimeType ?? "application/pdf",
      upsert: true,
    });
    if (error) throw error;
  });
}

export async function readRemoteMaterialState(userId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Cloud sync is unavailable.");
  const { data, error } = await client.from("course_materials").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as MaterialRow[];
}

async function readLegacyMaterialState(userId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return [] as CourseMaterial[];
  const { data, error } = await client.from("material_states").select("materials").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.materials) ? data.materials as CourseMaterial[] : [];
}

export function reconcileMaterialRecords(localMaterials: CourseMaterial[], rows: MaterialRow[]): Reconciliation {
  const local = new Map(localMaterials.map((material) => [material.id, material]));
  const materials: CourseMaterial[] = [];
  const removeLocalIds: string[] = [];
  const pushLocal: CourseMaterial[] = [];

  for (const row of rows) {
    const localMaterial = local.get(row.id);
    if (row.deleted_at) {
      if (localMaterial) removeLocalIds.push(row.id);
      local.delete(row.id);
      continue;
    }
    const remoteMaterial = fromRow(row);
    if (!localMaterial || materialTimestamp(remoteMaterial) > materialTimestamp(localMaterial)) {
      materials.push(remoteMaterial);
    } else if (materialTimestamp(localMaterial) > materialTimestamp(remoteMaterial)) {
      materials.push(localMaterial);
      pushLocal.push(localMaterial);
    } else {
      materials.push(localMaterial);
    }
    local.delete(row.id);
  }

  for (const material of local.values()) {
    materials.push(material);
    pushLocal.push(material);
  }
  return { materials, removeLocalIds, pushLocal };
}

export async function writeRemoteMaterialState(userId: string, materials = getMaterialsSnapshot()) {
  const liveMaterials = materials.filter((material) => !pendingMaterialDeletes(userId).has(material.id));
  const results = await Promise.allSettled(liveMaterials.map((material) => upsertMaterial(userId, material)));
  results.forEach((result, index) => {
    if (result.status === "rejected") enqueue({ type: "upsert", userId, materialId: liveMaterials[index].id, material: liveMaterials[index] });
  });
  if (results.some((result) => result.status === "rejected") || hasPendingMaterialSync(userId)) throw new Error("Some material changes are waiting to sync.");
}

export async function initializeMaterialSync(userId: string) {
  await flushMaterialSyncQueue(userId);
  let rows = (await readRemoteMaterialState(userId)).filter((row) => !pendingMaterialDeletes(userId).has(row.id));
  if (!rows.length) {
    const legacy = await readLegacyMaterialState(userId);
    if (legacy.length) {
      await Promise.all(legacy.map((material) => upsertMaterial(userId, material)));
      rows = await readRemoteMaterialState(userId);
    }
  }
  const deletedSourceIds = rows.filter((row) => row.deleted_at).map((row) => row.id);
  const reconciliation = reconcileMaterialRecords(getMaterialsSnapshot(), rows);
  await Promise.all(reconciliation.removeLocalIds.map((id) => removeMaterial(id)));
  await Promise.all(reconciliation.pushLocal.map(async (material) => {
    if (material.storage !== "local") return upsertMaterial(userId, material);
    const file = await readLocalPdf(material.id);
    if (!file) {
      enqueue({ type: "upload", userId, materialId: material.id, material });
      return;
    }
    try {
      await uploadPdf(userId, material, file);
    } catch {
      enqueue({ type: "upload", userId, materialId: material.id, material });
    }
  }));
  return { materials: mergeMaterialMetadata(reconciliation.materials), deletedSourceIds };
}

export async function uploadMaterialPdf(userId: string, material: CourseMaterial, file: Blob) {
  try {
    await uploadPdf(userId, material, file);
  } catch (error) {
    enqueue({ type: "upload", userId, materialId: material.id, material });
    throw error;
  }
}

export async function readMaterialPdf(materialId: string, userId?: string | null) {
  const local = await readLocalPdf(materialId);
  if (local || !userId) return local;
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(BUCKET).download(pathFor(userId, materialId));
  if (error || !data) return null;
  await cacheLocalPdf(materialId, data);
  return data;
}

export async function removeRemoteMaterial(userId: string, materialId: string, material?: CourseMaterial) {
  const operation: SyncOperation = { type: "delete", userId, materialId, material };
  enqueue(operation);
  try {
    await markDeleted(userId, materialId, material);
    writeQueue(readQueue().filter((item) => !(item.userId === userId && item.materialId === materialId && item.type === "delete")));
  } catch (error) {
    throw error;
  }
}

export async function flushMaterialSyncQueue(userId: string) {
  const pending = readQueue();
  if (!pending.length) return 0;
  let completed = 0;
  for (const operation of pending) {
    if (operation.userId !== userId) {
      continue;
    }
    try {
      if (operation.type === "delete") await markDeleted(userId, operation.materialId, operation.material);
      if (operation.type === "upsert" && operation.material) await upsertMaterial(userId, operation.material);
      if (operation.type === "upload" && operation.material) {
        const file = await readLocalPdf(operation.materialId);
        if (!file) throw new Error("The local PDF is unavailable for retry.");
        await uploadPdf(userId, operation.material, file);
      }
      completed += 1;
      writeQueue(readQueue().filter((item) => !(item.userId === operation.userId && item.materialId === operation.materialId && item.type === operation.type)));
    } catch {
      // Leave the operation durable for the next online/focus retry.
    }
  }
  return completed;
}
