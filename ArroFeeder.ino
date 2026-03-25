// Smart Pet Feeder Firmware for ESP32
// Connects to Firebase Realtime Database to check for feeding commands and schedules.

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <Servo.h>

// WiFi credentials
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Firebase project configuration
#define API_KEY "YOUR_FIREBASE_API_KEY"
#define DATABASE_URL "YOUR_FIREBASE_DATABASE_URL"

// User Email and Password for Firebase Authentication
#define USER_EMAIL "YOUR_EMAIL"
#define USER_PASSWORD "YOUR_PASSWORD"

// Define Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Variables to hold database paths
String feed_now_path = "/petfeeder/feed_now";
String last_feed_path = "/petfeeder/last_feed";
String schedule_path = "/petfeeder/schedule";
String food_level_path = "/petfeeder/food_level";

// Servo motor setup
Servo dispenserServo;
const int servoPin = 18; // GPIO 18

// Ultrasonic sensor setup for food level
const int trigPin = 5; // GPIO 5
const int echoPin = 17; // GPIO 17
float containerHeight = 20.0; // Height of the food container in cm

// Time tracking for schedule
unsigned long previousMillis = 0;
const long interval = 60000; // Check every minute

void setup() {
    Serial.begin(115200);

    // Initialize Servo and set to closed position
    dispenserServo.attach(servoPin);
    dispenserServo.write(0); // 0 degrees = closed

    // Initialize Ultrasonic Sensor pins
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);

    // Connect to WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("Connecting to Wi-Fi");
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(300);
    }
    Serial.println();
    Serial.print("Connected with IP: ");
    Serial.println(WiFi.localIP());
    Serial.println();

    // Configure Firebase
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;

    // Assign the callback function for the token status
    config.token_status_callback = tokenStatusCallback;

    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    // Set up stream callbacks for real-time updates
    if (!Firebase.RTDB.beginStream(&fbdo, "/petfeeder")) {
        Serial.println("------------------------------------");
        Serial.println("Can't begin stream connection...");
        Serial.println("REASON: " + fbdo.errorReason());
        Serial.println("------------------------------------");
    }
}

void loop() {
    // This is where we handle real-time database events
    if (Firebase.RTDB.readStream(&fbdo)) {
        if (fbdo.streamAvailable()) {
            // Check if the change happened on the 'feed_now' path
            if (fbdo.dataPath() == "/feed_now" && fbdo.dataType() == "boolean" && fbdo.boolData() == true) {
                Serial.println("Feed Now command received!");
                dispenseFood();
            }
            // Check if schedule has been updated
            if (fbdo.dataPath().startsWith("/schedule")) {
                Serial.println("Schedule data updated.");
                // The logic to check the schedule is handled by time below
            }
        }
    }

    // Handle scheduled feeding and food level check periodically
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= interval) {
        previousMillis = currentMillis;
        checkSchedule();
        updateFoodLevel();
    }
}

// Dispenses food by rotating the servo
void dispenseFood() {
    Serial.println("Dispensing food...");
    dispenserServo.write(90); // Rotate to 90 degrees to open
    delay(1000);             // Keep open for 1 second
    dispenserServo.write(0);  // Rotate back to 0 degrees to close
    Serial.println("Dispensing complete.");

    // Reset the feed_now flag in Firebase
    if (Firebase.RTDB.setBool(&fbdo, feed_now_path, false)) {
        Serial.println("Reset feed_now flag in Firebase.");
    } else {
        Serial.println("Failed to reset feed_now flag: " + fbdo.errorReason());
    }

    // Update the last_feed timestamp in Firebase
    if (Firebase.RTDB.setTimestamp(&fbdo, last_feed_path)) {
        Serial.println("Updated last_feed timestamp.");
    } else {
        Serial.println("Failed to update last_feed timestamp: " + fbdo.errorReason());
    }
}

// Checks if the current time matches the scheduled feeding time
void checkSchedule() {
    Serial.println("Checking schedule...");
    if (Firebase.RTDB.get(&fbdo, schedule_path)) {
        if (fbdo.dataType() == "json") {
            FirebaseJson &json = fbdo.jsonObject();
            bool enabled;
            int hour, minute;
            FirebaseJsonData result;
            
            json.get(result, "enabled");
            if (result.success) enabled = result.to<bool>();

            json.get(result, "hour");
            if (result.success) hour = result.to<int>();

            json.get(result, "minute");
            if (result.success) minute = result.to<int>();

            if (enabled) {
                // We need a way to get current time. For ESP32, this is usually done with an NTP client.
                // For simplicity, we'll assume we have access to time.
                // This part requires an NTP time library like "NTPClient.h"
                // For now, this is a placeholder for actual time checking logic.
                Serial.printf("Schedule is enabled for %02d:%02d. Time checking logic is a TODO.\n", hour, minute);

                // --- PSEUDO-CODE for real implementation ---
                // timeClient.update();
                // int currentHour = timeClient.getHours();
                // int currentMinute = timeClient.getMinutes();
                // if (currentHour == hour && currentMinute == minute) {
                //   dispenseFood();
                // }
            } else {
                Serial.println("Schedule is disabled.");
            }
        }
    } else {
        Serial.println("Failed to get schedule: " + fbdo.errorReason());
    }
}

// Measures the distance using the ultrasonic sensor and updates food level
void updateFoodLevel() {
    long duration;
    float distance, levelPercentage;

    // Trigger the sensor
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Read the echo
    duration = pulseIn(echoPin, HIGH);
    distance = duration * 0.034 / 2; // Speed of sound wave divided by two

    if (distance >= containerHeight || distance <= 0) {
        levelPercentage = 0;
    } else {
        levelPercentage = 100.0 - ((distance / containerHeight) * 100.0);
    }
    
    int foodLevel = (int)levelPercentage;
    if (foodLevel < 0) foodLevel = 0;
    if (foodLevel > 100) foodLevel = 100;
    
    Serial.printf("Food Level: %d%%\n", foodLevel);

    // Update food level in Firebase
    if (Firebase.RTDB.setInt(&fbdo, food_level_path, foodLevel)) {
         Serial.println("Updated food level in Firebase.");
    } else {
        Serial.println("Failed to update food level: " + fbdo.errorReason());
    }
}
