console.log("content-commons.js running!");

function expandRect(rect, px) {
    return { left: rect.left - px, top: rect.top - px, width: rect.width + 2 * px, height: rect.height + 2 * px };
}

function makeHighlightRectDivFor(elem, cls) {
    let rect = elem.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        console.log(`Ignoring zero-area rect for element `, elem);
        return undefined;
    }

    rect = expandRect(rect, 30);     // A thin border helps visibility for images

    console.log(`Adding highlight rect at `, rect, ` with class ${cls}.`);
    const div = document.createElement('div');
    div.classList.add(cls);
    div.style.position = 'absolute';
    for (const prop of ['left', 'top', 'width', 'height']) {
        div.style[prop] = rect[prop] + "px";
    }
    div.style.backgroundColor = 'yellow';
    div.style.opacity = '30%';
    div.style.zIndex = 9999;
    div.style.pointerEvents = 'none';
    return div;
}

function addHighlightRectFor(elem, cls) {
    const div = makeHighlightRectDivFor(elem, cls);
    if (div) {
        document.body.appendChild(div);
    }
}

function removeHighlightRects(cls) {
    console.log(`Removing all highlight rects with class ${cls}.`);
    for (const elem of Array.from(document.getElementsByClassName(cls))) {
        elem.remove();
    }
}
