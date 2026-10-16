import { getIntrinsicSize } from "./source-resolution.js";

let fallbackId = 0;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackId += 1;
  return `source-${Date.now()}-${fallbackId}`;
}

export function createSourceRecord(asset, type, sourceVersion, options = {}) {
  const { width, height } = getIntrinsicSize(asset);
  const metadata = Object.freeze({
    sourceId: (options.idFactory ?? createId)(),
    sourceVersion,
    type,
    width,
    height,
    createdAt: (options.now ?? (() => new Date().toISOString()))(),
    status: "ready"
  });
  return Object.freeze({ ...metadata, asset });
}

const releasedSources = new WeakSet();

export function releaseSource(record) {
  if (!record || releasedSources.has(record)) return false;
  releasedSources.add(record);
  record.asset?.close?.();
  return true;
}

export function getSourceMetadata(record) {
  const { sourceId, sourceVersion, type, width, height, createdAt, status } = record;
  return { sourceId, sourceVersion, type, width, height, createdAt, status };
}
