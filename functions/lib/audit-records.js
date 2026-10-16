export function auditStatements(database, { id, owner, payload, idempotencyKey, now, expiresAt }) {
  const statements = [database.prepare(`INSERT INTO audits
    (id, owner_id, room_name, expected_configuration_json, confirmed_counts_json, detector_versions_json,
     sound_summary_json, anomaly_summary_json, threshold, report_schema_version, app_version, version,
     idempotency_key, created_at, updated_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`)
    .bind(id, owner, payload.roomName || null, JSON.stringify(payload.expectedConfiguration), JSON.stringify(payload.confirmedCounts),
      JSON.stringify(payload.models), JSON.stringify(payload.soundEvents), JSON.stringify(payload.anomalies), payload.threshold,
      payload.reportSchemaVersion, payload.appVersion, idempotencyKey, now, now, expiresAt)];
  Object.entries(payload.confirmedCounts).forEach(([category, quantity]) => {
    if (Number.isInteger(quantity)) statements.push(database.prepare(`INSERT INTO audit_items
      (id, audit_id, owner_id, category, quantity, evidence_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, owner, category, quantity, "confirmed", now));
  });
  Object.entries(payload.imageQuality).forEach(([metric, value]) => statements.push(database.prepare(`INSERT INTO audit_measurements
    (id, audit_id, owner_id, metric, value_text, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), id, owner, metric, String(value), now)));
  [...payload.manualAnnotations, ...payload.contextualEvidence].forEach((item) => statements.push(database.prepare(`INSERT INTO audit_confirmations
    (id, audit_id, owner_id, label, evidence_type, status, geometry_json, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), id, owner, item.label, item.evidenceType, item.status,
      item.polygon || item.box ? JSON.stringify(item.polygon ?? item.box) : null, item.explanation ?? "", now)));
  return statements;
}

export function parseAudit(record, items = [], measurements = [], confirmations = []) {
  return {
    id: record.id,
    roomName: record.room_name,
    expectedConfiguration: JSON.parse(record.expected_configuration_json),
    confirmedCounts: JSON.parse(record.confirmed_counts_json),
    models: JSON.parse(record.detector_versions_json),
    soundEvents: JSON.parse(record.sound_summary_json),
    anomalies: JSON.parse(record.anomaly_summary_json),
    threshold: record.threshold,
    reportSchemaVersion: record.report_schema_version,
    appVersion: record.app_version,
    version: record.version,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    expiresAt: record.expires_at,
    items: items.map((item) => ({ category: item.category, quantity: item.quantity, evidenceType: item.evidence_type })),
    imageQuality: Object.fromEntries(measurements.map((item) => [item.metric, item.value_text])),
    confirmations: confirmations.map((item) => ({ label: item.label, evidenceType: item.evidence_type, status: item.status,
      geometry: item.geometry_json ? JSON.parse(item.geometry_json) : null, explanation: item.explanation }))
  };
}
