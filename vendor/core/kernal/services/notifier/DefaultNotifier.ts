import { INotifier } from "./INotifier";
import { Notyf } from "./notyf";
import { injectCssContent, removeElement } from "../../html/injector";

export class DefaultNotifier implements INotifier {
    private notyf: Notyf
    async initialize(rootElement: Document | HTMLElement): Promise<void> {
        const { default: css } = await import('./notyf/notyf.scss');
        if (css)
            injectCssContent(rootElement, css.toString(), false, "notyf-css");
        this.notyf = new Notyf(rootElement, {
            ripple: false,
            duration: 2000,
            position: { x: 'center', y: 'top' },
            types: [{
                type: 'success',
                background: '#19be6b',
                icon: false
            }, {
                type: 'warning',
                background: '#ff9900',
                icon: false
                /* icon: {
                    className: 'material-icons',
                    tagName: 'i'
                } */
            }, {
                type: 'error',
                background: '#ed4014',
                icon: false
            }, {
                type: 'info',
                // background: '#2db7f5',
                background: 'rgba(0,0,0,0.8)',
                icon: false
            }]
        });

    }
    info(message: string,options?:any): void {
        this.notyf.info({message:message, ...options});
    }
    success(message: string,options?:any): void {
        this.notyf.success({message:message, ...options});
    }
    error(message: string,options?:any): void {
        this.notyf.error({message:message, ...options});
    }

    closeAll(): void {
        this.notyf.dismissAll();
    }

    async dispose(): Promise<void> {
        if (this.notyf && this.notyf.rootElement) {
            removeElement(this.notyf.rootElement, "notyf-css");
            this.notyf.dispose();
        }

    }
}