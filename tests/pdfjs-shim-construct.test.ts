import { describe, expect, it } from 'vitest'
import { pdfjsBindRuntime } from '../vite.pdfjs-shim'

type Constructable = new (...args: never[]) => object

const bindFrom = (lib: Record<string, Constructable>) => {
  const read = () => lib
  return new Function('read', `${pdfjsBindRuntime}\nreturn bind`)(read) as (
    name: string,
  ) => Constructable
}

describe('pdf.js export proxy', () => {
  it('keeps the subclass prototype when the constructor calls its own method', () => {
    class Parent {
      readonly label: string
      readonly constructedAs: new (...args: never[]) => object

      constructor(label: string) {
        this.label = label
        this.constructedAs = new.target
      }

      parentOnly() {
        return 'parent'
      }
    }

    const ParentProxy = bindFrom({ Parent })('Parent')

    class Child extends ParentProxy {
      bound = false

      constructor(label: string) {
        super(label)
        this.bindEvents()
      }

      bindEvents() {
        this.bound = true
      }

      parentOnly() {
        return `${super.parentOnly()}-child`
      }
    }

    const child = new Child('page')

    expect(child.bound).toBe(true)
    expect(child.label).toBe('page')
    expect(child).toBeInstanceOf(Child)
    expect(child).toBeInstanceOf(Parent)
    expect(Object.getPrototypeOf(child)).toBe(Child.prototype)
    expect(child.constructedAs).toBe(Child)
    expect(child.parentOnly()).toBe('parent-child')
  })

  it('constructs the real class when the proxy is called directly', () => {
    class Parent {
      readonly constructedAs: new (...args: never[]) => object

      constructor() {
        this.constructedAs = new.target
      }
    }

    const ParentProxy = bindFrom({ Parent })('Parent')
    const direct = new ParentProxy()

    expect(direct).toBeInstanceOf(Parent)
    expect(Object.getPrototypeOf(direct)).toBe(Parent.prototype)
    expect(direct.constructedAs).toBe(Parent)
  })
})
