
export class EventNames {
    static readonly ReaderDisposed = "readerDisposed";
    static readonly ReaderCleared = "readerCleared";
    static readonly RendererLoad = "rendererLoad";

    static readonly ImageElementsVisible = "imageElementsVisible";
    static readonly RendererContainerSizeChange = "rendererContainerSizeChange";

    static readonly CtrlWithCKeyCopy = "ctrlWithCKeyCopy";

    static readonly UserChangedProgress = "userChangedProgress";

    /**start loading resource */
    static readonly StartLoadResource = "startLoadResource";
    /**resource loaded */
    static readonly ResourceLoad = "resourceLoad";
    /**resource unloaded */
    static readonly ResourceUnload = "resourceUnload";

    static readonly ProgressChange = "progressChange";
    static readonly LayoutChange = "layoutChange";
    static readonly ThemeChange = "themeChange";
    static readonly OptionsChange = "optionsChange";
    static readonly PageChange = "pageChange";
    static readonly PdfPageTextRendered = "pageTextRendered";
    static readonly PdfPageRender = "pagerender";
    static readonly PdfPageRendered = "pagerendered";
    static readonly PdfPagesInit = "pdfPagesInit";
    static readonly PdfScaleChanging = "scalechanging";

    static readonly PdfPagesLoaded = "pdfPagesLoaded";
    static readonly PdfUpdateViewArea = "updateviewarea";

    /**single document loaded */
    static readonly DocumentLoad = "documentLoad";
    /**single document disposing */
    static readonly DocumentDisposing = "documentDisposing";
    /**single document visible change */
    static readonly DocumentVisibleChange = "documentVisibleChange";
    /**single document loaded failed */
    static readonly DocumentLoadFailed = "documentLoadFailed";
    /**document size change */
    static readonly DocumentSizeChange = "documentSizeChange";

    /**click image */
    static readonly ImageClicked = "imageClicked";

    /**original scroll */
    static readonly ReaderOriginalScroll = "readerOriginalScroll";
    /**debounce scroll */
    static readonly ReaderDebounceScroll = "ReaderDebounceScroll";

    //below are reader document events
    static readonly ReaderClick = "readerClick";
    static readonly ReaderMouseEnter = "readerMouseEnter";

    //below are independent document events
    static readonly DocumentSelectionChange = "documentSelectionChange";
    static readonly DocumentDblClick = "documentDblClick";
    static readonly DocumentClick = "documentClick";
    static readonly DocumentTouchStart = "documentTouchStart";
    static readonly DocumentTouchEnd = "documentTouchEnd";
    static readonly DocumentTouchMove = "documentTouchMove";
    static readonly DocumentTouchCancel = "documentTouchCancel";
    static readonly DocumentMouseDown = "documentMouseDown";
    static readonly DocumentMouseEnter = "documentMouseEnter";
    static readonly DocumentMouseLeave = "documentMouseLeave";
    static readonly DocumentMouseMove = "documentMouseMove";
    static readonly DocumentMouseUp = "documentMouseUp";
    static readonly DocumentMouseOver = "documentMouseOver";
    static readonly DocumentMouseOut = "documentMouseOut";
    static readonly DocumentBlur = "documentBlur";
    static readonly DocumentFocus = "documentFocus";
    static readonly DocumentKeyDown = "documentKeyDown";
    static readonly Pointerdown = "pointerdown";
    static readonly Pointermove = "pointermove";
    static readonly Pointerup = "pointerup";
    static readonly Pointercancel = "pointercancel";
    static readonly RequirePdfPassword = "requirePdfPassword";

    /** Host should open the integrated PDF find / search UI (e.g. Ctrl/Cmd+F). */
    static readonly RequestOpenFind = "requestOpenFind";

    /**general data change event notification (notification format: dataType-data type, action-operation type, items-data list) */
    static readonly DataChange = "dataChange";

    static readonly ProcessedImageCount = "processedImageCount";
    static readonly PdfLoadFinished = "pdfLoadFinished";

}
