/** camelCase property name to CSS variable name (e.g. readerBackground → --reader-background) */
export const toCssVariableName = (key: string): `--${string}` =>
    `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
