console.log("Background process started!");

// Used to sequence loads and stores to avoid races
let promiseChain = Promise.resolve();

// Don't send messages to tabs before they are ready; queue them up instead
// let readyTabs = new Set();
// let unreadyQueue = new Map();
async function getReadyTabs() /*: Set<string> */ {
  console.log(`getReadyTabs() called`); //DEBUG
  const fromStorage = await chrome.storage.session.get('readyTabs');
  // console.log(`getReadyTabs() returning`); //DEBUG
  return new Set(fromStorage?.readyTabs ?? []);
}

async function setReadyTabs(readyTabs /*: Set<string> */) {
  console.log(`setReadyTabs() called`); //DEBUG
  await chrome.storage.session.set({ readyTabs: [...readyTabs] }); // Store as array since chrome.storage can't handle Sets
}

async function getUnreadyQueue() /*: Map<number, string[]> */ {
  console.log(`getUnreadyQueue() called`); //DEBUG
  const fromStorage = await chrome.storage.session.get('unreadyQueue');
  return new Map(fromStorage?.unreadyQueue ?? []);
}

async function setUnreadyQueue(unreadyQueue /*: Map<number, string[]> */) {
  console.log(`setUnreadyQueue() called`); //DEBUG
  console.log(`setUnreadyQueue(): Will set the queue to `, [...unreadyQueue.entries()]);  //DEBUG
  await chrome.storage.session.set({ unreadyQueue: [...unreadyQueue.entries()] }); // Store as array of pairs since chrome.storage can't handle Maps
}

async function responseUrls(details) {
  if (details.type != null && details.method != null && details.requestId != null){
    console.log("Saw HTTP request: " + JSON.stringify(details));		//DEBUG

    const provIdInfo = details.responseHeaders.find((h) => h.name === 'provenance-id');
    if (provIdInfo) {
      if (details.type === 'main_frame') {
        // A top-level frame load means we need to start queueing messages until the page indicates it's ready
        await appendToPromiseChain(async () => {
          const unreadyQueue = await getUnreadyQueue();
          const readyTabs = await getReadyTabs();
          const existingQueue = unreadyQueue.get(details.tabId) ?? []
          console.log("Top-level frame load: Tab previously " + (readyTabs.has(details.tabId) ? "ready" : "not ready") + ". Will drop " + (unreadyQueue.get(details.tabId) ?? []).length + " queued messages.");
          unreadyQueue.delete(details.tabId);
          await setUnreadyQueue(unreadyQueue);
          readyTabs.delete(details.tabId);
          await setReadyTabs(readyTabs);
        }, "toplevel->emptyQueue");
      }
  
      // sendOrQueue(details.tabId, { type: "responseHeader", details });
      await appendToPromiseChain(() => sendOrQueue(details.tabId, { type: "responseHeader", details: { url: details.url, provId: provIdInfo.value } }), "sendOrQueue");
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

chrome.runtime.onMessage.addListener(async (msg, sender) => {
  console.log("Received message: ", msg, " from ", sender);
  if (msg.type === 'ready') {
    await appendToPromiseChain(async () => {
      const readyTabs = await getReadyTabs();
      readyTabs.add(sender.tab.id);
      await setReadyTabs(readyTabs);
      await flushUnreadyQueue(sender.tab.id);
    }, "ready->flush");
  }
});

async function sendOrQueue(tabId, msg) {
  const readyTabs = await getReadyTabs();
  if (readyTabs.has(tabId)) {
    console.log("Sending message immediately to ready tab " + tabId);
    send(tabId, msg);
  } else {
    console.log("Queueing message for non-ready tab " + tabId);
    const unreadyQueue = await getUnreadyQueue();
    let messages = unreadyQueue.get(tabId) ?? [];
    messages.push(msg);
    console.log("There are now " + messages.length + " messages in the queue.");
    unreadyQueue.set(tabId, messages);
    await setUnreadyQueue(unreadyQueue);
  }
}

async function flushUnreadyQueue(tabId) {
  const unreadyQueue = await getUnreadyQueue();
  console.log("Flushing " + unreadyQueue.get(tabId)?.length + " messages from unready queue for newly ready tab " + tabId);
  for (const msg of unreadyQueue.get(tabId) ?? []) {
    console.log("Sending message to newly ready tab " + tabId);
    send(tabId, msg);
  }

  unreadyQueue.delete(tabId);
  await setUnreadyQueue(unreadyQueue);
}

function send(tabId, msg) {
  chrome.tabs.sendMessage(tabId, msg);
}

function appendToPromiseChain(func, name) {
  // promiseChain = promiseChain.then(func);
  promiseChain = promiseChain.then(async () => {
    console.log("Running in promise chain: " + name);
    await func();
    console.log("Finished running in promise chain: " + name);
  });
  return promiseChain;
}
