// service_worker.js
let backgroundPageTabId = null;
let backgroundPageTabIdLoaded = false;
let messageQueue = [];

async function checkBackgroundPageIsOpen() {
  console.log("Ensuring background page is open", backgroundPageTabId);
  
  if (backgroundPageTabId !== null) {
    try {
      await chrome.tabs.get(backgroundPageTabId);
    } catch (error) {
      console.log("Background page tab no longer exists");
      backgroundPageTabId = null;
	  backgroundPageTabIdLoaded = false;
    }
  }
  return backgroundPageTabIdLoaded;
}

async function ensureBackgroundPageIsOpen() {
  console.log("Ensuring background page is open", backgroundPageTabId);
  
  if (backgroundPageTabId !== null) {
    try {
      await chrome.tabs.get(backgroundPageTabId);
    } catch (error) {
      console.log("Background page tab no longer exists");
      backgroundPageTabId = null;
	  backgroundPageTabIdLoaded = false;
    }
  }

  if (backgroundPageTabId === null) {
    try {
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL('../background.html'),
        active: false
      });
      backgroundPageTabId = tab.id;
      console.log("Background page created with ID:", backgroundPageTabId);

      // Wait a bit for the background page to initialize
      await new Promise(resolve => setTimeout(resolve, 200));
	  backgroundPageTabIdLoaded = true;
	  console.log("FINISHED WAITING FOR PAGE TO LOAD");
      // Process any queued messages
	  console.log(messageQueue);
      processMessageQueue();
    } catch (error) {
      console.error("Error ensuring background page is open:", error);
      throw error;
    }
  }
}

function processMessageQueue() {
  while (messageQueue.length > 0 && backgroundPageTabIdLoaded) {
    const { message, sendResponse } = messageQueue.shift();
    sendMessageToBackgroundPage(message, sendResponse);
  }
}

function sendMessageToBackgroundPage(message, sendResponse) {
	console.log("sending message", message);
  chrome.runtime.sendMessage(message.data, (response) => {
	  console.log("response",response);
    if (chrome.runtime.lastError) {
      console.error("Error sending message to background:", chrome.runtime.lastError);
      sendResponse({error: 'Failed to communicate with background page'});
    } else {
      sendResponse(response);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	
  if (message.type === 'toBackground') {
    console.log("SERVICE WORKER: ", message);
	
	 checkBackgroundPageIsOpen().then((isOpen) => {
		 console.log("iS OPEN? : " ,isOpen);
		if (!isOpen){
			ensureBackgroundPageIsOpen().then(() => {
			  if (backgroundPageTabIdLoaded) {
				sendMessageToBackgroundPage(message, sendResponse);
			  } else {
				// Queue the message if the background page is not ready
				messageQueue.push({ message, sendResponse });
			  }
			}).catch(error => {
			  console.error("Error ensuring background page is open:", error);
			  sendResponse({error: 'Failed to open background page'});
			});
		}
	 });
    
    return true; // Indicates that the response will be sent asynchronously
  }
});

// Ensure the background page is opened when the extension starts
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed, opening background page");
  ensureBackgroundPageIsOpen();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension starting up, opening background page");
  ensureBackgroundPageIsOpen();
});