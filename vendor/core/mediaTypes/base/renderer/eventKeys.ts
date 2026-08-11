import { EventNames } from "../../../kernal";

export const getEventKeyMap = (includeSelectionChange = true) => {
    const eventKeyMap = new Map<keyof HTMLElementEventMap, string>();
    if (includeSelectionChange) {
        eventKeyMap.set("selectionchange", EventNames.DocumentSelectionChange);
    }
    eventKeyMap.set("dblclick", EventNames.DocumentDblClick);
    eventKeyMap.set("click", EventNames.DocumentClick);
    eventKeyMap.set("pointerdown", EventNames.Pointerdown);
    eventKeyMap.set("pointermove", EventNames.Pointermove);
    eventKeyMap.set("pointerup", EventNames.Pointerup);
    eventKeyMap.set("pointercancel", EventNames.Pointercancel);
    eventKeyMap.set("touchend", EventNames.DocumentTouchEnd);
    eventKeyMap.set("touchstart", EventNames.DocumentTouchStart);
    eventKeyMap.set("touchcancel", EventNames.DocumentTouchCancel);
    eventKeyMap.set("touchmove", EventNames.DocumentTouchMove);
    eventKeyMap.set("mousedown", EventNames.DocumentMouseDown);
    eventKeyMap.set("mousemove", EventNames.DocumentMouseMove);
    eventKeyMap.set("mouseenter", EventNames.DocumentMouseEnter);
    eventKeyMap.set("mouseleave", EventNames.DocumentMouseLeave);
    eventKeyMap.set("mouseup", EventNames.DocumentMouseUp);
    eventKeyMap.set("mouseover", EventNames.DocumentMouseOver);
    eventKeyMap.set("mouseout", EventNames.DocumentMouseOut);
    eventKeyMap.set("keydown", EventNames.DocumentKeyDown);
    eventKeyMap.set("blur", EventNames.DocumentBlur);
    eventKeyMap.set("focus", EventNames.DocumentFocus);
    return eventKeyMap;
};
