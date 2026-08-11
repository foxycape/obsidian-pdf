import { MTTAG, STTAG } from "../Constants";
import { compareTagName, getDocumentBody, getElementByNameAndIndex, getAllNodes } from "./finder";
import { getPureTextContent } from "./text";

/**
 * Wrap text nodes in a custom `st` element so translation-only display can hide
 * original structural tags together with `st`.
 * @param ownerDocument The owner document.
 * @param wrapFullTextNode Whether to wrap full text nodes.
 * @returns 
 */
export const wrapFloatingTextNodes = (ownerDocument: Document, wrapFullTextNode?: boolean): void => {
    const body = getDocumentBody(ownerDocument)
    if (!body) {
        return
    }

    const shouldSkipSubtreeRoot = (el: Element) => {
        const tag = el.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT'
            || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED'
            || tag === 'TEMPLATE' || tag === 'TEXTAREA') {
            return true
        }
        const ns = el.namespaceURI
        if (ns === 'http://www.w3.org/2000/svg' || ns === 'http://www.w3.org/1998/Math/MathML') {
            return true
        }
        return false
    }

    const isNonWhitespaceText = (node: Text) => !!(node.data && /\S/.test(node.data))

    const hasMtAncestor = (parentOfText: Element | null): boolean => {
        let el: Element | null = parentOfText
        while (el) {
            if (compareTagName(el.tagName, MTTAG)) {
                return true
            }
            el = el.parentElement
        }
        return false
    }

    const walkFulltext = (parent: Element) => {
        if (shouldSkipSubtreeRoot(parent)) {
            return
        }
        const snapshot = Array.from(parent.childNodes)
        for (const n of snapshot) {
            if (n.nodeType !== Node.TEXT_NODE) {
                continue
            }
            const textNode = n as Text
            if (!isNonWhitespaceText(textNode)) {
                continue
            }
            if (compareTagName(parent.tagName, STTAG)) {
                continue
            }
            if (hasMtAncestor(parent)) {
                continue
            }
            const st = ownerDocument.createElement(STTAG)
            parent.insertBefore(st, textNode)
            st.appendChild(textNode)
        }
        for (const n of Array.from(parent.childNodes)) {
            if (n.nodeType === Node.ELEMENT_NODE) {
                walkFulltext(n as Element)
            }
        }
    }

    const walkFloatingOnly = (parent: Element) => {
        if (shouldSkipSubtreeRoot(parent)) {
            return
        }

        const snapshot = Array.from(parent.childNodes)
        const hasElementChild = snapshot.some((n) => n.nodeType === Node.ELEMENT_NODE)
        if (!hasElementChild) {
            return
        }

        for (const n of snapshot) {
            if (n.nodeType !== Node.TEXT_NODE) {
                continue
            }
            const textNode = n as Text
            if (!isNonWhitespaceText(textNode)) {
                continue
            }
            if (hasMtAncestor(parent)) {
                continue
            }
            const st = ownerDocument.createElement(STTAG)
            parent.insertBefore(st, textNode)
            st.appendChild(textNode)
        }

        for (const n of Array.from(parent.childNodes)) {
            if (n.nodeType === Node.ELEMENT_NODE) {
                walkFloatingOnly(n as Element)
            }
        }
    }

    if (wrapFullTextNode) {
        walkFulltext(body)
    } else {
        walkFloatingOnly(body)
    }
}

const insertElementToNode = (
    getPureText: (node: Node) => string,
    element: Element,
    nodes: NodeListOf<ChildNode>,
    textPostion: number,
    html: string,
    htmlId: string
) => {
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        let nodeText = getPureText(node);
        if (nodeText.length >= textPostion) {
            if (node.nodeType == Node.TEXT_NODE) {
                if (element.ownerDocument.getElementById(htmlId))
                    return;
                let newElementHtml = nodeText.slice(0, textPostion) + html + nodeText.slice(textPostion);
                let newTag = node.ownerDocument!.createElement("n");
                newTag.innerHTML = newElementHtml;
                let thisNodes: Node[] = [];
                for (let k = 0; k < newTag.childNodes.length; k++) {
                    thisNodes.push(newTag.childNodes.item(k));
                }
                node.replaceWith(...thisNodes);
                break;
            }
            else {
                insertElementToNode(getPureText, element, node.childNodes, textPostion, html, htmlId);
            }
        } else {
            textPostion -= nodeText.length;
        }
    }
};

/**
 * Insert a node into the specified element.
 */
export const insertElement = (
    element: Element | { rootElement: Document | Element, tagName: string, tagIndex: number },
    textPostion: number,
    html: string,
    htmlId: string,
    removeHtmlWhitespace?: boolean,
    whitespaceRegex?: RegExp
) => {
    const getPureText = (node: Node) =>
        getPureTextContent(node, removeHtmlWhitespace, whitespaceRegex) ?? "";

    if (!element)
        return;
    let actualElement: Element;
    if ((element as any).tagIndex >= 0) {
        const { rootElement, tagName, tagIndex } = element as any;
        if (!rootElement || !tagName)
            return;
        actualElement = getElementByNameAndIndex(rootElement, tagName, tagIndex);
    }
    else {
        actualElement = element as Element;

    }

    if (!actualElement)
        return;
    const root = actualElement.ownerDocument;
    if (root.getElementById(htmlId))
        return;
    insertElementToNode(getPureText, actualElement, actualElement.childNodes, textPostion, html, htmlId);
};


/**
 * Wrap each character inside the element (must restore with recoverWrapperCharacters).
 */
export const wrapperCharacters = (element: Element, tagName: string) => {
    if (!element || !tagName) {
        return;
    }
    if (element['originHtml']) {
        return;
    }
    const originHtml = element.innerHTML;
    element['originHtml'] = originHtml
    if (element.children.length == 0) {
        const newHtml = [...element.textContent].map((c) => `<${tagName}>${c}</${tagName}>`).join('');
        element.innerHTML = newHtml;
    }
    else {
        const nodes = getAllNodes(element)
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            if (node.nodeType == Node.TEXT_NODE) {
                const newHtml = [...node.textContent].map((c) => `<${tagName}>${c}</${tagName}>`).join('');
                const container = element.ownerDocument.createElement("k")
                container.innerHTML = newHtml;
                node.parentElement.replaceChild(container, node);
            }
        }
    }
};

export const recoverWrapperCharacters = (element: Element) => {
    if (!element) {
        return;
    }
    const originHtml = element['originHtml']
    if (originHtml) {
        element.innerHTML = originHtml;
    }
    element['originHtml'] = null;
};

// /**
//  * Wrap each character inside the element (must restore with recoverWrapperCharacters).
//  */
// export const wrapperCharacters = (element: Element, tagName: string) => {
//     if (!element || !tagName) {
//         return
//     }
//     // if (element['originHtml']) {
//     //     return { originHtml: element['originHtml'] };
//     // }
//     if (element['originNodes']) {
//         return
//     }
//     const originNodes = element.cloneNode(true).childNodes;
//     element['originNodes'] = originNodes
//     if (element.children.length == 0) {
//         const newHtml = [...element.textContent].map((c) => `<${tagName}>${c}</${tagName}>`).join('');
//         element.innerHTML = newHtml;
//     }
//     else {
//         const nodes = getAllNodes(element)
//         for (let i = 0; i < nodes.length; i++) {
//             const node = nodes[i]
//             if (node.nodeType == Node.TEXT_NODE) {
//                 const newHtml = [...node.textContent].map((c) => `<${tagName}>${c}</${tagName}>`).join('');
//                 const container = element.ownerDocument.createElement("k")
//                 container.innerHTML = newHtml;
//                 node.parentElement.replaceChild(container, node);
//             }
//         }
//     }
//     return
// };

// export const recoverWrapperCharacters = (element: Element) => {
//     if (!element) {
//         return;
//     }
//     const originNodes = element['originNodes']
//     if (originNodes) {
//         // element.innerHTML = originHtml;
//         element.replaceChildren(...originNodes);
//     }
//     element['originNodes'] = null;
// };
