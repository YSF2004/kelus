import assert from "node:assert/strict";
import test from "node:test";
import { hasPendingMaterialSync, pendingMaterialDeletes, reconcileMaterialRecords, removeRemoteMaterial } from "../lib/material-sync.ts";

const material = {
  id: "lecture-1", courseId: "course-1", kind: "pdf", storage: "local", title: "Lecture 1",
  sourceUrl: null, fileName: "lecture.pdf", mimeType: "application/pdf", sizeBytes: 200,
  role: "notes", processingStatus: "ready", addedAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z",
};

function row(overrides = {}) {
  return {
    user_id: "user-a", id: material.id, course_id: material.courseId, kind: material.kind,
    storage: material.storage, title: material.title, source_url: null, file_name: material.fileName,
    mime_type: material.mimeType, size_bytes: material.sizeBytes, role: material.role,
    processing_status: material.processingStatus, added_at: material.addedAt,
    updated_at: material.updatedAt, deleted_at: null, ...overrides,
  };
}

test("a remote tombstone removes a stale local source even when its clock is ahead", () => {
  const futureLocal = { ...material, updatedAt: "2030-01-01T00:00:00.000Z" };
  const result = reconcileMaterialRecords([futureLocal], [row({ deleted_at: "2026-10-11T00:00:00.000Z" })]);
  assert.deepEqual(result.materials, []);
  assert.deepEqual(result.removeLocalIds, [material.id]);
  assert.deepEqual(result.pushLocal, []);
});

test("a failed deletion remains queued per account for reconnect and blocks resurrection", async () => {
  const values = new Map();
  const before = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } };
  try {
    await assert.rejects(removeRemoteMaterial("user-a", material.id, material), /Cloud sync is unavailable/);
    assert.equal(hasPendingMaterialSync("user-a"), true);
    assert.equal(hasPendingMaterialSync("user-b"), false);
    assert.deepEqual([...pendingMaterialDeletes("user-a")], [material.id]);
    await assert.rejects(removeRemoteMaterial("user-a", material.id, material), /Cloud sync is unavailable/);
    assert.equal(JSON.parse([...values.values()][0]).length, 1, "repeated deletes coalesce");
  } finally {
    globalThis.window = before;
  }
});

test("a full browser store never makes a deletion throw for the wrong reason, and the delete is what is kept", async () => {
  const values = new Map();
  const before = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    // Only a short queue fits: anything carrying more than the deletes overflows, as a full store would.
    setItem: (key, value) => { if (value.length > 600) throw new Error("QuotaExceededError"); values.set(key, value); },
  } };
  try {
    await assert.rejects(removeRemoteMaterial("user-a", material.id, { ...material, title: "x".repeat(800) }), /Cloud sync is unavailable/);
    assert.deepEqual([...pendingMaterialDeletes("user-a")], []);
    await assert.rejects(removeRemoteMaterial("user-a", "lecture-2"), /Cloud sync is unavailable/);
    assert.deepEqual([...pendingMaterialDeletes("user-a")], ["lecture-2"]);
  } finally {
    globalThis.window = before;
  }
});
