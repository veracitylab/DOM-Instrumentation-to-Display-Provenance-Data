console.log("Content script running!");

const initialScript = document.createElement("script");
initialScript.textContent = "console.log('This is running from inside the script injected directly into the page!');";
//document.head.appendChild(initialScript);
console.log("document object at content script start:", document);

const highlightRectClass = 'vspx-highlight-rect';
let contextMenuClickedOn;
let contextMenuClickedPos;
const provenanceDataById = new Map();

// Since we are now being injected ASAP, need to wait until the document finishes loading before we actually run the main code.
function main() {
    console.log("Content script's main() is now running (hopefully after page loading completed)!");

    const provenanceDiv = document.createElement("div");
    provenanceDiv.style.position = 'fixed';
    provenanceDiv.style.top = '10px';
    provenanceDiv.style.left = '10px';
    provenanceDiv.style.zIndex = '9990'; // Hopefully on top of everything
    provenanceDiv.style.backgroundColor = 'lightgray';
    provenanceDiv.style.padding = '10px';
    provenanceDiv.style.fontFamily = 'sans-serif';
    provenanceDiv.innerHTML = '<span style="color: red; font-weight: bold; cursor: pointer">▶ Prov</span>';
    const provButton = provenanceDiv.children[0];
    const responseList = document.createElement("ul");
    responseList.style.display = 'none';
    provenanceDiv.appendChild(responseList);
    document.getElementsByTagName("body")[0].appendChild(provenanceDiv);

    document.addEventListener('contextmenu', (e) => {
        console.log(`Received a contextmenu message on element `, e.target);
        contextMenuClickedOn = e.target;
        contextMenuClickedPos = { x: e.clientX, y: e.clientY };
    });

    chrome.runtime.onMessage.addListener((msg) => {
        console.log("Received message: ", msg);
        if (msg.type === 'responseHeader') {
            addEntry(msg.details.url, msg.details.provId, msg.details.method, msg.details.type);

            if (msg.details.type === 'main_frame') {
                // Need to mark <body> as modified by this HTTP response ourselves
                document.body.classList.add('vspx-' + msg.details.provId);
            }

            provenanceDataById.set(msg.details.provId, { url: msg.details.url, method: msg.details.method, type: msg.details.type });
        } else if (msg.type === 'contextMenuClicked') {
            console.log(`Background worker reports context menu clicked! contextMenuClickedOn=`, contextMenuClickedOn);
            const name = getNameFor(contextMenuClickedOn);
            const popupProvenanceDiv = document.createElement("div");
            popupProvenanceDiv.style.position = 'fixed';
            popupProvenanceDiv.style.top = contextMenuClickedPos.y + 'px';
            popupProvenanceDiv.style.left = contextMenuClickedPos.x + 'px';
            popupProvenanceDiv.style.zIndex = '9990'; // Hopefully on top of everything
            popupProvenanceDiv.style.backgroundColor = 'lightgreen';
            popupProvenanceDiv.style.padding = '10px';
            popupProvenanceDiv.style.fontFamily = 'sans-serif';
            popupProvenanceDiv.innerHTML = `<span style="color: red; font-weight: bold; cursor: pointer">🞭 </span><span style="color: red; font-weight: bold">Prov for clicked element ${name}</span>`;
            popupProvenanceDiv.children[0].addEventListener("click", () => {
                popupProvenanceDiv.remove();
            });
            const popupResponseList = document.createElement("ul");

            const modifyingProvIds = findModifyingProvIds(contextMenuClickedOn);
            popupProvenanceDiv.appendChild(popupResponseList);
            for (const provId of modifyingProvIds) {
                console.log(`Modified by HTTP response with prov ID ${provId}`);
                const provInfo = provenanceDataById.get(provId);
                const entry = makeEntry(provInfo.url, provId, provInfo.method, provInfo.type);
                popupResponseList.appendChild(entry);
            }

            document.body.appendChild(popupProvenanceDiv);
        }
    });

    function makeHighlightAllModifiedElements(provId) {
        return function() {
            const modifiedElems = Array.from(document.querySelectorAll(`.vspx-${provId}`));
            const minimalModifiedElems = keepMinimal(modifiedElems);
            for (const e of minimalModifiedElems) {
                addHighlightRectFor(e, highlightRectClass);
            }
        };
    }

    function makeEntry(sourceUrl, provId, method, type) {
        const provenanceTabUrl = chrome.runtime.getURL("provenance-tab.html") + "#" + encodeURIComponent(provId + ";" + sourceUrl);
        const item = document.createElement("li");
        item.innerHTML = `<a href="${provenanceTabUrl}" target="_blank"><b>${provId}:</b> ${method} ${sourceUrl}</a>`;
        item.addEventListener('mouseenter', makeHighlightAllModifiedElements(provId));
        item.addEventListener('mouseleave', () => removeHighlightRects(highlightRectClass));

        return item;
    }

    function addEntry(sourceUrl, provId, method, type) {
        responseList.appendChild(makeEntry(sourceUrl, provId, method, type));
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

function keepMinimal(elems) {
    const remaining = new Set(elems);

    function crossOut(e) {
        if (e) {
            remaining.delete(e);
            crossOut(e.parentNode);
        }
    }

    for (const e of elems) {
        if (remaining.has(e)) {
            crossOut(e.parentNode);
        }
    }

    return Array.from(remaining.values());
}

// A provenance ID provId is considered to have modified an element elem iff:
// 1. elem, or some ancestor of it, has vspx-${provId} as a class, and
// 2. The nearest such ancestor is "minimal" (has no proper descendants that also have vspx-${provId} as a class).
// This is the same criterion used for highlighting elements modified by a specific provId.
function findModifyingProvIds(elem) {
    const lowestElemForProvId = new Map();

    while (elem) {
        if (elem instanceof Element) {
            for (const cls of elem.classList.values()) {
                if (cls.startsWith('vspx-')) {
                    const provId = cls.substring(5);
                    if (!lowestElemForProvId.has(provId)) {
                        lowestElemForProvId.set(provId, elem);
                    }
                }
            }
        }

        elem = elem.parentNode;
    }

    // Using querySelector() should be faster than finding all descendants and then running keepMinimal()
    const provIdsWithMinimalElems = Array.from(lowestElemForProvId.entries()).filter(([k, v]) => !v.querySelector(`:scope .vspx-${k}`)).map(([k, v]) => k);
    return provIdsWithMinimalElems;
}

function getNameFor(elem) {
    return elem.nodeName;
}

window.addEventListener('DOMContentLoaded', main);
