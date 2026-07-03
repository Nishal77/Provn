// Background service worker — handles auth token storage and message passing.

export default defineBackground(() => {
  // Store auth token from web app (set when user connects extension)
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SET_AUTH_TOKEN') {
      chrome.storage.local.set({ authToken: message.token }, () => {
        sendResponse({ success: true })
      })
      return true
    }
    if (message.type === 'GET_AUTH_TOKEN') {
      chrome.storage.local.get('authToken', data => {
        sendResponse({ token: data.authToken ?? null })
      })
      return true
    }
    if (message.type === 'CLEAR_AUTH_TOKEN') {
      chrome.storage.local.remove('authToken', () => sendResponse({ success: true }))
      return true
    }
  })
})
