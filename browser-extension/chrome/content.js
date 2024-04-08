console.log("Content script running!");

const initialScript = document.createElement("script");
initialScript.textContent = "console.log('This is running from inside the script injected directly into the page!');";
//document.head.appendChild(initialScript);
console.log("document object at content script start:", document);

const highlightRectClass = 'vspx-highlight-rect';
let contextMenuClickedOn;

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
    provenanceDiv.innerHTML = '<span style="color: red; font-weight: bold"">▶ Prov</span>';
    const provButton = provenanceDiv.children[0];
    const responseList = document.createElement("ul");
    responseList.style.display = 'none';
    provenanceDiv.appendChild(responseList);
    document.getElementsByTagName("body")[0].appendChild(provenanceDiv);

    document.addEventListener('contextmenu', (e) => {
        console.log(`Received a contextmenu message on element `, e.target);
        contextMenuClickedOn = e.target;
    });

    chrome.runtime.onMessage.addListener((msg) => {
        console.log("Received message: ", msg);
        if (msg.type === 'responseHeader') {
            addEntry(msg.details.url, msg.details.provId, msg.details.method, msg.details.type);

            if (msg.details.type === 'main_frame') {
                // Need to mark <body> as modified by this HTTP response ourselves
                document.body.classList.add('vspx-' + msg.details.provId);
            }
        } else if (msg.type === 'contextMenuClicked') {
            console.log(`Background worker reports context menu clicked! contextMenuClickedOn=`, contextMenuClickedOn);
            const modifyingResponses = findModifyingResponses(contextMenuClickedOn);
            for (const r of modifyingResponses) {
                console.log(`Modified by HTTP response with prov ID ${r}`);
            }
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

function findModifyingResponses(elem) {
    const provIds = new Set();

    while (elem) {
        if (elem instanceof Element) {
            for (const cls of elem.classList.values()) {
                if (cls.startsWith('vspx-')) {
                    provIds.add(cls.substring(5));
                }
            }
        }

        elem = elem.parentNode;
    }

    return Array.from(provIds.values());
}

window.addEventListener('DOMContentLoaded', main);
