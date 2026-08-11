import type { IDocumentsProvider } from "../../../../kernal";
import { IPdfDocument } from "../IPdfDocument";
import { IPdfDestinationBuilder } from "./IPdfDestinationBuilder";

export class PdfDestinationBuilder implements IPdfDestinationBuilder {
    constructor(
        private readonly documentsProvider: IDocumentsProvider<IPdfDocument>
    ) {
    }

    buildDest(pageNumber: number, options?: "current" | { x: number; y: number }): string {
        let x: number;
        let y: number;
        const doc = this.documentsProvider.getDocument((pageNumber - 1).toString());
        if (options == "current") {
            const page = doc?.getContentContainer();
            if (!page) {
                return null;
            }
            const pageRect = page.getBoundingClientRect();
            x = pageRect.left;
            if (x >= 0) {
                x = 0;
            }
            if (x < 0) {
                x = Math.abs(x);
            }
            y = pageRect.top;
            if (y >= 0) {
                y = 0;
            }
            if (y < 0) {
                y = Math.abs(y);
            }
        } else {
            x = options.x;
            y = options.y;
        }

       const geometry = doc.getPageGeometry();
        const width = geometry.displayWidth;
        const height = geometry.displayHeight;
        const ref = geometry.ref;
        const originWidth = geometry.rawWidth;
        const scale = width / originWidth;
        const destX = x / scale;
        const destY = (height - y) / scale;
        return (
            '[{"num":' +
            ref.num +
            ',"gen":' +
            ref.gen +
            '},{"name":"XYZ"},' +
            destX +
            "," +
            destY +
            ",0]"
        );
    }
}
