
import { ArchType, IPlatform, OSType } from './IPlatform';
import { uaParser } from '../web/ua';

export class WebPlatform implements IPlatform {
    private osName: string;
    private osVersion: string;
    private arch: ArchType;

    getOS(removeWhiteSpace?: boolean): OSType {
        if (!this.osName) {
            this.osName = uaParser.getOS().name ?? '';
        }
        return this.normalizeOS(this.osName, removeWhiteSpace);
    }

    getOSVersion(): string {
        if (!this.osVersion) {
            this.osVersion = uaParser.getOS().version ?? '';
        }
        return this.osVersion;
    }

    getArch(): ArchType {
        if (!this.arch) {
            this.arch = this.normalizeArch(uaParser.getCPU().architecture);
        }
        return this.arch;
    }

    private normalizeOS(name: string, removeWhiteSpace?: boolean): OSType {
        if (!name) {
            return '';
        }
        let normalized = name.toLowerCase();
        if (removeWhiteSpace) {
            normalized = normalized.replace(/[\s]+/gi, '');
        }
        switch (normalized.replace(/[\s]+/gi, '')) {
            case 'windows':
                return 'windows';
            case 'macos':
            case 'osx':
                return 'macos';
            case 'linux':
                return 'linux';
            case 'ios':
                return 'ios';
            case 'android':
                return 'android';
            case 'openbsd':
                return 'openbsd';
            case 'netbsd':
                return 'netbsd';
            default:
                return normalized as OSType;
        }
    }

    private normalizeArch(architecture?: string): ArchType {
        if (!architecture) {
            return '';
        }
        const normalized = architecture.toLowerCase();
        switch (normalized) {
            case 'amd64':
            case 'x86_64':
            case 'x64':
                return 'x64';
            case 'ia32':
            case 'i386':
            case 'i686':
            case 'x86':
                return 'x86';
            case 'aarch64':
            case 'arm64':
                return 'arm64';
            case 'arm':
            case 'armhf':
            case 'armel':
                return 'arm';
            default:
                return normalized;
        }
    }
}
