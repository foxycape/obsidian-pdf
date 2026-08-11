import { getUrlFragment } from "../../../../kernal/common/url";
import { checkRangeOrElementIsVisible } from "../../../../kernal/html/geometry";
import { ICoreNavigator, IDocumentsProvider, ILocale, INavPointProvider, INavPointNavigator, INotifier, NavPoint, NavPointProgress } from "../../../../kernal";

export class HtmlNavPointNavigator implements INavPointNavigator {
    constructor(
        private readonly locale: ILocale,
        private readonly notifier: INotifier,
        private readonly documentsProvider: IDocumentsProvider,
        public readonly htmlCoreNavigator: ICoreNavigator,
        public readonly navPointProvider: INavPointProvider
    ) {
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
        await this.htmlCoreNavigator.gotoUrl(navPoint.url);
    }

    async gotoNextNavPointOrFile(): Promise<void> {
        const flattingNavPoints = await this.navPointProvider.getFlattingNavPoints();
        if (flattingNavPoints.length > 1) {
            const navPoint = await this.navPointProvider.getCurrentNavPoint();
            if (!navPoint)
                return;
            const index = flattingNavPoints.findIndex(x => x.key == navPoint.key);
            if (index < 0)
                return;

            if (index == flattingNavPoints.length - 1) {
                this.notifier.info(this.locale?.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
                return;
            }
            const nextNavPoint = await this.getNextNavPoint(navPoint, index, flattingNavPoints);
            if (nextNavPoint) {
                await this.gotoNavPoint(nextNavPoint);
            } else {
                this.notifier.info(this.locale?.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
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
                this.notifier.info(this.locale?.getText("navigator_alreadyislastnavPoint", 'Already at the last chapter'));
                return;
            }
            await this.htmlCoreNavigator.gotoUrl(proxies[index + 1].url);
        }
    }

    private async getNextNavPoint(navPoint: NavPoint, index: number, flattingNavPoints: NavPoint[]): Promise<NavPoint | undefined> {
        let nextNavPoint = flattingNavPoints[index + 1];
        if (nextNavPoint) {
            const navPointFragment = getUrlFragment(navPoint.url);
            const nextNavPointFragment = getUrlFragment(nextNavPoint.url);
            const visibleDocument = this.documentsProvider.getFirstVisibleDocument();
            if (visibleDocument && visibleDocument.url == nextNavPointFragment.urlWithoutAnchor && nextNavPointFragment.urlWithoutAnchor == navPointFragment.urlWithoutAnchor) {
                // Target and current nav points share the same URL (same document); check whether the target is already in the current document
                if (nextNavPointFragment.anchor) {
                    const nextNavPointElement = visibleDocument.getContentContainer().ownerDocument.getElementById(nextNavPointFragment.anchor);
                    if (nextNavPointElement) {
                        // Target nav point is in the current document; jump directly
                        const rendererContainer = this.documentsProvider.getRendererContainer();
                        const result = checkRangeOrElementIsVisible(rendererContainer, nextNavPointElement, rendererContainer.ownerDocument.defaultView);
                        if (result && result.visible) {
                            return await this.getNextNavPoint(nextNavPoint, index + 1, flattingNavPoints);
                        }
                    }
                } else {
                    return await this.getNextNavPoint(nextNavPoint, index + 1, flattingNavPoints);
                }
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
            if (index == 0) {
                this.notifier.info(this.locale?.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
                return;
            }
            const previousNavPoint = await this.getPreviousNavPoint(navPoint, index, flattingNavPoints);
            if (previousNavPoint) {
                await this.gotoNavPoint(previousNavPoint);
                // await this.gotoNavPoint(flattingNavPoints[index - 1]);
            }
            else {
                this.notifier.info(this.locale?.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
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
                this.notifier.info(this.locale?.getText("navigator_alreadyisfirstnavPoint", 'Already at the first chapter'));
                return;
            }
            await this.htmlCoreNavigator.gotoUrl(proxies[index - 1].url);
        }
    }

    private async getPreviousNavPoint(navPoint: NavPoint, index: number, flattingNavPoints: NavPoint[]): Promise<NavPoint | undefined> {
        let prevousNavPoint = flattingNavPoints[index - 1];
        if (prevousNavPoint) {
            const navPointFragment = getUrlFragment(navPoint.url);
            const previousNavPointFragment = getUrlFragment(prevousNavPoint.url);
            const visibleDocument = this.documentsProvider.getFirstVisibleDocument();
            if (visibleDocument && visibleDocument.url == previousNavPointFragment.urlWithoutAnchor && previousNavPointFragment.urlWithoutAnchor == navPointFragment.urlWithoutAnchor) {
                // Target and current nav points share the same URL (same document); check whether the target is already in the current document
                if (previousNavPointFragment.anchor) {
                    const previousNavPointElement = visibleDocument.getContentContainer().ownerDocument.getElementById(previousNavPointFragment.anchor);
                    if (previousNavPointElement) {
                        // Target nav point is in the current document; jump directly
                        const rendererContainer = this.documentsProvider.getRendererContainer();
                        const result = checkRangeOrElementIsVisible(rendererContainer, previousNavPointElement, rendererContainer.ownerDocument.defaultView);
                        if (result && result.visible) {
                            return await this.getPreviousNavPoint(prevousNavPoint, index - 1, flattingNavPoints);
                        }
                    }
                }
                else {
                    // Nav point URL has no anchor; keep looking for the previous one
                    return await this.getPreviousNavPoint(prevousNavPoint, index - 1, flattingNavPoints);
                }
            }
        }
        return prevousNavPoint;
    }
}
