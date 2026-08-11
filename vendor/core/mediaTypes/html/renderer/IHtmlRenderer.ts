import { Direction, IFileParser, INavPointNavigator, INavPointProvider, IPagingNavigator, IRenderer, IStyleProvider, WritingMode } from "../../../kernal";
import type { IHtmlDocument } from "./IHtmlDocument";
import { IHtmlRendererLayout } from "./layout/IHtmlRendererLayout";
import { IHtmlProgressTracker } from "./progress/IHtmlIProgressTracker";

export interface IHtmlRenderer<T extends IHtmlDocument = IHtmlDocument,W extends IFileParser = IFileParser> extends IRenderer<T,W> {

	get progressTracker(): IHtmlProgressTracker;

	/**
	 * Get the writing direction.
	 */
	get writingMode(): WritingMode;

	/**
	 * Get the text direction.
	 */
	get direction(): Direction;

	/** Navigator for navigation points. */
	get navPointNavigator(): INavPointNavigator;

	/** Provider for navigation points. */
	get navPointProvider(): INavPointProvider;

	/**
	 * Navigator for page numbers.
	 */
	get pagingNavigator(): IPagingNavigator | undefined;

	/** HTML content style provider. */
	get styleProvider(): IStyleProvider;

	/** HTML renderer layout. */
	get layout(): IHtmlRendererLayout;
}