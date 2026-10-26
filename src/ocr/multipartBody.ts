const encoder = new TextEncoder()

const readBlobBytes = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer())
  }
  return new Uint8Array(await new Response(blob).arrayBuffer())
}

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

/** Multipart body with the file part last, which OSS post policy requires. */
export const buildMultipartBody = async (
  fields: Record<string, string>,
  file: { fieldName: string; fileName: string; blob: Blob },
  boundary: string,
): Promise<ArrayBuffer> => {
  const chunks: Uint8Array[] = []
  const push = (value: string) => {
    chunks.push(encoder.encode(value))
  }
  for (const [name, value] of Object.entries(fields)) {
    push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    )
  }
  const fileName = file.fileName.replace(/"/g, '')
  push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`,
  )
  chunks.push(await readBlobBytes(file.blob))
  push(`\r\n--${boundary}--\r\n`)
  const bytes = concatBytes(chunks)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
