import { PdfOptions } from "../../PdfOptions";
import { MultiPDFViewer } from "../MultiPdfViewer";
import type { IPdfScalable } from "./IPdfScalable";

export class PdfScalable implements IPdfScalable {
    private readonly DEFAULT_SCALE_VALUE = "auto";
    private readonly PRESET_SCALE_VALUES = new Set([
        "auto",
        "page-actual",
        "page-fit",
        "page-width",
        "page-height",
    ]);

    constructor(
        private readonly pdfViewer: MultiPDFViewer,
        private readonly options: PdfOptions,
    ) {
    }

    get currentScaleValue(): string {
        return this.formatScaleValue(this.pdfViewer?.currentScaleValue);
    }

    get currentScale(): number {
        return this.pdfViewer.currentScale;
    }

    async scaleTo(value: string): Promise<void> {
        this.pdfViewer.currentScaleValue = value;
        await this.persistScaleValue();
    }

    async zoomIn(steps?: number, scaleFactor?: number): Promise<void> {
        if (this.pdfViewer.isInPresentationMode) {
            return;
        }
        this.pdfViewer.increaseScale({
            drawingDelay: 400,
            steps,
            scaleFactor,
        });
        await this.persistScaleValue();
    }

    async zoomOut(steps?: number, scaleFactor?: number): Promise<void> {
        if (this.pdfViewer.isInPresentationMode) {
            return;
        }
        this.pdfViewer.decreaseScale({
            drawingDelay: 400,
            steps,
            scaleFactor,
        });
        await this.persistScaleValue();
    }

    async zoomReset(): Promise<void> {
        if (this.pdfViewer.isInPresentationMode) {
            return;
        }
        await this.scaleTo(this.DEFAULT_SCALE_VALUE);
    }

    /**
     * Normalize viewer scale strings to the public API form ("75%", "auto", ...).
     * After zoomIn/zoomOut, pdf.js stores numeric multipliers like "1.1".
     */
    private formatScaleValue = (value: string | undefined | null): string => {
        if (!value) {
            return value as string;
        }
        if (this.PRESET_SCALE_VALUES.has(value) || value.endsWith("%")) {
            return value;
        }
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return `${Math.round(numeric * 100)}%`;
        }
        return value;
    };

    private persistScaleValue = async () => {
        const value = this.currentScaleValue;
        if (!value) {
            return;
        }
        this.options.scaleValue = value;
    };
}
