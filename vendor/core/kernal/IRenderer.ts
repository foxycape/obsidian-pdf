import { ICoreNavigator, IDocument, IDocumentsProvider, IFileParser, IProgressTracker, Theme } from ".";

/**
 * renderer
 */
export interface IRenderer<T extends IDocument = IDocument,W extends IFileParser = IFileParser> extends IDocumentsProvider<T,W> {
	/**
	 * renderer instance id
	 */
	get id(): string;

	/** reading progress */
	get progressTracker(): IProgressTracker;

	/** location jump */
	get navigator(): ICoreNavigator;

	/** apply theme */
	applyTheme(theme: Theme): Promise<void>
}
