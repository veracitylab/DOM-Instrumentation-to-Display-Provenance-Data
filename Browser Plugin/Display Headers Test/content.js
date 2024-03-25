console.log("Content script running!");

const responseList = document.createElement("div");
responseList.innerHTML = "<ul></ul>";
document.getElementsByTagName("body")[0].appendChild(responseList);

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
    const item = document.createElement("li");
    item.innerHTML = `<a href="${provenanceUrl(sourceUrl, provId)}"><b>${provId}:</b> ${sourceUrl}</a>`;
    responseList.children[0].appendChild(item);
}

function provenanceUrl(sourceUrl, provId) {
    return (sourceUrl + "/").replace(/\/.*/, `/prov/${provId}`);
}
