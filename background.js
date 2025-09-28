// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Make the function asynchronous to use await
    (async () => {
        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                sendResponse({ error: "Gemini API key is not configured." });
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Both actions will now just send the URL to Gemini.
            if (request.action === 'getPageContent' || request.action === 'getVideoTranscript') {
                if (!tab.url || tab.url.startsWith('chrome://')) {
                    sendResponse({ error: "Cannot summarize special browser pages or local files." });
                    return;
                }
                const summary = await getGeminiSummary(tab.url, apiKey, request.action);
                sendResponse({ summary: summary });
            }

        } catch (e) {
            console.error("Error in background.js:", e);
            sendResponse({ error: e.message });
        }
    })();
    
    // Indicates that the response will be sent asynchronously
    return true; 
});


// Function to retrieve the API key from storage
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('apiKey', (data) => {
            resolve(data.apiKey);
        });
    });
}


// Function to call the Gemini API
// The 'input' parameter will now always be a URL
async function getGeminiSummary(url, apiKey, action) {
    const model = 'gemini-2.5-flash-preview-05-20';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let prompt;
    
    // We adjust the prompt based on the context for better results.
    if (action === 'getPageContent') {
        prompt = `Provide a concise and structured summary of the content found at this URL: ${url}. Start with a brief introductory sentence, then list the 3 to 5 most important points as a bulleted list.`;
    } else { // 'getVideoTranscript'
        prompt = `Summarize the YouTube video at this URL: ${url}. Your summary should be based on the video's spoken content (transcript). Highlight the key points as a bulleted list.`;
    }

    // The payload now always uses the Google Search tool to allow Gemini to fetch the URL.
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }], 
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error:", errorData);
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    try {
       // Check for text in the response
       const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
       if (!text) {
           console.error("No summary text found in API response:", data);
           throw new Error("The model did not return a summary. It might be unable to access the URL or the content may be blocked.");
       }
       return text;
    } catch(e) {
       console.error("Unexpected API response structure:", data);
       throw new Error(e.message || "The API response was invalid.");
    }
}

