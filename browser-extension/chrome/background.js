console.log("Background process started!");

// enqueueCriticalSection() uses this to sequence loads and stores to avoid races
let promiseChain = Promise.resolve();

// Don't send messages to tabs before they are ready; queue them up instead.
// Can't just store readyTabs and unreadyQueue in global vars, since those disappear after 30s
// of inactivity: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle#idle-shutdown
async function getReadyTabs() /*: Set<string> */ {
  const fromStorage = await chrome.storage.session.get('readyTabs');
  return new Set(fromStorage?.readyTabs ?? []);
}

async function setReadyTabs(readyTabs /*: Set<string> */) {
  await chrome.storage.session.set({ readyTabs: [...readyTabs] }); // Store as array since chrome.storage can't handle Sets
}

async function getUnreadyQueue() /*: Map<number, string[]> */ {
  const fromStorage = await chrome.storage.session.get('unreadyQueue');
  return new Map(fromStorage?.unreadyQueue ?? []);
}

async function setUnreadyQueue(unreadyQueue /*: Map<number, string[]> */) {
  await chrome.storage.session.set({ unreadyQueue: [...unreadyQueue.entries()] }); // Store as array of pairs since chrome.storage can't handle Maps
}

async function responseUrls(details) {
  if (details.type != null && details.method != null && details.requestId != null){
    console.log("Saw HTTP request: " + JSON.stringify(details));		//DEBUG

    const provIdInfo = details.responseHeaders.find((h) => h.name === 'provenance-id');
    if (provIdInfo) {
      if (details.type === 'main_frame') {
        // A top-level frame load means we need to start queueing messages until the page indicates it's ready
        await enqueueCriticalSection(async () => {
          const unreadyQueue = await getUnreadyQueue();
          const readyTabs = await getReadyTabs();
          const existingQueue = unreadyQueue.get(details.tabId) ?? []
          console.log("Top-level frame load: Tab previously " + (readyTabs.has(details.tabId) ? "ready" : "not ready") + ". Will drop " + (unreadyQueue.get(details.tabId) ?? []).length + " queued messages.");
          unreadyQueue.delete(details.tabId);
          await setUnreadyQueue(unreadyQueue);
          readyTabs.delete(details.tabId);
          await setReadyTabs(readyTabs);
        });
      }
  
      await enqueueCriticalSection(() => sendOrQueue(details.tabId, { type: "responseHeader", details: { url: details.url, provId: provIdInfo.value, method: details.method, type: details.type } }));
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
    await enqueueCriticalSection(async () => {
      const readyTabs = await getReadyTabs();
      readyTabs.add(sender.tab.id);
      await setReadyTabs(readyTabs);
      await flushUnreadyQueue(sender.tab.id);
    });
  }
});

const contextMenu = chrome.contextMenus.create({
  title: 'View provenance',
  id: 'viewProvenance'
});

chrome.contextMenus.onClicked.addListener(async (clickInfo, tab) => {
  console.log(`Context menu clicked!`);
  await enqueueCriticalSection(() => sendOrQueue(tab.id, { type: "contextMenuClicked", details: {} }));
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

// A way to make a "critical section" that can span async calls. Needed to avoid races with (async) chrome.storage loads and stores.
// For any 2 calls to this function, the argument functions will be executed in non-overlapping fashion.
// The promise chain conceptually grows forever, so if settled promises in a promise chain are not GCed, this is a memory leak. But:
// (a) empirically they are GCed so long as the event loop iteration finishes between calls
// (b) an implementation pf promises that does not GC them is arguably broken by design
function enqueueCriticalSection(funcReturningPromise) {
  promiseChain = promiseChain.then(funcReturningPromise);
  return promiseChain;
}
