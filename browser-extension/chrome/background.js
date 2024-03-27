// Don't send messages to tabs before they are ready; queue them up instead
let readyTabs = new Set();
let unreadyQueue = new Map();

function responseUrls(details) {
  if (details.type != null && details.method != null && details.requestId != null){
    console.log("Saw HTTP request: " + JSON.stringify(details));		//DEBUG

    const provIdInfo = details.responseHeaders.find((h) => h.name === 'provenance-id');
    if (provIdInfo) {
      if (details.type === 'main_frame') {
        // A top-level frame load means we need to start queueing messages until the page indicates it's ready
        const existingQueue = unreadyQueue.get(details.tabId) ?? []
        console.log("Top-level frame load: Tab previously " + (readyTabs.has(details.tabId) ? "ready" : "not ready") + ". Will drop " + (unreadyQueue.get(details.tabId) ?? []).length + " queued messages.");
        unreadyQueue.delete(details.tabId);
        readyTabs.delete(details.tabId);
      }
  
      // sendOrQueue(details.tabId, { type: "responseHeader", details });
      sendOrQueue(details.tabId, { type: "responseHeader", details: { url: details.url, provId: provIdInfo.value } });
    } else {
      console.log("Ignoring provenance-free message");
    }
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  responseUrls,
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log("Received message: ", msg, " from ", sender);
  if (msg.type === 'ready') {
    readyTabs.add(sender.tab.id);
    flushUnreadyQueue(sender.tab.id);
  }
});

function sendOrQueue(tabId, msg) {
  if (readyTabs.has(tabId)) {
    console.log("Sending message immediately to ready tab " + tabId);
    send(tabId, msg);
  } else {
    console.log("Queueing message for non-ready tab " + tabId);
    let messages = unreadyQueue.get(tabId) ?? [];
    messages.push(msg);
    unreadyQueue.set(tabId, messages);
  }
}

function flushUnreadyQueue(tabId) {
  console.log("Flushing unready queue for newly ready tab " + tabId);
  for (const msg of unreadyQueue.get(tabId) ?? []) {
    console.log("Sending message to newly ready tab " + tabId);
    send(tabId, msg);
  }

  unreadyQueue.delete(tabId);
}

function send(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg);
}
