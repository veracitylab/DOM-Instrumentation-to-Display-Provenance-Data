console.log("Content script running!");

const initialScript = document.createElement("script");
initialScript.textContent = "console.log('This is running from inside the script injected directly into the page!');";
//document.head.appendChild(initialScript);
console.log("document object at content script start:", document);

// Since we are now being injected ASAP, need to wait until the document finishes loading before we actually run the main code.
function main() {
    console.log("Content script's main() is now running (hopefully after page loading completed)!");

    const provenanceDiv = document.createElement("div");
    provenanceDiv.style.position = 'fixed';
    provenanceDiv.style.top = '10px';
    provenanceDiv.style.left = '10px';
    provenanceDiv.style.zIndex = '1000'; // Hopefully on top of everything
    provenanceDiv.style.backgroundColor = 'lightgray';
    provenanceDiv.style.padding = '10px';
    provenanceDiv.style.fontFamily = 'sans-serif';
    provenanceDiv.innerHTML = '<span style="color: red; font-weight: bold"">▶ Prov</span>';
    const provButton = provenanceDiv.children[0];
    const responseList = document.createElement("ul");
    responseList.style.display = 'none';
    provenanceDiv.appendChild(responseList);
    document.getElementsByTagName("body")[0].appendChild(provenanceDiv);

    chrome.runtime.onMessage.addListener((msg) => {
        console.log("Received message: ", msg);
        if (msg.type === 'responseHeader') {
            addEntry(msg.details.url, msg.details.provId);
        }
    });

    function makeHighlightAllModifiedElements(provId) {
        return function() {
            const modifiedElems = Array.from(document.querySelectorAll(`.vspx-${provId}`));
            for (const e of modifiedElems) {
                addHighlightRectFor(e, 'vspx-highlight-rect');
            }
        };
    }

    function addEntry(sourceUrl, provId) {
        const provenanceTabUrl = chrome.runtime.getURL("provenance-tab.html") + "#" + encodeURIComponent(provId + ";" + sourceUrl);
        const item = document.createElement("li");
        item.innerHTML = `<a href="${provenanceTabUrl}" target="_blank"><b>${provId}:</b> ${sourceUrl}</a>`;
        item.addEventListener('mouseenter', makeHighlightAllModifiedElements(provId));
        item.addEventListener('mouseleave', () => removeHighlightRects('vspx-highlight-rect'));
        responseList.appendChild(item);
    }

    function toggleProvDisplay() {
        if (responseList.style.display === 'none') {
            provButton.innerText = '▼ Prov';
            responseList.style.display = 'inline';
        } else {
            provButton.innerText = '▶ Prov';
            responseList.style.display = 'none';
        }
    }

    provButton.onclick = toggleProvDisplay;

    // Let the extension know that we are ready to handle messages.
    // This is necessary to avoid a race with the main page load.
    console.log("Content script about to send ready message...");
    chrome.runtime.sendMessage({ type: "ready" });
    console.log("Content script has sent the ready message!");
}

//TODO: Copied from injected-early-into-main-world.js, doesn't need to be in both
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

window.addEventListener('DOMContentLoaded', main);
