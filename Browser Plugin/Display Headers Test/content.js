console.log("Content script running!");

const responseList = document.createElement("div");
responseList.innerHTML = "<ul></ul>";
document.getElementsByTagName("body")[0].appendChild(responseList);

chrome.runtime.onMessage.addListener((msg) => {
    console.log("Received message: ", msg);
    if (msg.type === 'responseHeader') {
        handleResponseHeader(msg.details);
    } else {
        console.log("Ignoring provenance-free message");
    }
});

function handleResponseHeader(responseHeader) {
    console.log("handleResponseHeader() got: ", responseHeader);
    const provHeader = responseHeader.responseHeaders.find((h) => h.name === 'provenance-id');
    if (provHeader) {
        addEntry(responseHeader.url, provHeader.value);
    }
}

function addEntry(url, provId) {
    const item = document.createElement("li");
    item.innerHTML = `<b>${provId}:</b> ${url}`
    responseList.children[0].appendChild(item);
}
