console.log("Content script running!");

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
        handleResponseHeader(msg.details);
    }
});

function handleResponseHeader(responseHeader) {
    console.log("handleResponseHeader() got: ", responseHeader);
    const provHeader = responseHeader.responseHeaders.find((h) => h.name === 'provenance-id');
    if (provHeader) {
        addEntry(responseHeader.url, provHeader.value);
    } else {
        console.log("Ignoring provenance-free message");
    }
}

function addEntry(sourceUrl, provId) {
    const provUrl = provenanceUrl(sourceUrl, provId);
    const item = document.createElement("li");
    item.innerHTML = `<a href="${provUrl}" target="_blank"><b>${provId}:</b> ${sourceUrl}</a>`;
    item.children[0].onclick = (e) => openProvenanceDataTab(e, provUrl);
    responseList.appendChild(item);
}

function provenanceUrl(sourceUrl, provId) {
    return (sourceUrl + "/").replace(/\/.*/, `/prov/${provId}`);
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

async function openProvenanceDataTab(e, provUrl) {
    e.preventDefault();
    const provData = await (await fetch(provUrl)).json();
    console.log("Provenance data for ", provUrl, " is:", provData);
}

provButton.onclick = toggleProvDisplay;

// Let the extension know that we are ready to handle messages.
// This is necessary to avoid a race with the main page load.
console.log("Content script about to send ready message...");
chrome.runtime.sendMessage({ type: "ready" });
console.log("Content script has sent the ready message!");
