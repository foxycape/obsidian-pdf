
export interface IDevice {
    /** Gets the device model name. */
    getModel(): string;

    /** Gets the device type. */
    getDeviceType(): DeviceType;

    /** Gets the physical screen scale ratio (`devicePixelRatio`). */
    getDevicePixelRatio(): number;

    /** Gets aggregated device information. */
    getInfo(): DeviceInfo;

    /** Gets the persistent device id. */
    getId(): string;
}

export class DeviceInfo {
    deviceToken: string | undefined;
    browserName: string | undefined;
    browserVersion: string | undefined;
    osType: string | undefined;
    osVersion: string | undefined;
    browserLanguage: string | undefined;
    devicePixelRatio: number | undefined;
    availableResolution: string | undefined;
    availableResolutionX: number | undefined;
    availableResolutionY: number | undefined;
    deviceSize: string | undefined;
    cpuType: string | undefined;
}

export type DeviceType = 'pad' | 'desktop' | 'androidPad' | 'ipad' | 'mobile' | 'mobileAndroid' | 'mobileIOS' | (string & {});