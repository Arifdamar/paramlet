// Drag-to-reorder for a list, used by the panel and the settings page.
// Items are <li> elements with a grip; dragging the grip slides the item and
// makes room for it, and dropping reports the move. Alt+↑ / Alt+↓ on a focused
// element inside an item moves it one place, for keyboard users.
//
// Items can be split into groups (presets of this site vs. all sites); an item
// only moves among the items of its own group. Positions passed to `onMove`
// count items of that group only.

/**
 * @param {HTMLElement} list
 * @param {object} options
 * @param {string} options.grip                  Selector of the drag handle inside an item.
 * @param {(item: HTMLElement) => string} [options.group]
 * @param {() => boolean} [options.enabled]       Checked when a drag starts.
 * @param {(from: number, to: number, group: string) => void} options.onMove
 */
export function makeSortable(list, { grip, group = () => "", enabled = () => true, onMove }) {
  const groupItems = (key) => [...list.children].filter((item) => group(item) === key);

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(grip);
    if (!handle || event.button !== 0 || !enabled()) return;
    event.preventDefault();

    const item = handle.closest("li");
    const key = group(item);
    const items = groupItems(key);
    const from = items.indexOf(item);
    const rects = items.map((element) => element.getBoundingClientRect());
    const height = rects[from].height;
    const startY = event.clientY;
    let to = from;

    handle.setPointerCapture(event.pointerId);
    list.classList.add("sorting");
    item.classList.add("dragging");

    const move = (moveEvent) => {
      // Kept within the group, so an item cannot be dragged off either end.
      const offset = Math.min(
        Math.max(moveEvent.clientY - startY, rects[0].top - rects[from].top),
        rects.at(-1).bottom - rects[from].bottom,
      );
      item.style.transform = `translateY(${offset}px)`;
      const middle = rects[from].top + height / 2 + offset;
      // An item below passes the dragged one once its middle is reached; an
      // item above only once the dragged middle goes past it. This also makes
      // dragging to the very end of the group land on the last place.
      to = rects.filter((rect, index) => {
        const otherMiddle = rect.top + rect.height / 2;
        return index !== from && (index < from ? otherMiddle < middle : otherMiddle <= middle);
      }).length;
      items.forEach((other, index) => {
        if (other === item) return;
        let shift = 0;
        if (from < to && index > from && index <= to) shift = -height;
        if (from > to && index >= to && index < from) shift = height;
        other.style.transform = shift === 0 ? "" : `translateY(${shift}px)`;
      });
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      for (const element of items) element.style.transform = "";
      item.classList.remove("dragging");
      list.classList.remove("sorting");
      if (to !== from) onMove(from, to, key);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end, { once: true });
    handle.addEventListener("pointercancel", () => {
      to = from;
      end();
    }, { once: true });
  });

  list.addEventListener("keydown", (event) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown") || !enabled()) return;
    const item = event.target.closest("li");
    if (!item || item.parentElement !== list) return;
    const key = group(item);
    const items = groupItems(key);
    const from = items.indexOf(item);
    const to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= items.length) return;
    event.preventDefault();
    onMove(from, to, key);
  });
}
