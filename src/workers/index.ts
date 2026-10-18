import GlobalWorkerCtor from './global.worker.ts?worker&inline'
import { GlobalWorker } from './GlobalWorker'

export { GlobalWorker } from './GlobalWorker'
export type { DocumentHasher } from './DocumentHasher'
export type { ComputeIdsResult, HashJob, IGlobalWorker } from './IGlobalWorker'

export const createGlobalWorker = () => new GlobalWorker(new GlobalWorkerCtor())
