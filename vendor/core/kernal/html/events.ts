/**
 * Watch element scroll.
 */
export const watchScroll = (
    watchElement: Document | Element,
    calcScrollDirection: boolean,
    callback: (state: { right: boolean, down: boolean, lastX: number, lastY: number, _eventHandler: any }, e: Event) => void,
    immediateCallback?: (e) => void
) => {

    const debounceScroll = function (evt: Event) {
        if (immediateCallback) {
            immediateCallback(evt);
        }
        if (calcScrollDirection) {
            if (raf) {
                return;
            }

            raf = window.requestAnimationFrame(() => {
                raf = null;
                let currentX = 0;
                let currentY = 0;
                if (watchElement instanceof Document) {
                    currentX = watchElement.documentElement.scrollLeft;
                    currentY = watchElement.documentElement.scrollTop;
                } else {
                    currentX = watchElement.scrollLeft;
                    currentY = watchElement.scrollTop;
                }

                const lastX = state.lastX;
                if (currentX !== lastX) {
                    state.right = currentX > lastX;
                }
                state.lastX = currentX;
                const lastY = state.lastY;
                if (currentY !== lastY) {
                    state.down = currentY > lastY;
                }
                state.lastY = currentY;
                callback(state, evt);
            });
        }
    };

    let currentX = 0;
    let currentY = 0;
    if (calcScrollDirection) {
        if (watchElement instanceof Document) {
            currentX = watchElement.documentElement.scrollLeft;
            currentY = watchElement.documentElement.scrollTop;
        } else {
            currentX = watchElement.scrollLeft;
            currentY = watchElement.scrollTop;
        }
    }

    const state = {
        right: true,
        down: true,
        lastX: currentX,
        lastY: currentY,
        _eventHandler: debounceScroll,
    };

    let raf = null;

    watchElement.addEventListener("scroll", debounceScroll, true);
    return state;
};

const removeIframeEvents = (ownerDocument: Document) => {
    const iframes = ownerDocument.getElementsByTagName('iframe');
    for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes.item(i)
        iframe.style.setProperty('pointer-events', 'none', 'important');
        if (iframe.contentDocument?.getElementsByTagName('iframe').length > 0) {
            removeIframeEvents(iframe.contentDocument)
        }
    }
};

const recoverIframeEvents = (ownerDocument: Document) => {
    const iframes = ownerDocument.getElementsByTagName('iframe');
    for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes.item(i)
        iframe.style.removeProperty('pointer-events');
        if (iframe.contentDocument?.getElementsByTagName('iframe').length > 0) {
            recoverIframeEvents(iframe.contentDocument)
        }
    }
};

/**
 * Disable default drag events.
 */
export const disableDefaultDragEvents = (ownerDocument: Document) => {
    ownerDocument.addEventListener("dragenter", (e) => {
        e.preventDefault();
        removeIframeEvents(document);
    }, true)
    ownerDocument.addEventListener("drop", (e) => {
        e.preventDefault();
    }, true)
    ownerDocument.addEventListener("dragover", (e) => {
        e.preventDefault();
        removeIframeEvents(document);
    }, true)
    ownerDocument.addEventListener("dragleave", (e) => {
        e.preventDefault();
        recoverIframeEvents(document);
    }, true)
    ownerDocument.addEventListener("dragend", (e) => {
        e.preventDefault();
        recoverIframeEvents(document);
    }, true)
};

/**
 * Listen for drag events.
 */
export const startCaptureDragEvents = (
    dragZone: HTMLElement,
    allowDragCallback: (e: DragEvent) => boolean,
    dropCallback: (files: FileList, e: DragEvent) => void,
    dragenterCallback?: (e: DragEvent) => void,
    dragleaveCallback?: (e: DragEvent) => void
) => {
    let enterElement = null
    dragZone.addEventListener("dragenter", (e) => {
        const allowDrag = allowDragCallback(e);
        if (!allowDrag) {
            return;
        }
        enterElement = e.target;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (dragenterCallback) {
            dragenterCallback(e);
        }
    });
    dragZone.addEventListener("dragover", (e) => {
        const allowDrag = allowDragCallback(e);
        if (!allowDrag) {
            return;
        }
        e.dataTransfer.dropEffect = 'copy';
        e.preventDefault();
        e.stopImmediatePropagation();
    });
    dragZone.addEventListener("dragleave", (e) => {
        const allowDrag = allowDragCallback(e);
        if (!allowDrag) {
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (dragleaveCallback) {
            if (e.target == enterElement) {
                dragleaveCallback(e);
            }
        }
    });
    dragZone.addEventListener("drop", (e) => {
        const allowDrag = allowDragCallback(e);
        if (!allowDrag) {
            return;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        recoverIframeEvents(document);
        dropCallback(e.dataTransfer.files, e)
    })
};
