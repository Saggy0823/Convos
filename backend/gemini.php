<?php
// backend/gemini.php
// This file handles interaction with the Google Gemini API for chat responses.

header('Content-Type: application/json');

// Get POST data from the frontend
$userInput = $_POST['userInput'] ?? '';
$language = $_POST['language'] ?? 'en-US'; // Default to English
// User-provided API Key for Gemini.
// IMPORTANT: For production, store this securely (e.g., environment variables, config.php outside web root).
$apiKey = 'AIzaSyBGqg6gaWBImHtvrGk9IJlPNq_wErCwMag'; // <<< !!! IMPORTANT: REPLACE THIS WITH YOUR ACTUAL GEMINI API KEY !!!

// Basic validation for input and API key
if (empty($userInput)) {
    echo json_encode(['error' => 'No user input provided.']);
    exit;
}
if (empty($apiKey) || $apiKey === 'YOUR_GEMINI_API_KEY') {
    echo json_encode(['error' => 'Gemini API Key not configured in backend/gemini.php. Please replace "YOUR_GEMINI_API_KEY" with your actual key.']);
    exit;
}

// Determine the prompt based on language and desired AI behavior
// The prompt instructs Gemini to first correct grammar and then provide a conversational response.
// It also defines a specific output format for easier parsing on the frontend.
$promptTemplate = "You are a friendly and encouraging language partner. The user is practicing either Hindi or English.
Your primary tasks are:
1.  **Correct Grammar:** If the user's sentence has grammatical errors or unnatural phrasing, provide the corrected version.
2.  **Explain Briefly:** If you made a correction, give a very brief explanation of *why* it was corrected (e.g., \"tense correction\", \"word order\"). If no correction is needed, state that the original sentence was correct.
3.  **Conversational Response:** Provide a friendly, natural, and concise conversational response to the user's input, engaging them further.

Output your response in the exact following JSON-like format to facilitate parsing:
CORRECTED: [corrected or original sentence] (Explanation: [brief explanation or \"None\"])
RESPONSE: [your conversational response]

Example if correction is needed:
CORRECTED: I am going to the store. (Explanation: Subject-verb agreement)
RESPONSE: That's great! What are you planning to buy there?

Example if no correction is needed:
CORRECTED: I went to the park. (Explanation: None)
RESPONSE: Oh, how wonderful! Did you have a good time?

Now, please respond to: \"%s\"";

$prompt = sprintf($promptTemplate, $userInput);

// Gemini API Endpoint for text generation
$geminiApiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" . $apiKey;

// Payload for the Gemini API request
$payload = [
    'contents' => [
        [
            'role' => 'user',
            'parts' => [
                ['text' => $prompt]
            ]
        ]
    ],
    'generationConfig' => [
        'temperature' => 0.7, // Creativity and randomness
        'topP' => 0.95,       // Nucleus sampling
        'topK' => 40,         // Top-k sampling
        'maxOutputTokens' => 200, // Increased max tokens slightly for longer responses
    ],
    // 'safetySettings' can be added here if you want to override defaults
];

// Initialize cURL session to send the request to Gemini API
$ch = curl_init($geminiApiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Return the response as a string
curl_setopt($ch, CURLOPT_POST, true);         // Set as POST request
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload)); // Attach JSON payload
curl_setopt($ch, CURLOPT_HTTPHEADER, [         // Set necessary headers
    'Content-Type: application/json',
    'Accept: application/json'
]);

// Execute the cURL request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE); // Get HTTP status code

// Check for cURL errors (e.g., network issues)
if (curl_errno($ch)) {
    echo json_encode(['error' => 'cURL Error: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}
curl_close($ch); // Close cURL session

// Handle non-200 HTTP responses from Gemini API (e.g., API key invalid, quota exceeded)
if ($httpCode !== 200) {
    error_log("Gemini API HTTP Error: " . $httpCode . " Response: " . $response);
    echo json_encode(['error' => 'Gemini API request failed with HTTP code ' . $httpCode, 'details' => $response]);
    exit;
}

// Decode the JSON response received from Gemini
$responseData = json_decode($response, true);

// Check for JSON decoding errors from Gemini's response
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("Invalid JSON response from Gemini API: " . json_last_error_msg() . " - Raw: " . $response);
    echo json_encode(['error' => 'Invalid JSON response from Gemini API: ' . json_last_error_msg(), 'rawResponse' => $response]);
    exit;
}

// Extract the text content from Gemini's response structure
$geminiText = '';
if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
    $geminiText = $responseData['candidates'][0]['content']['parts'][0]['text'];
} else {
    // Log unexpected response structure for debugging
    error_log("Unexpected Gemini API response format: " . print_r($responseData, true));
    echo json_encode(['error' => 'Unexpected Gemini API response format.', 'response' => $responseData]);
    exit;
}

// Parse the structured response from Gemini using regex
$correctedText = '';
$conversationalResponse = '';
$correctionExplanation = '';

// Regex to capture CORRECTED, optional Explanation, and RESPONSE parts
// Using /s modifier for dot to match newlines
if (preg_match('/CORRECTED: (.*?)(?:\s+\(Explanation: (.*?)\))?\s+RESPONSE: (.*)/s', $geminiText, $matches)) {
    $correctedText = trim($matches[1]);
    $correctionExplanation = trim($matches[2] ?? ''); // Null coalescing operator for optional group
    $conversationalResponse = trim($matches[3]);
} else {
    // Fallback if parsing fails: treat AI's full response as conversational
    $correctedText = $userInput; // Assume original was the one if parsing failed
    $conversationalResponse = $geminiText;
    $correctionExplanation = 'Could not parse AI response format. Raw: ' . substr($geminiText, 0, 100) . '...'; // Indicate parsing issue and show snippet
    error_log("Failed to parse Gemini response with regex. Full response: " . $geminiText);
}

// Send the parsed data back to the frontend
echo json_encode([
    'correctedText' => $correctedText,
    'conversationalResponse' => $conversationalResponse,
    'correctionExplanation' => $correctionExplanation
]);

// NO CLOSING PHP TAG (?>) HERE! THIS IS CRUCIAL FOR PURE JSON OUTPUT.