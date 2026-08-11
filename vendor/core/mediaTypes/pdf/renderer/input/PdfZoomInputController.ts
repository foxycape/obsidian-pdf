import * as pdfjsLib from "../../../../pdfjs/legacy/build/pdf.mjs";
import { MultiPDFViewer } from "../MultiPdfViewer";

export class PdfZoomInputController {
    private readonly WHEEL_ZOOM_DISABLED_TIMEOUT = 1000;
    private zoomDisabledTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Distinguish physical Ctrl key vs trackpad pinch (wheel + ctrlKey without keydown). */
    private isCtrlKeyDown = false;

    private _wheelUnusedTicks = 0;
    private _wheelUnusedFactor = 1;

    private _touchInfo: {
        touch0X: number;
        touch0Y: number;
        touch1X: number;
        touch1Y: number;
    } | null = null;
    private _touchUnusedTicks = 0;
    private _touchUnusedFactor = 1;

    private readonly falsePassiveOpts: AddEventListenerOptions & EventListenerOptions = { passive: false };

    constructor(
        private readonly pdfViewer: MultiPDFViewer,
        private readonly container: HTMLDivElement,
    ) {
    }

    bind() {
        this.container.addEventListener("visibilitychange", this.webViewerVisibilityChange);
        this.container.addEventListener("wheel", this.webViewerWheel, this.falsePassiveOpts);
        this.container.addEventListener("touchstart", this.webViewerTouchStart, this.falsePassiveOpts);
        this.container.addEventListener("touchmove", this.webViewerTouchMove, this.falsePassiveOpts);
        this.container.addEventListener("touchend", this.webViewerTouchEnd, this.falsePassiveOpts);
        this.container.addEventListener("keydown", this.onKeyDown);
        this.container.addEventListener("keyup", this.onKeyUp);
    }

    unbind() {
        this.container.removeEventListener("visibilitychange", this.webViewerVisibilityChange);
        this.container.removeEventListener("wheel", this.webViewerWheel, this.falsePassiveOpts);
        this.container.removeEventListener("touchstart", this.webViewerTouchStart, this.falsePassiveOpts);
        this.container.removeEventListener("touchmove", this.webViewerTouchMove, this.falsePassiveOpts);
        this.container.removeEventListener("touchend", this.webViewerTouchEnd, this.falsePassiveOpts);
        this.container.removeEventListener("keydown", this.onKeyDown);
        this.container.removeEventListener("keyup", this.onKeyUp);

        if (this.zoomDisabledTimeout) {
            clearTimeout(this.zoomDisabledTimeout);
            this.zoomDisabledTimeout = null;
        }
        this.isCtrlKeyDown = false;
    }

    private onKeyDown = (evt: KeyboardEvent) => {
        if (evt.key === "Control") {
            this.isCtrlKeyDown = true;
        }
    };

    private onKeyUp = (evt: KeyboardEvent) => {
        if (evt.key === "Control") {
            this.isCtrlKeyDown = false;
        }
    };

    get supportsPinchToZoom() {
        return pdfjsLib.shadow(this, "supportsPinchToZoom", true);
    }

    get supportedMouseWheelZoomModifierKeys() {
        return pdfjsLib.shadow(this, "supportedMouseWheelZoomModifierKeys", {
            ctrlKey: true,
            metaKey: true,
        });
    }

    private setZoomDisabledTimeout = () => {
        if (this.zoomDisabledTimeout) {
            clearTimeout(this.zoomDisabledTimeout);
        }
        this.zoomDisabledTimeout = setTimeout(() => {
            this.zoomDisabledTimeout = null;
        }, this.WHEEL_ZOOM_DISABLED_TIMEOUT);
    };

    private webViewerVisibilityChange = () => {
        if (document.visibilityState === "visible") {
            this.setZoomDisabledTimeout();
        }
    };

    private webViewerWheel = (evt: WheelEvent) => {
        if (this.pdfViewer.isInPresentationMode) {
            return;
        }

        const deltaMode = evt.deltaMode;
        let scaleFactor = Math.exp(-evt.deltaY / 100);

        const isBuiltInMac = pdfjsLib.FeatureTest.platform.isMac;
        const isPinchToZoom =
            evt.ctrlKey &&
            !this.isCtrlKeyDown &&
            deltaMode === WheelEvent.DOM_DELTA_PIXEL &&
            evt.deltaX === 0 &&
            (Math.abs(scaleFactor - 1) < 0.05 || isBuiltInMac) &&
            evt.deltaZ === 0;

        if (
            isPinchToZoom ||
            (evt.ctrlKey && this.supportedMouseWheelZoomModifierKeys.ctrlKey) ||
            (evt.metaKey && this.supportedMouseWheelZoomModifierKeys.metaKey)
        ) {
            evt.preventDefault();
            if (this.zoomDisabledTimeout || document.visibilityState === "hidden") {
                return;
            }

            const previousScale = this.pdfViewer.currentScale;
            if (isPinchToZoom && this.supportsPinchToZoom) {
                scaleFactor = this._accumulateFactor(previousScale, scaleFactor, "_wheelUnusedFactor");
                if (scaleFactor < 1) {
                    this.pdfViewer.decreaseScale({ drawingDelay: 400, scaleFactor });
                } else if (scaleFactor > 1) {
                    this.pdfViewer.increaseScale({ drawingDelay: 400, scaleFactor });
                } else {
                    return;
                }
            } else {
                const delta = this.normalizeWheelEventDirection(evt);
                let ticks = 0;
                if (deltaMode === WheelEvent.DOM_DELTA_LINE || deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                    if (Math.abs(delta) >= 1) {
                        ticks = Math.sign(delta);
                    } else {
                        ticks = this._accumulateTicks(delta, "_wheelUnusedTicks");
                    }
                } else {
                    const PIXELS_PER_LINE_SCALE = 100;
                    ticks = this._accumulateTicks(delta / PIXELS_PER_LINE_SCALE, "_wheelUnusedTicks");
                }

                if (ticks < 0) {
                    this.pdfViewer.decreaseScale({ drawingDelay: 400, steps: -ticks });
                } else if (ticks > 0) {
                    this.pdfViewer.increaseScale({ drawingDelay: 400, steps: ticks });
                } else {
                    return;
                }
            }

            this._centerAtPos(previousScale, evt.clientX, evt.clientY);
        } else {
            this.setZoomDisabledTimeout();
        }
    };

    private webViewerTouchStart = (evt: TouchEvent) => {
        if (this.pdfViewer.isInPresentationMode || evt.touches.length < 2) {
            return;
        }
        evt.preventDefault();

        if (evt.touches.length !== 2) {
            this._touchInfo = null;
            return;
        }

        let [touch0, touch1] = [evt.touches[0], evt.touches[1]];
        if (touch0.identifier > touch1.identifier) {
            [touch0, touch1] = [touch1, touch0];
        }
        this._touchInfo = {
            touch0X: touch0.pageX,
            touch0Y: touch0.pageY,
            touch1X: touch1.pageX,
            touch1Y: touch1.pageY,
        };
    };

    private webViewerTouchMove = (evt: TouchEvent) => {
        if (!this._touchInfo || evt.touches.length !== 2) {
            return;
        }
        let [touch0, touch1] = [evt.touches[0], evt.touches[1]];
        if (touch0.identifier > touch1.identifier) {
            [touch0, touch1] = [touch1, touch0];
        }
        const { pageX: page0X, pageY: page0Y } = touch0;
        const { pageX: page1X, pageY: page1Y } = touch1;
        const {
            touch0X: pTouch0X,
            touch0Y: pTouch0Y,
            touch1X: pTouch1X,
            touch1Y: pTouch1Y,
        } = this._touchInfo;

        if (
            Math.abs(pTouch0X - page0X) <= 1 &&
            Math.abs(pTouch0Y - page0Y) <= 1 &&
            Math.abs(pTouch1X - page1X) <= 1 &&
            Math.abs(pTouch1Y - page1Y) <= 1
        ) {
            return;
        }

        this._touchInfo.touch0X = page0X;
        this._touchInfo.touch0Y = page0Y;
        this._touchInfo.touch1X = page1X;
        this._touchInfo.touch1Y = page1Y;

        if (pTouch0X === page0X && pTouch0Y === page0Y) {
            const v1X = pTouch1X - page0X;
            const v1Y = pTouch1Y - page0Y;
            const v2X = page1X - page0X;
            const v2Y = page1Y - page0Y;
            const det = v1X * v2Y - v1Y * v2X;
            if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
                return;
            }
        } else if (pTouch1X === page1X && pTouch1Y === page1Y) {
            const v1X = pTouch0X - page1X;
            const v1Y = pTouch0Y - page1Y;
            const v2X = page0X - page1X;
            const v2Y = page0Y - page1Y;
            const det = v1X * v2Y - v1Y * v2X;
            if (Math.abs(det) > 0.02 * Math.hypot(v1X, v1Y) * Math.hypot(v2X, v2Y)) {
                return;
            }
        } else {
            const diff0X = page0X - pTouch0X;
            const diff1X = page1X - pTouch1X;
            const diff0Y = page0Y - pTouch0Y;
            const diff1Y = page1Y - pTouch1Y;
            const dotProduct = diff0X * diff1X + diff0Y * diff1Y;
            if (dotProduct >= 0) {
                return;
            }
        }

        evt.preventDefault();

        const distance = Math.hypot(page0X - page1X, page0Y - page1Y) || 1;
        const pDistance = Math.hypot(pTouch0X - pTouch1X, pTouch0Y - pTouch1Y) || 1;
        const previousScale = this.pdfViewer.currentScale;
        if (this.supportsPinchToZoom) {
            const newScaleFactor = this._accumulateFactor(
                previousScale,
                distance / pDistance,
                "_touchUnusedFactor",
            );
            if (newScaleFactor < 1) {
                this.pdfViewer.decreaseScale({ drawingDelay: 400, scaleFactor: newScaleFactor });
            } else if (newScaleFactor > 1) {
                this.pdfViewer.increaseScale({ drawingDelay: 400, scaleFactor: newScaleFactor });
            } else {
                return;
            }
        } else {
            const PIXELS_PER_LINE_SCALE = 30;
            const ticks = this._accumulateTicks(
                (distance - pDistance) / PIXELS_PER_LINE_SCALE,
                "_touchUnusedTicks",
            );
            if (ticks < 0) {
                this.pdfViewer.decreaseScale({ drawingDelay: 400, steps: -ticks });
            } else if (ticks > 0) {
                this.pdfViewer.increaseScale({ drawingDelay: 400, steps: ticks });
            } else {
                return;
            }
        }

        this._centerAtPos(previousScale, (page0X + page1X) / 2, (page0Y + page1Y) / 2);
    };

    private webViewerTouchEnd = (evt: TouchEvent) => {
        if (!this._touchInfo) {
            return;
        }
        evt.preventDefault();
        this._touchInfo = null;
        this._touchUnusedTicks = 0;
        this._touchUnusedFactor = 1;
    };

    private _accumulateTicks = (
        ticks: number,
        prop: "_wheelUnusedTicks" | "_touchUnusedTicks",
    ) => {
        if ((this[prop] > 0 && ticks < 0) || (this[prop] < 0 && ticks > 0)) {
            this[prop] = 0;
        }
        this[prop] += ticks;
        const wholeTicks = Math.trunc(this[prop]);
        this[prop] -= wholeTicks;
        return wholeTicks;
    };

    private _accumulateFactor = (
        previousScale: number,
        factor: number,
        prop: "_wheelUnusedFactor" | "_touchUnusedFactor",
    ) => {
        if (factor === 1) {
            return 1;
        }
        if ((this[prop] > 1 && factor < 1) || (this[prop] < 1 && factor > 1)) {
            this[prop] = 1;
        }

        const newFactor =
            Math.floor(previousScale * factor * this[prop] * 100) / (100 * previousScale);
        this[prop] = factor / newFactor;
        return newFactor;
    };

    private _centerAtPos = (previousScale: number, x: number, y: number) => {
        const scaleDiff = this.pdfViewer.currentScale / previousScale - 1;
        if (scaleDiff !== 0) {
            const [top, left] = this.pdfViewer.containerTopLeft;
            this.pdfViewer.container.scrollLeft += (x - left) * scaleDiff;
            this.pdfViewer.container.scrollTop += (y - top) * scaleDiff;
        }
    };

    private normalizeWheelEventDirection = (evt: WheelEvent) => {
        let delta = Math.hypot(evt.deltaX, evt.deltaY);
        const angle = Math.atan2(evt.deltaY, evt.deltaX);
        if (-0.25 * Math.PI < angle && angle < 0.75 * Math.PI) {
            delta = -delta;
        }
        return delta;
    };
};
