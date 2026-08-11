export interface IPdfDestinationBuilder {
    buildDest(pageNumber: number, options?: "current" | { x: number; y: number }): string;
}