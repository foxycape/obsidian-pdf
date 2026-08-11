import { INavPointNavigator, NavPoint, ICoreNavigator, INavPointProvider, NavPointProgress, ILocale, IDocumentsProvider } from "../../../kernal";
import type { Reader } from "../../../kernal/Reader";
import { IPdfFileParser } from "../fileParser/IPdfFileParser";
import { IPdfDocument } from "./IPdfDocument";


export class PdfNavPointNavigator implements INavPointNavigator {
    private readonly owner: Reader;
    private readonly locale: ILocale
    constructor(public readonly documentsProvider: IDocumentsProvider<IPdfDocument, IPdfFileParser>, public readonly pdfCoreNavigator: ICoreNavigator, public readonly navPointProvider: INavPointProvider) {
        this.owner = documentsProvider.owner;
        this.locale = this.owner.locale;
    }

    async getNavPointProgress(): Promise<NavPointProgress> {
        const flattingNavPoints = await this.navPointProvider.getFlattingNavPoints();
        if (flattingNavPoints.length > 1) {
            const navPoint = await this.navPointProvider.getCurrentNavPoint();
            if (!navPoint) {
                return null;
            }
            const current = flattingNavPoints.findIndex(x => x.key == navPoint.key);
            return { total: flattingNavPoints.length, current: current, type: 'navpoint' }
        }
        else {
            const firstVisibleDocument = this.documentsProvider.getFirstVisibleDocument();
            const documents = this.documentsProvider.getDocuments();
            const current = documents.findIndex(x => x.url == firstVisibleDocument.url);
            return { total: documents.length, current: current, type: 'file' }
        }
    }

    async gotoNavPoint(navPoint: NavPoint): Promise<void> {
        await this.pdfCoreNavigator.gotoUrl(navPoint.url);
    }
    async gotoNextNavPointOrFile(onlyFirstLevel?: boolean): Promise<void> {
        const flattingNavPoints = await this.navPointProvider.getFlattingNavPoints();
        if (flattingNavPoints.length > 1) {
            const navPoint = await this.navPointProvider.getCurrentNavPoint();
            if (!navPoint)
                return;
            const index = flattingNavPoints.findIndex(x => x.key == navPoint.key);
            if (index < 0)
                return;
            const numberOfPages = this.documentsProvider.getDocuments().length;
            if (index == flattingNavPoints.length - 1 || navPoint?.url == numberOfPages.toString()) {
                this.owner.notifier.info(this.locale.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
                return;
            }
            const nextNavPoint = await this.getNextNavPoint(navPoint, index, flattingNavPoints);
            if (nextNavPoint) {
                await this.gotoNavPoint(nextNavPoint);
            }
            else {
                if (index < flattingNavPoints.length - 1) {
                    const lastNavPoint = flattingNavPoints[flattingNavPoints.length - 1]
                    if (lastNavPoint) {
                        await this.gotoNavPoint(lastNavPoint);
                        return;
                    }
                }

                this.owner.notifier.info(this.locale.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
                return;
            }
        }
        else {
            const lastVisibleDocument = this.documentsProvider.getLastVisibleDocument();
            if (!lastVisibleDocument)
                return;
            const proxies = this.documentsProvider.getDocuments();
            const index = proxies.indexOf(lastVisibleDocument);
            if (index == proxies.length - 1) {
                this.owner.notifier.info(this.locale.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
                return;
            }
            await this.pdfCoreNavigator.gotoUrl(proxies[index + 1].url);
        }
    }


    private async getNextNavPoint(navPoint: NavPoint, index: number, flattingNavPoints: NavPoint[]): Promise<NavPoint | undefined> {
        let nextNavPoint = flattingNavPoints[index + 1];
        if (nextNavPoint) {
            const visibleDocument = this.documentsProvider.getFirstVisibleDocument();
            if (visibleDocument && visibleDocument.url == nextNavPoint.url || nextNavPoint.url == navPoint.url) {
                // Target nav point shares the same URL as the current one (same document); keep looking further.
                return await this.getNextNavPoint(nextNavPoint, index + 1, flattingNavPoints);
            }
        }
        return nextNavPoint;
    }
    async gotoPreviousNavPointOrFile(): Promise<void> {
        const flattingNavPoints = await this.navPointProvider.getFlattingNavPoints();
        if (flattingNavPoints.length > 0) {
            const navPoint = await this.navPointProvider.getCurrentNavPoint();
            if (!navPoint)
                return;
            const index = flattingNavPoints.findIndex(x => x.key == navPoint.key);
            if (index < 0)
                return;
            if (index == 0 || navPoint.url == "1") {
                this.owner.notifier.info(this.locale.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
                return;
            }
            const previousNavPoint = await this.getPrevousNavPoint(navPoint, index, flattingNavPoints);
            if (previousNavPoint) {
                await this.gotoNavPoint(previousNavPoint);
            }
            else {
                if (index > 0) {
                    const firstNavPoint = flattingNavPoints[0]
                    if (firstNavPoint) {
                        await this.gotoNavPoint(firstNavPoint);
                        return;
                    }
                }

                this.owner.notifier.info(this.locale.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
                return;

            }
        }
        else {
            const lastVisibleDocument = this.documentsProvider.getLastVisibleDocument();
            if (!lastVisibleDocument)
                return;
            const proxies = this.documentsProvider.getDocuments();
            const index = proxies.indexOf(lastVisibleDocument);
            if (index == 0) {
                this.owner.notifier.info(this.locale.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
                return;
            }
            await this.pdfCoreNavigator.gotoUrl(proxies[index - 1].url);
        }
    }

    private async getPrevousNavPoint(navPoint: NavPoint, index: number, flattingNavPoints: NavPoint[]): Promise<NavPoint | undefined> {
        let previousNavPoint = flattingNavPoints[index - 1];
        if (previousNavPoint) {
            const visibleDocument = this.documentsProvider.getFirstVisibleDocument();
            if (visibleDocument && visibleDocument.url == previousNavPoint.url || previousNavPoint.url == navPoint.url) {
                // Target nav point shares the same URL as the current one (same document); keep looking further.
                return await this.getPrevousNavPoint(previousNavPoint, index - 1, flattingNavPoints);
            }
        }
        return previousNavPoint;
    }
}