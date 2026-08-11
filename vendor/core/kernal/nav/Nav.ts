import { computeUniqueId } from "../common/uuid";

export class Nav {
    /**Total symbol count for progress calculation
     * For audio and video, it is the duration, in seconds;
     * For pure text, it is the number of characters;
     * For html, it needs to be customized, for example, whether the audio included is counted as length.
    */
    totalSymbolCount: number = 0;

    /**
     * Allowable free read percentage (decimal)
     */
    allowFreeReadPercentage: number = 0.1;

    /**
     * Collection of directory entries
     */
    navPoints: NavPoint[] = [];
}

export class NavPoint {
    constructor(title?: string, url?: string, startPageNumber?: number, pdfDest?: string) {
        if (title) {
            this.title = title;
        }
        if (url) {
            this.url = url;
        }

        if (startPageNumber) {
            this.startPageNumber = startPageNumber;
        }
        this.key = this.calcKey();
    }

    key: string;

    /**Translated title */
    translatedTitle?: string;

    calcKey() {
        let raw = "";
        if (this.title) {
            raw += this.title + '-';
        }
        if (this.url) {
            raw += this.url + '-';
        }
        if (this.startPageNumber) {
            raw += this.startPageNumber + '-';
        }
        if (this.pdfDest) {
            raw += this.pdfDest + '-';
        }
        return computeUniqueId(raw);
    }

    /**
     * Title
     */
    readonly title: string = "";

    /**
     * Jump address (if the url is reset, the calcKey method must be called to recalculate the key)
     */
    url: string | null = null;

    /**
     * Total number of pages in the current directory node (layout file)
     */
    numberOfPages: number = 0;

    /**
     * Start page number (layout file)
     */
    startPageNumber: number = 0;

    /**Total symbol count for progress calculation
     * For audio and video, it is the duration, in seconds;
     * For pure text, it is the number of characters;
     * For html, it needs to be customized, for example, whether the audio included is counted as length.
    */
    symbolCount: number = 0;

    /**
     * Whether to enable readable permissions for the user
     */
    enable: boolean = true;

    /**PDF internal jump parameter */
    readonly pdfDest?: string;

    /**Content start percentage */
    startPercentage?: number;
    /**Content end percentage */
    endPercentage?: number;

    /**Associated text */
    text?: string;

    /**
     * Subdirectories contained in the current directory
     */
    readonly children: NavPoint[] = [];
}
