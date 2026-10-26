import { requestUrl } from 'obsidian'
import { computeMd5 } from '@/crypto/MD5'
import { digestStream } from '@/crypto/hash'
import type { IApiClient } from '@/network'
import { requireApiData, readStringField } from './apiResult'
import { buildMultipartBody } from './multipartBody'

type PolicyFields = {
  fileUrl: string
  fileCdnUrl: string
  requireUpload: boolean
  accessId: string
  policy: string
  signature: string
  dir: string
  key: string
  host: string
  expire: string
  callback: string
  variables: Record<string, string>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const joinUrl = (host: string, path: string): string => {
  const base = host.endsWith('/') ? host.slice(0, -1) : host
  const rest = path.startsWith('/') ? path.slice(1) : path
  return `${base}/${rest}`
}

const readPolicy = (data: Record<string, unknown>): PolicyFields => {
  const variables: Record<string, string> = {}
  if (isRecord(data.variables)) {
    for (const [key, value] of Object.entries(data.variables)) {
      if (typeof value === 'string') {
        variables[key] = value
      }
    }
  }
  return {
    fileUrl: readStringField(data, 'fileUrl'),
    fileCdnUrl: readStringField(data, 'fileCdnUrl'),
    requireUpload: data.requireUpload === true,
    accessId: readStringField(data, 'accessid', 'accessId'),
    policy: readStringField(data, 'policy'),
    signature: readStringField(data, 'signature'),
    dir: readStringField(data, 'dir'),
    key: readStringField(data, 'key'),
    host: readStringField(data, 'host'),
    expire: data.expire == null ? '' : String(data.expire),
    callback: readStringField(data, 'callback'),
    variables,
  }
}

const preferredUrl = (policy: PolicyFields, key: string): string => {
  if (policy.fileUrl) {
    return policy.fileUrl
  }
  if (policy.fileCdnUrl) {
    return policy.fileCdnUrl
  }
  if (policy.host && key) {
    return joinUrl(policy.host, key)
  }
  throw new Error('Upload succeeded but no file URL returned')
}

const uploadToHost = async (
  policy: PolicyFields,
  blob: Blob,
  fileName: string,
): Promise<void> => {
  if (!policy.host || !policy.accessId || !policy.policy || !policy.signature) {
    throw new Error('Upload policy is incomplete')
  }
  const key = policy.key || `${policy.dir}${crypto.randomUUID()}.png`
  const fields: Record<string, string> = {
    OSSAccessKeyId: policy.accessId,
    policy: policy.policy,
    signature: policy.signature,
    key,
    expire: policy.expire,
    callback: policy.callback,
    ...policy.variables,
  }
  const boundary = `----foxycape${crypto.randomUUID().replace(/-/g, '')}`
  const body = await buildMultipartBody(fields, { fieldName: 'file', fileName, blob }, boundary)
  const response = await requestUrl({
    url: policy.host,
    method: 'POST',
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
    throw: false,
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed (${response.status})`)
  }
  const payload: unknown = response.json
  if (!isRecord(payload)) {
    return
  }
  const status = readStringField(payload, 'status', 'Status').toLowerCase()
  if (status && status !== 'ok') {
    throw new Error('Upload to storage failed')
  }
}

/**
 * Upload a cropped PNG via `/reader/oss/getpolicy` and return a URL the OCR API can fetch.
 * A cached object skips the second request.
 */
export const uploadOcrImage = async (
  apiClient: IApiClient,
  blob: Blob,
  fileName: string,
  accessToken: string,
): Promise<string> => {
  const [md5, sha1] = await Promise.all([
    computeMd5(blob),
    digestStream(blob, 'SHA-1'),
  ])
  const raw = await apiClient.post('/reader/oss/getpolicy', {
    fileName,
    fileToken: md5,
    clientResourceId: sha1,
    fileType: 'ocr',
    localId: '',
    X_Public_AccessToken: accessToken,
  })
  const policy = readPolicy(requireApiData(raw))
  const key = policy.key || `${policy.dir}${crypto.randomUUID()}.png`
  if (!policy.requireUpload && (policy.fileUrl || policy.fileCdnUrl)) {
    return preferredUrl(policy, key)
  }
  await uploadToHost({ ...policy, key }, blob, fileName)
  return preferredUrl(policy, key)
}
