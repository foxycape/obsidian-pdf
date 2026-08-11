export interface IPlatform {
    /**
     * Gets the operating system name.
     * @param removeWhiteSpace Whether to remove whitespace from the OS name.
     */
    getOS(removeWhiteSpace?: boolean): OSType;

    /** Gets the operating system version. */
    getOSVersion(): string;

    /** Gets the CPU architecture. */
    getArch(): ArchType;
}

export type OSType = 'windows' | 'macos' | 'linux'|'ios'|'android'|'openbsd'|'netbsd'|(string & {});
export type ArchType = 'x86' | 'x64' | 'arm' | 'arm64' | (string & {});