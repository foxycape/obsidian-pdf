type InuseModel = { platformId: string; model: string }
type InuseModelListener = (model: InuseModel) => void

const listeners = new Set<InuseModelListener>()

export const onInuseModelChange = (listener: InuseModelListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const emitInuseModelChange = (model: InuseModel): void => {
  for (const listener of listeners) {
    listener(model)
  }
}
