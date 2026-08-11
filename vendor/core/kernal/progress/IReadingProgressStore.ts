import { Progress } from "./Progress"

export interface IReadingProgressStore {
    save(resourceId: string, progress: Progress): Promise<void>
    delete(resourceId: string): Promise<void>
    get(resourceId: string): Promise<Progress | undefined>
}