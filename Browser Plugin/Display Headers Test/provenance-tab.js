console.log("Provenance tab script running!");      //DEBUG

const mainDiv = document.getElementById("main");
const provInfo = decodeURIComponent(new URL(document.URL).hash).substring(1);
const delimPos = provInfo.indexOf(";");
const provId = provInfo.substring(0, delimPos);
const sourceUrl = provInfo.substring(delimPos + 1);
const provUrl = provenanceUrl(sourceUrl, provId);
mainDiv.innerText = `The URL is ${document.URL} with prov ID ${provId} and source URL ${provUrl}.`;

function provenanceUrl(sourceUrl, provId) {
    return new URL(`/prov/${provId}`, sourceUrl).toString();
}

async function openProvenanceDataTab(provUrl) {
    // e.preventDefault();
    const provData = await (await fetch(provUrl)).json();
    console.log("Provenance data for ", provUrl, " is:", provData);
}

openProvenanceDataTab(provUrl);
