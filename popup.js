// --- UI Elements ---
const summarizePageBtn = document.getElementById('summarizePage');
const summarizeVideoBtn = document.getElementById('summarizeVideo');
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKey');
const keyStatus = document.getElementById('keyStatus');

const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const summaryContainer = document.getElementById('summaryContainer');
const summaryDiv = document.getElementById('summary');

// --- UI Functions ---
function showLoading() {
    loadingDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    summaryContainer.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    loadingDiv.classList.add('hidden');
    errorDiv.classList.remove('hidden');
    summaryContainer.classList.add('hidden');
}

function showSummary(summaryText) {
    // A simple replacement to format the text a bit
    summaryDiv.innerHTML = summaryText.replace(/\n/g, '<br>');
    loadingDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');
    summaryContainer.classList.remove('hidden');
}

// --- API Key Logic ---
saveKeyBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        chrome.storage.sync.set({ apiKey: apiKey }, () => {
            keyStatus.classList.remove('hidden');
            setTimeout(() => keyStatus.classList.add('hidden'), 2000);
            apiKeyInput.value = ''; // Clear field for security
        });
    }
});

// Load the key on startup to check if it exists.
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('apiKey', (data) => {
    if (!data.apiKey) {
        showError("Please save your Gemini API key to get started.");
    }
  });
});


// --- Summarization Logic ---
summarizePageBtn.addEventListener('click', () => {
    handleSummarizeRequest('getPageContent');
});

summarizeVideoBtn.addEventListener('click', () => {
    handleSummarizeRequest('getVideoTranscript');
});


function handleSummarizeRequest(action) {
     showLoading();
    // Send a message to the background script to start the process
    chrome.runtime.sendMessage({ action: action }, (response) => {
        if (chrome.runtime.lastError) {
             // Handle communication errors
            showError("Communication error with the background script.");
            console.error(chrome.runtime.lastError);
            return;
        }

        if (response.error) {
            showError(response.error);
        } else if (response.summary) {
            showSummary(response.summary);
        } else {
            showError("An unknown error occurred.");
        }
    });
}

