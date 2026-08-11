/** Whether a PDF selection spans multiple pages (walk up DOM to `.page[data-page-number]`). */
export const checkIsCrossPage = (target: Range): boolean => {
    let startContentContainer = target.startContainer.parentElement;
    while (
        startContentContainer &&
        !startContentContainer.classList?.contains("page") &&
        startContentContainer.tagName != "BODY"
    ) {
        startContentContainer = startContentContainer.parentElement;
    }

    let endContentContainer = target.endContainer.parentElement;
    while (
        endContentContainer &&
        !endContentContainer.classList?.contains("page") &&
        endContentContainer.tagName != "BODY"
    ) {
        endContentContainer = endContentContainer.parentElement;
    }

    if (!startContentContainer || !endContentContainer) {
        return false;
    }

    const startPageNumber = parseInt(
        startContentContainer.getAttribute("data-page-number") ?? "",
        10,
    );
    const endPageNumber = parseInt(
        endContentContainer.getAttribute("data-page-number") ?? "",
        10,
    );
    if (isNaN(startPageNumber) || isNaN(endPageNumber)) {
        return false;
    }
    if (endPageNumber <= 0 || startPageNumber <= 0) {
        return false;
    }
    return startPageNumber !== endPageNumber;
};
