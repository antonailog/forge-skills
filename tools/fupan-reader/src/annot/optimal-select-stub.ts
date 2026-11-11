// 文本划线不用 CSS 选择器；上游 optimal-select 的包入口不完整。
export const select = () => { throw new Error('optimal-select 未打包') }
export default { select }
