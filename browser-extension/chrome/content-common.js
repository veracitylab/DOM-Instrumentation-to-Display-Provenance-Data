console.log("content-commons.js running!");

function makeHighlightRectDivFor(elem, cls) {
    const rect = elem.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        console.log(`Ignoring zero-area rect for element `, elem);
        return undefined;
    }

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
