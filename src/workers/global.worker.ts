import { handleWorkerMessage } from './workerMessageHandler'

type WorkerScope = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  addEventListener: (type: 'message', listener: (e: MessageEvent) => void) => void
}

const workerSelf = self as unknown as WorkerScope

workerSelf.addEventListener('message', (event) => {
  void handleWorkerMessage(event.data as Record<string, unknown>)
})
