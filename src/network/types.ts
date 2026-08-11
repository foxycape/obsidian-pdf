/**
 * 执行结果对象
 */
export class Result<T> {
  /**
   * 执行是否成功
   */
  success: boolean

  /**
   * 执行结果代号
   */
  code: number

  /**
   * 执行结果描述
   */
  description: string

  data: T
}

/**
 * 简单分页对象
 * @template T 数据项类型
 */
export class SimpleDataList<T> {
  /**
   * 记录数量
   */
  recordCount: number

  /**
   * 总页数
   */
  totalPage: number

  /**
   * 记录集合
   */
  itemList: T[]
}
