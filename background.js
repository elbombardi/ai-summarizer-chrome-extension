// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // This extension now only handles one action: getVideoTranscript
    if (request.action !== 'getVideoTranscript') {
        return true; // Ignore other requests
    }

    (async () => {
        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                sendResponse({ error: "Gemini API key is not configured." });
                return;
            }

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Ensure we are on a YouTube video page
            if (!tab.url || !tab.url.includes("youtube.com/watch")) {
                sendResponse({ error: "This extension only works on YouTube video pages." });
                return;
            }
            
            // Inject the content script to get the transcript's baseUrl
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // Request the transcriptBaseUrl from the content script
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoTranscript' });

            // Check if the baseUrl was successfully retrieved
            if (!contentResponse || !contentResponse.transcriptBaseUrl || contentResponse.transcriptBaseUrl.trim() === '') {
                 sendResponse({ error: "Could not find a transcript URL. Please ensure captions are available for this video." });
                 return;
            }

            // Fetch the XML transcript using the baseUrl
            const xmlTranscript = await fetchXmlTranscript(contentResponse.transcriptBaseUrl);

            // Parse the XML and get the full text
            const fullTranscript = parseXmlTranscript(xmlTranscript);

            if (!fullTranscript || fullTranscript.trim() === '') {
                sendResponse({ error: "Failed to extract text from the transcript. It might be empty or malformed." });
                return;
            }

            const summary = await getGeminiSummary(fullTranscript, apiKey);
            sendResponse({ summary: summary });

        } catch (e) {
            console.error("Error in background.js:", e);
            sendResponse({ error: e.message });
        }
    })();
    
    // Indicates that the response will be sent asynchronously.
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

// Function to fetch the XML transcript from the baseUrl
async function fetchXmlTranscript(baseUrl) {
    const response = await fetch(baseUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch transcript XML: ${response.statusText}`);
    }
    return response.text();
}

// Function to parse the XML transcript content
function parseXmlTranscript(xmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    const textNodes = xmlDoc.querySelectorAll('text');
    let fullTranscript = "";

    textNodes.forEach(node => {
        // Unescape HTML entities (like &amp; &lt;) and append text
        const decodedText = decodeHtmlEntities(node.textContent || '');
        fullTranscript += decodedText.trim() + " ";
    });

    return fullTranscript.trim();
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}


// Function to call the Gemini API
// The 'input' parameter is always the transcript text
async function getGeminiSummary(transcriptText, apiKey) {
    const model = 'gemini-2.5-pro'; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Summarize the following YouTube video transcript in English. Highlight the key points as a bulleted list. Keep the summary concise and informative:\n\n` + transcriptText.substring(0, 30000); // Truncate to be safe
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
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
           throw new Error("The model did not return a summary. The content may be blocked or inaccessible.");
       }
       return text;
    } catch(e) {
       console.error("Unexpected API response structure:", data);
       throw new Error(e.message || "The API response was invalid.");
    }
}

