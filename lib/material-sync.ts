import type { CourseMaterial } from "../domain/types";
import { getSupabaseBrowserClient } from "./supabase-client";
import {
  getMaterialsSnapshot,
  mergeRemoteMaterials,
  readLocalPdf,
  updateMaterialSync,
} from "./material-store";

const BUCKET = "course-materials";

type RemoteMaterialRow = {
  material_id: string;
  course_id: string;
  kind: CourseMaterial["kind"];
  title: string;
  source_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  role: CourseMaterial["role"];
  processing_status: CourseMaterial["processingStatus"];
  storage_path: string | null;
  added_at: string;
};

function fromRow(row: RemoteMaterialRow): CourseMaterial {
  return {
    id: row.material_id,
    courseId: row.course_id,
    kind: row.kind,
    storage: row.source_url ? "url" : "local",
    title: row.title,
    sourceUrl: row.source_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    role: row.role,
    processingStatus: row.processing_status,
    remotePath: row.storage_path,
    syncStatus: "synced",
    addedAt: row.added_at,
  };
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "material.pdf";
}

export async function saveRemoteMaterial(userId: string, material: CourseMaterial, file?: Blob) {
  const client = getSupabaseBrowserClient();
  if (!client) return material;
  updateMaterialSync(material.id, { remotePath: material.remotePath ?? null, syncStatus: "syncing" });
  try {
    let remotePath = material.remotePath ?? null;
    if (material.storage === "local") {
      const blob = file ?? await readLocalPdf(material.id);
      if (!blob) throw new Error("The local PDF is unavailable, so it could not be synced.");
      remotePath = `${userId}/${material.id}/${safeFileName(material.fileName ?? "material.pdf")}`;
      const { error: uploadError } = await client.storage.from(BUCKET).upload(remotePath, blob, {
        contentType: material.mimeType ?? "application/pdf",
        upsert: true,
      });
      if (uploadError) throw uploadError;
    }
    const { error } = await client.from("course_materials").upsert({
      user_id: userId,
      material_id: material.id,
      course_id: material.courseId,
      kind: material.kind,
      title: material.title,
      source_url: material.sourceUrl,
      file_name: material.fileName,
      mime_type: material.mimeType,
      size_bytes: material.sizeBytes,
      role: material.role,
      processing_status: material.processingStatus,
      storage_path: remotePath,
      added_at: material.addedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,material_id" });
    if (error) throw error;
    updateMaterialSync(material.id, { remotePath, syncStatus: "synced" });
    return { ...material, remotePath, syncStatus: "synced" as const };
  } catch (error) {
    updateMaterialSync(material.id, { remotePath: material.remotePath ?? null, syncStatus: "failed" });
    throw error;
  }
}

export async function readRemotePdf(remotePath: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(BUCKET).download(remotePath);
  if (error) return null;
  return data;
}

export async function readMaterialPdf(material: CourseMaterial) {
  const local = await readLocalPdf(material.id).catch(() => null);
  if (local) return local;
  return material.remotePath ? readRemotePdf(material.remotePath) : null;
}

export async function removeRemoteMaterial(userId: string, material: CourseMaterial) {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  if (material.remotePath) await client.storage.from(BUCKET).remove([material.remotePath]);
  const { error } = await client.from("course_materials").delete().eq("user_id", userId).eq("material_id", material.id);
  if (error) throw error;
}

export async function synchronizeCourseMaterials(userId: string, courseId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return;
  const { data, error } = await client.from("course_materials").select("material_id, course_id, kind, title, source_url, file_name, mime_type, size_bytes, role, processing_status, storage_path, added_at").eq("user_id", userId).eq("course_id", courseId);
  if (error) throw error;
  const remote = ((data ?? []) as RemoteMaterialRow[]).map(fromRow);
  const remoteIds = new Set(remote.map((item) => item.id));
  mergeRemoteMaterials(remote);
  const pending = getMaterialsSnapshot().filter((item) => item.courseId === courseId && !remoteIds.has(item.id));
  const results = await Promise.allSettled(pending.map((item) => saveRemoteMaterial(userId, item)));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) throw new Error(`${failed} material${failed === 1 ? "" : "s"} could not sync.`);
}
