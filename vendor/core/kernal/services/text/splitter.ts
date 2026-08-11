interface SplitTextOptions {
    /** Whether to prefer splitting by newlines */
    preferCTRL?: boolean
    minChars?: number;
    maxChars?: number;
    forceSplitChars?: number;
    separators?: string[];
}

interface TextSegment {
    /** Text with leading/trailing invisible characters removed */
    text: string;
    /** Original text */
    rawText: string;
    /** Character length */
    length: number;
    /** Start offset of the text */
    offset: number
}

/** Sentence-ending punctuation (multilingual) */
const SENTENCE_END_CHARS = /[.。．\u06D4\u061F\u0964\u0965\u1362\u0589\n]/;
/** Closing quotes that may immediately follow sentence-ending punctuation (multilingual) */
const CLOSING_QUOTE_CHARS = /[\u201C\u201D\u0022\uFF02\u300D\u300F\u301D\u301E\u301F\u00BB\u2019\u02BA]/;
/** Zero-width characters that may appear between sentence end and a closing quote */
const ZERO_WIDTH_OR_INVISIBLE = /[\u200B\u200C\u200D\uFEFF\u2060]/;
/** Digit characters (including full-width) */
const DIGIT_CHARS = /[0-9０-９٠-٩\u0660-\u0669]/;
/** Lowercase letters (including common Unicode letters) */
const LOWERCASE_LETTER = /[a-z\u00E0-\u024F\u0370-\u03FF]/;
/** Invisible characters: whitespace + zero-width characters */
const INVISIBLE_OR_WHITESPACE = /[\s\u200B\u200C\u200D\uFEFF\u2060]/;

const hasVisibleCharacter = (s: string): boolean => {
    for (let i = 0; i < s.length; i++) {
        if (!INVISIBLE_OR_WHITESPACE.test(s[i])) return true;
    }
    return false;
};

/** Whether the character is a valid sentence boundary (plain-text mode; newlines are not treated as sentence ends) */
const isSentenceBoundary = (text: string, index: number): boolean => {
    const ch = text[index];
    if (!ch || !SENTENCE_END_CHARS.test(ch)) return false;
    if (ch === '\n') return false;
    if (ch === '.' || ch === '．') {
        const prev = index > 0 ? text[index - 1] : '';
        const next = index + 1 < text.length ? text[index + 1] : '';
        if (DIGIT_CHARS.test(prev) && DIGIT_CHARS.test(next)) return false;
        if (DIGIT_CHARS.test(prev) && (next === ' ' || next === '\t' || next === '\n')) return false;
        let j = index + 1;
        while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
        if (j < text.length && LOWERCASE_LETTER.test(text[j])) return false;
    }
    return true;
};

/**
 * Split the given text into TextSegment sentences by sentence-ending punctuation
 * - Excludes dots in numbers (3.14), ordinals (1. First), and abbreviations (Dr. Smith)
 * - Zero-width characters and closing quotes after sentence end are kept, e.g. "I am all ears."
 * - In plain-text mode, newlines are not treated as sentence ends (block boundaries cannot be inferred without DOM)
 * - Guarantees segments.reduce((s, seg) => s + seg.text, '') === text; no characters are removed
 * - Segments that contain only invisible characters (whitespace, zero-width) are not standalone sentences and are merged into adjacent visible ones
 */
const splitToSentences = (text: string): TextSegment[] => {
    if (text == null || text.length === 0) return [];

    const sentences: string[] = [];
    let start = 0;

    for (let i = 0; i < text.length; i++) {
        if (isSentenceBoundary(text, i)) {
            let end = i + 1;
            while (end < text.length && SENTENCE_END_CHARS.test(text[end])) end++;
            while (end < text.length && ZERO_WIDTH_OR_INVISIBLE.test(text[end])) end++;
            while (end < text.length && CLOSING_QUOTE_CHARS.test(text[end])) end++;

            sentences.push(text.slice(start, end));
            start = end;
            i = end - 1;
        }
    }

    if (start < text.length) {
        sentences.push(text.slice(start));
    }

    const merged: string[] = [];
    for (let j = 0; j < sentences.length; j++) {
        const s = sentences[j];
        if (!hasVisibleCharacter(s)) {
            if (merged.length > 0) {
                merged[merged.length - 1] += s;
            } else if (j + 1 < sentences.length) {
                sentences[j + 1] = s + sentences[j + 1];
            } else {
                merged.push(s);
            }
        } else {
            merged.push(s);
        }
    }

    const segments: TextSegment[] = [];
    let offset = 0;
    for (const s of merged) {
        segments.push({ text: s, rawText: s, length: s.length, offset });
        offset += s.length;
    }
    return segments;
};

const splitText = (text: string, options: SplitTextOptions = {}): TextSegment[] => {
    if (!text) {
        return []
    }
    // Default config
    const config = {
        preferCTRL: options?.preferCTRL ?? false,
        minChars: options?.minChars || 200,
        maxChars: options?.maxChars || 250,
        forceSplitChars: options?.forceSplitChars || 500,
        separators: options?.separators || ["。", "？", "?", "."]
    };

    const segments: TextSegment[] = [];
    let currentIndex: number = 0;
    let segmentIndex: number = 1;
    let offset: number = 0;

    // Validate config parameters
    if (config.minChars <= 0 || config.maxChars <= 0 || config.forceSplitChars <= 0) {
        throw new Error("Config parameters must be greater than 0");
    }

    if (config.minChars > config.maxChars) {
        throw new Error("minChars must not be greater than maxChars");
    }

    if (config.forceSplitChars < config.maxChars) {
        console.warn('forceSplitChars can not less tan maxChars')
        config.forceSplitChars = config.maxChars;
        // throw new Error("forceSplitChars must not be less than maxChars");
    }

    if (config.preferCTRL) {
        const lines = text.split('\n');
        for (const line of lines) {
            const lineLength = (line?.length ?? 0);

            // If the line length is within the limit, add it directly
            if (lineLength <= config.minChars) {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    segments.push({
                        text: trimmedLine,
                        rawText: line,
                        length: lineLength + 1, // Include the newline character
                        offset: offset
                    });
                    segmentIndex++;
                }
                offset += lineLength + 1; // Include the newline character
            } else {
                // Line length exceeds maxChars; try splitting by separators first
                const separatorSegments = splitBySeparators(line, config.separators);

                // Process each separator-based segment
                for (const seg of separatorSegments) {
                    if (seg.length <= config.minChars) {
                        // Segment length is within the limit; add it directly
                        const trimmedSeg = seg.trim();
                        if (trimmedSeg) {
                            segments.push({
                                text: trimmedSeg,
                                rawText: seg,
                                length: seg.length,
                                offset: offset
                            });
                            segmentIndex++;
                        }
                        offset += seg.length;
                    } else {
                        // Segment still exceeds maxChars; split further with findSplitIndex
                        let segCurrentIndex = 0;
                        while (segCurrentIndex < seg.length) {
                            // If remaining text length is within minChars, take it as one segment
                            if (seg.length - segCurrentIndex <= config.minChars) {
                                const segmentText = seg.slice(segCurrentIndex);
                                const trimmedText = segmentText.trim();
                                if (trimmedText) {
                                    segments.push({
                                        text: trimmedText,
                                        rawText: segmentText,
                                        length: segmentText.length,
                                        offset: offset
                                    });
                                }
                                offset += segmentText.length;
                                break;
                            }

                            // Find a smart split point with findSplitIndex
                            const endIndex = findSplitIndex(seg, segCurrentIndex, config);
                            const segmentText = seg.slice(segCurrentIndex, endIndex + 1);
                            const trimmedText = segmentText.trim();

                            if (trimmedText) {
                                segments.push({
                                    text: trimmedText,
                                    rawText: segmentText,
                                    length: segmentText.length,
                                    offset: offset
                                });
                            }

                            offset += segmentText.length;
                            segCurrentIndex = endIndex + 1;
                            segmentIndex++;
                        }
                    }
                }
                offset += 1; // Account for the newline character length
            }
        }
        // Before returning, rebuild segments by minChars and merge those shorter than minChars
        return mergeSmallSegments(segments, config.minChars);
    }

    while (currentIndex < text.length) {
        // If remaining text length is within minChars, take it as one segment
        if (text.length - currentIndex <= config.minChars) {
            const segmentText = text.slice(currentIndex);
            segments.push({
                text: segmentText,
                rawText: segmentText,
                length: segmentText.length,
                offset: offset
            });
            break;
        }

        // Compute the end position of the current segment
        const endIndex = findSplitIndex(text, currentIndex, config);
        const segmentText = text.slice(currentIndex, endIndex + 1);
        const segmentTextLength = segmentText.length;
        segments.push({
            text: segmentText,
            rawText: segmentText,
            length: segmentTextLength,
            offset: offset
        });

        currentIndex = endIndex + 1;
        segmentIndex++;
        offset += segmentTextLength
    }

    return segments;
}

// Helper: merge segments shorter than minChars
const mergeSmallSegments = (segments: TextSegment[], minChars: number): TextSegment[] => {
    if (segments.length === 0) {
        return segments;
    }

    const mergedSegments: TextSegment[] = [];
    let i = 0;

    while (i < segments.length) {
        const currentSegment = segments[i];
        const currentTextLength = currentSegment.length;

        // If the current segment length is already >= minChars, add it directly
        if (currentTextLength >= minChars) {
            mergedSegments.push(currentSegment);
            i++;
        } else {
            // Current segment is shorter than minChars; merge with following ones
            let mergedText = currentSegment.text;
            let mergedLength = currentSegment.length;
            let mergedOffset = currentSegment.offset;
            let j = i + 1;

            // Keep merging subsequent segments until minChars is reached or none remain
            while (j < segments.length && mergedText.length < minChars) {
                const nextSegment = segments[j];
                mergedText += '\n' + nextSegment.text;
                // Merged length: total length from the first segment's offset to the end of the last segment
                mergedLength = nextSegment.offset - mergedOffset + nextSegment.length
                j++;
            }

            // Create the merged segment
            mergedSegments.push({
                text: mergedText,
                rawText: mergedText,
                length: mergedLength,
                offset: mergedOffset
            });

            i = j;
        }
    }

    return mergedSegments;
}

// Helper: split text by separators, returning segments that include the separators
const splitBySeparators = (text: string, separators: string[]): string[] => {
    if (!text || separators.length === 0) {
        return text ? [text] : [];
    }

    const segments: string[] = [];
    let currentIndex = 0;

    for (let i = 0; i < text.length; i++) {
        if (separators.includes(text[i])) {
            // If separator is `.` followed by a digit, do not split (avoid breaking decimals)
            if (text[i] === '.' && i + 1 < text.length && /\d/.test(text[i + 1])) {
                continue; // Skip this separator and continue
            }

            // If separator is `。` or `.` followed by a quote (`"` or `"`), do not split (avoid breaking quotes)
            if ((text[i] === '。' || text[i] === '.') && i + 1 < text.length) {
                const nextChar = text[i + 1];
                if (nextChar === '”' || nextChar === '"') {
                    continue; // Skip this separator and continue
                }
            }

            // Found a separator; extract text from current position through the separator (inclusive)
            const segment = text.slice(currentIndex, i + 1);
            if (segment) {
                segments.push(segment);
            }
            currentIndex = i + 1;
        }
    }

    // Append any remaining text
    if (currentIndex < text.length) {
        const lastSegment = text.slice(currentIndex);
        if (lastSegment) {
            segments.push(lastSegment);
        }
    }

    return segments;
}

const findSplitIndex = (text: string, startIndex: number, config: Required<SplitTextOptions>): number => {
    const maxIndex = Math.min(startIndex + config.forceSplitChars - 1, text.length - 1);
    const preferredEndIndex = Math.min(startIndex + config.maxChars - 1, text.length - 1);

    // Prefer finding a separator within the minChars–maxChars range
    let splitIndex = -1;

    // Search backward for a separator from the preferred end position
    for (let i = preferredEndIndex; i >= startIndex + config.minChars - 1; i--) {
        if (config.separators.includes(text[i])) {
            splitIndex = i;
            break;
        }
    }

    // If none found in the preferred range, search forward until the force-split position
    if (splitIndex === -1) {
        for (let i = preferredEndIndex + 1; i <= maxIndex; i++) {
            if (config.separators.includes(text[i])) {
                splitIndex = i;
                break;
            }
        }
    }

    // If still none found, split at the force-split position
    if (splitIndex === -1) {
        splitIndex = maxIndex;
    }

    return splitIndex;
}

// Utility: summarize split results
const getSplitSummary = (segments: TextSegment[]): { totalSegments: number; totalChars: number; avgChars: number } => {
    const totalChars = segments.reduce((sum, segment) => sum + segment.length, 0);
    return {
        totalSegments: segments.length,
        totalChars,
        avgChars: Math.round(totalChars / segments.length)
    };
}

// Export types and functions for other modules
export { splitText, splitToSentences, getSplitSummary };
export type { SplitTextOptions, TextSegment };
