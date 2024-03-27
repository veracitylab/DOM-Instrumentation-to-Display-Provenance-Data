console.log("Provenance tab script running!");      //DEBUG

const mainDiv = document.getElementById("main");
const provInfo = decodeURIComponent(new URL(document.URL).hash).substring(1);
const delimPos = provInfo.indexOf(";");
const provId = provInfo.substring(0, delimPos);
const sourceUrl = provInfo.substring(delimPos + 1);
const provUrl = provenanceUrl(sourceUrl, provId);
mainDiv.innerText = `Loading provenance data for source URL ${provUrl}, provenance ID ${provId}...`;

function provenanceUrl(sourceUrl, provId) {
    return new URL(`/prov/${provId}`, sourceUrl).toString();
}

function wrap(elems, topLevel, perItem) {
    return `<${topLevel}>` + elems.map((e) => `<${perItem}>${e}</${perItem}>`).join("") + `</${topLevel}>`;
}

function tableHeaderRow(elems) {
    return wrap(elems, "tr", "th");
}

function tableRow(elems) {
    return wrap(elems, "tr", "td");
}

function renderProvenanceHtml(sourceUrl, provId, provData) {
    return `<h1>Provenance Information</h1><ul><li><b>Source URL:</b> ${sourceUrl}</li><li><b>Provenance ID:</b> ${provId}</li></ul>` +
        "<table>" +
        tableHeaderRow(["Activity Type", "End Time"]) +
        provData.map((e) => tableRow([e.activities[0].type, e.activities[0].endTime])).join("") +
        "</table>";
}

async function openProvenanceDataTab(sourceUrl, provId, provUrl) {
    const provData = await (await fetch(provUrl)).json();
    console.log("Provenance data for ", provUrl, " is:", provData);

    mainDiv.innerHTML = renderProvenanceHtml(sourceUrl, provId, provData);
    document.getElementsByTagName("title")[0].innerText = `Provenance Information for ${provUrl}`;
}

openProvenanceDataTab(sourceUrl, provId, provUrl);
