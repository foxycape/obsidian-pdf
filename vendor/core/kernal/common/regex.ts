export type RegexAssertionsResult = {
    lookahead: boolean;
    lookbehind: boolean;
    negativeLookahead: boolean;
    negativeLookbehind: boolean;
};

let regexAssertionsResult: RegexAssertionsResult | undefined;

/**
 * Check regex assertion support
 */
export const checkRegexAssertionsSupport = (): RegexAssertionsResult => {
    if (regexAssertionsResult) {
        return regexAssertionsResult;
    }
    const result: RegexAssertionsResult = {
        lookahead: false,
        lookbehind: false,
        negativeLookahead: false,
        negativeLookbehind: false
    };

    try {
        const lookaheadRegex = /foo(?=bar)/;
        result.lookahead = lookaheadRegex.test('foobar');

        const negativeLookaheadRegex = /foo(?!baz)/;
        result.negativeLookahead = negativeLookaheadRegex.test('foobar');

        const lookbehindRegex = new RegExp('(?<=foo)bar');
        result.lookbehind = lookbehindRegex.test('foobar');

        const negativeLookbehindRegex = new RegExp('(?<!baz)bar');
        result.negativeLookbehind = negativeLookbehindRegex.test('foobar');
    } catch (error) {
    }
    regexAssertionsResult = result;
    return result;
};
