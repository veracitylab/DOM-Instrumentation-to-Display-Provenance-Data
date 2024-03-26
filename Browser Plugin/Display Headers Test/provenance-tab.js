console.log("Provenance tab script running!");      //DEBUG

const mainDiv = document.getElementById("main");
const provUrl = decodeURIComponent(new URL(document.URL).hash).substring(1);
mainDiv.innerText = `The URL is ${document.URL} with hash ${provUrl}.`;

async function openProvenanceDataTab(provUrl) {
    // e.preventDefault();
    const provData = await (await fetch(provUrl)).json();
    console.log("Provenance data for ", provUrl, " is:", provData);
}

openProvenanceDataTab(provUrl);
