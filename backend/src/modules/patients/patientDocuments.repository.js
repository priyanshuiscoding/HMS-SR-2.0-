import { query } from "../../config/postgres.js";

function toCamelDocument(row, includeData = false) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    documentType: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    notes: row.notes || "",
    uploadedBy: row.uploaded_by || "",
    metadata: row.metadata || {},
    createdAt: row.created_at,
    ...(includeData ? { fileData: row.file_data } : {})
  };
}

export async function findPatientDocuments(patientId) {
  const result = await query(
    `
    SELECT id, patient_id, title, document_type, file_name, mime_type, file_size, notes, uploaded_by, metadata, created_at
    FROM patient_documents
    WHERE patient_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    `,
    [patientId]
  );

  return result.rows.map((row) => toCamelDocument(row));
}

export async function findPatientDocumentById(patientId, documentId) {
  const result = await query(
    `
    SELECT *
    FROM patient_documents
    WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL
    `,
    [documentId, patientId]
  );

  return toCamelDocument(result.rows[0], true);
}

export async function insertPatientDocument(document) {
  const result = await query(
    `
    INSERT INTO patient_documents (
      patient_id, title, document_type, file_name, mime_type, file_size, file_data, notes, uploaded_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING id, patient_id, title, document_type, file_name, mime_type, file_size, notes, uploaded_by, metadata, created_at
    `,
    [
      document.patientId,
      document.title,
      document.documentType,
      document.fileName,
      document.mimeType,
      document.fileSize,
      document.fileData,
      document.notes || "",
      document.uploadedBy || null,
      JSON.stringify(document.metadata || {})
    ]
  );

  return toCamelDocument(result.rows[0]);
}

export async function softDeletePatientDocument(patientId, documentId) {
  const result = await query(
    `
    UPDATE patient_documents
    SET deleted_at = NOW()
    WHERE id = $1 AND patient_id = $2 AND deleted_at IS NULL
    RETURNING id
    `,
    [documentId, patientId]
  );

  return result.rowCount > 0;
}
