import { BrowserCapabilities } from '../web/BrowserCapabilities';
import { DeviceInfo, DeviceType, IDevice } from './IDevice';
import { IEnvironment } from './IEnvironment';
import { IPlatform } from './IPlatform';
import { uaParser } from '../web/ua';

export class WebBrowser implements IDevice {
    private readonly uuidKey = "deviceToken_key";
    private readonly uaDevice=uaParser.getDevice();

    private deviceId: string | null = null;
    private currentModel: string;
    private currentIsMobile: boolean;
    private info: DeviceInfo;
    constructor(private readonly platform: IPlatform, private readonly  environment: IEnvironment) {
        
    }

    getModel() {
        if (this.currentModel == undefined) {
            this.currentModel = this.uaDevice.model;
        }
        return this.currentModel;
    }

    getDeviceType(): DeviceType {
        if (this.isMobile()) {
            const os = this.platform.getOS(true);
            if (os == 'android') {
                return 'mobileAndroid';
            }
            if (os == 'ios') {
                return 'mobileIOS';
            }
            return 'mobile';
        }
        if (this.isIPad()) {
            return 'ipad';
        }
        if (this.isAndroidPad()) {
            return 'androidPad';
        }
        return 'desktop';
    }

    getDevicePixelRatio() {
        let ratio = 0;
        const screen = globalThis.screen;
        const ua = navigator.userAgent.toLowerCase();
        if (globalThis.devicePixelRatio !== undefined) {
            ratio = globalThis.devicePixelRatio;
        } else if (ua.indexOf("msie")) {
            const s = screen as any;
            if (s.deviceXDPI && s.logicalXDPI) {
                ratio = s.deviceXDPI / s.logicalXDPI;
            }
        } else if (globalThis.outerWidth && globalThis.innerWidth) {
            ratio = globalThis.outerWidth / globalThis.innerWidth;
        }
        return ratio;
    }

    getInfo(): DeviceInfo {
        if (!this.info) {
            const deviceType = this.getDeviceType();
            const deviceInfo = new DeviceInfo();
            deviceInfo.deviceToken = this.getId();
            deviceInfo.osType = this.platform.getOS(true);
            deviceInfo.osVersion = this.platform.getOSVersion();
            deviceInfo.browserName = BrowserCapabilities.getBrowserName();
            deviceInfo.browserVersion = BrowserCapabilities.getBrowserVersion();
            deviceInfo.browserLanguage = this.environment.getLanguage();
            deviceInfo.cpuType = this.platform.getArch();
            deviceInfo.devicePixelRatio = this.getDevicePixelRatio();
            deviceInfo.availableResolutionX = screen.width;
            deviceInfo.availableResolutionY = screen.height;
            deviceInfo.deviceSize = deviceType.startsWith('mobile')
                ? 'mobile'
                : (deviceType === 'desktop' ? 'desktop' : 'pad');
            this.info = deviceInfo;
        }
        this.info.deviceToken = this.getId();
        return this.info;
    }

    getId(): string {
        if (this.deviceId != null && this.deviceId.length > 0) {
            return this.deviceId;
        }
        this.deviceId = localStorage.getItem(this.uuidKey);
        if (this.deviceId != null && this.deviceId.length > 0) {
            return this.deviceId;
        }
        this.deviceId = this.getRandomId();

        localStorage.setItem(this.uuidKey, this.deviceId);
        return this.deviceId;
    }

    private isMobile(): boolean {
        if (this.currentIsMobile == undefined) {
            this.currentIsMobile = this.uaDevice.type == "mobile";
        }
        return this.currentIsMobile;
    }

    private isIPad(): boolean {
        return this.getModel()?.toLowerCase()?.indexOf('ipad') >= 0;
    }

    private isAndroidPad(): boolean {
        const os = this.platform.getOS(true);
        const orientation = window.orientation ?? -1;
        return !!(os && (os == "android" || os == "linux") && orientation != -1 && !this.isMobile());
    }

    private getRandomId() {
        if (globalThis.crypto) {
            const array = new Uint8Array(16);
            globalThis.crypto.getRandomValues(array);
            let uuid = '';
            array.forEach((byte) => {
                uuid += byte.toString(16).padStart(2, '0');
            });
            this.deviceId = uuid;
            localStorage.setItem(this.uuidKey, uuid);
            return uuid;
        }

        return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
