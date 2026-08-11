import { IDisposable } from "../../../kernal";

export interface IPdfSvgBuilder extends IDisposable {
    initialize(): Promise<void>;
}