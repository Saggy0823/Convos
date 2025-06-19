<?php
// backend/data_handler.php
// This file handles loading and saving user settings.

header('Content-Type: application/json');

// Define the path to your data file
$dataFile = __DIR__ . '/saved_data.txt';

// Ensure the backend directory exists and is writable
if (!is_dir(__DIR__)) {
    mkdir(__DIR__, 0755, true);
}
// Create the file with an empty JSON object if it doesn't exist
if (!file_exists($dataFile)) {
    // Attempt to create the file and set initial content
    if (file_put_contents($dataFile, '{}') === false) {
        // Log error if file creation fails
        error_log("Failed to create saved_data.txt at " . $dataFile . ". Check directory permissions.");
        echo json_encode(['error' => 'Server configuration error: Could not create data file.']);
        exit;
    }
    // Set appropriate permissions for the file
    chmod($dataFile, 0644); 
}


// Function to safely return a JSON error response and exit
function returnError($message, $details = null) {
    $response = ['error' => $message];
    if ($details !== null) {
        $response['details'] = $details;
    }
    echo json_encode($response);
    exit;
}

// Function to load settings from the file
function loadSettingsFromFile($filePath) {
    $data = file_get_contents($filePath);
    if ($data === false) {
        error_log("Failed to read data file: " . $filePath);
        return ['error' => 'Failed to read data file.'];
    }
    $settings = json_decode($data, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("Invalid JSON in data file ($filePath): " . json_last_error_msg() . " - Content: " . $data);
        // Attempt to fix corrupted file by writing default JSON, but alert user
        file_put_contents($filePath, json_encode(['userName' => 'there', 'userHobbies' => 'learning new things', 'partnerName' => 'Buddy'], JSON_PRETTY_PRINT), LOCK_EX);
        return ['error' => 'Corrupted data file. Resetting to default.'];
    }
    return $settings;
}

// Function to save settings to the file
function saveSettingsToFile($filePath, $settings) {
    $json = json_encode($settings, JSON_PRETTY_PRINT);
    if ($json === false) {
        return ['success' => false, 'error' => 'Failed to encode JSON: ' . json_last_error_msg()];
    }
    // Use LOCK_EX to prevent race conditions during file write
    if (file_put_contents($filePath, $json, LOCK_EX) === false) {
        error_log("Failed to write data to file: " . $filePath . " - Check file permissions.");
        return ['success' => false, 'error' => 'Failed to write to data file. Please check permissions.'];
    }
    return ['success' => true];
}

// Get the requested action
$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'load':
        $settings = loadSettingsFromFile($dataFile);
        // If there was an error loading, `loadSettingsFromFile` returns an array with 'error' key
        // Otherwise, it returns the decoded settings or an empty array if the file didn't exist initially.
        if (isset($settings['error'])) {
            echo json_encode($settings); // Echo the error message as JSON
        } else {
            // Ensure default values are returned if some fields are missing from the file
            $settings['userName'] = $settings['userName'] ?? 'there';
            $settings['userHobbies'] = $settings['userHobbies'] ?? 'learning new things';
            $settings['partnerName'] = $settings['partnerName'] ?? 'Buddy';
            echo json_encode($settings);
        }
        break;

    case 'save':
        // Sanitize and retrieve POST variables for saving
        $userName = $_POST['userName'] ?? '';
        $userHobbies = $_POST['userHobbies'] ?? '';
        $partnerName = $_POST['partnerName'] ?? '';

        $settingsToSave = [
            'userName' => $userName,
            'userHobbies' => $userHobbies,
            'partnerName' => $partnerName
        ];

        $result = saveSettingsToFile($dataFile, $settingsToSave);
        echo json_encode($result);
        break;

    default:
        // Respond with an error for unsupported actions
        returnError('Invalid or unsupported action.');
        break;
}
// NO CLOSING PHP TAG (?>) HERE! THIS IS CRUCIAL FOR PURE JSON OUTPUT.