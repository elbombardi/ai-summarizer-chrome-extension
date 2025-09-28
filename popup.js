document.addEventListener('DOMContentLoaded', () => {
    const getVideoTranscriptBtn = document.getElementById('getVideoTranscriptBtn');
    const summaryDiv = document.getElementById('summary');
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

    // Load saved API key
    chrome.storage.sync.get('apiKey', (data) => {
        if (data.apiKey) {
            apiKeyInput.value = data.apiKey;
        }
    });

    // Save API key
    saveApiKeyBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.sync.set({ 'apiKey': apiKey }, () => {
                alert('API Key saved.');
            });
        }
    });

    getVideoTranscriptBtn.addEventListener('click', () => {
        summaryDiv.textContent = 'Summarizing...';
        chrome.runtime.sendMessage({ action: 'getVideoTranscript' }, (response) => {
            if (response.error) {
                summaryDiv.textContent = `Error: ${response.error}`;
            } else if (response.summary) {
                summaryDiv.textContent = response.summary;
            } else {
                summaryDiv.textContent = 'Failed to get a summary.';
            }
        });
    });
});

