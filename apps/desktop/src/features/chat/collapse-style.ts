/**
 * 统一的折叠展开动画样式(CSS grid 0fr↔1fr 过渡)。
 *
 * 为什么用 grid 而不是 maxHeight:
 *  - maxHeight 需要实测内容高度,lazy/流式内容高度为 0 会卡住或不准;
 *  - grid-template-rows: 1fr 随内容自动增长,流式更新时不会被夹住。
 *
 * 关键点:
 *  - 子项必须 overflow:hidden + minHeight:0,否则 grid 子项默认 min-height:auto
 *    会阻止 0fr 行收缩到 0,导致收不起/看不出动画。
 *  - 不加 opacity 过渡:整块重绘开销大,嵌套折叠时叠加卡顿。只保留高度过渡。
 *  - will-change 提示浏览器提升为独立图层,GPU 合成。
 *
 * 用法:
 *   <div style={collapseStyle(open)}>
 *     <div style={collapseInnerStyle}>...内容...</div>
 *   </div>
 */
export function collapseStyle(open: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateRows: open ? "1fr" : "0fr",
    transition: "grid-template-rows 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
    willChange: "grid-template-rows",
  };
}

export const collapseInnerStyle: React.CSSProperties = {
  overflow: "hidden",
  minHeight: 0,
};
