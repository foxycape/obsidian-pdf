import { IDocument } from ".";
import { IDisposable } from "./IDisposable";

export interface IStyleProvider extends IDisposable {

	/**
	 * initialize the style provider
	 * @param currentVariables the current variables
	 */
	initialize(currentVariables?: Map<string, string>): void;

	/**
	 * get the default variables
	 */
	getDefaultVariables(): Map<string, string>;

	/**
	* get the current css variables
	*/
	getCurrentVariables(): Map<string, string>;

	/**
	 * get the default value of the css variable
	 * @param variableName the name of the css variable
	 */
	getDefaultVariableValue(variableName: string): string;

	/**
	 * get the current value of the css variable,if not found, return the default value
	 * @param variableName the name of the css variable
	 */
	getVariableValue(variableName: string): string;

	/**
	 * inject the styles into the document
	 * @param doc the document
	 */
	injectStyles(doc: IDocument): Promise<void>;

	/**
	 * change multiple styles
	 * @param variableNameValues the mapping of the css variable names and values
	 */
	changeStyles(variableNameValues: Map<string, string>): Promise<void>;

	/**
	 * change a single style
	 * @param variableName the name of the css variable
	 * @param variableValue the value of the css variable
	 */
	changeStyle(variableName: string, variableValue: string): Promise<void>;

	/**
	 * reset the styles to the default values
	 */
	resetStyles(): Promise<void>;
}