#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> 
#include <time.h>

/* ================= CREDENTIALS ================= */
const char* WIFI_SSID = "Greyhaus";
const char* WIFI_PASS = "Dollararro2025";
const char* API_KEY = "AIzaSyDwdYF-XFH2_MmYrOQyWcaz3iWFfQgdoMg";
const char* USER_EMAIL = "gavinamosj@gmail.com"; 
const char* USER_PASSWORD = "ArroFeeder123";

String idToken = ""; 

/* ================= PINS ================= */
const int IN1 = 27; 
const int BUTTON_PIN = 25; 
const int TRIG_PIN = 32; 
const int ECHO_PIN = 33; 

const float DIST_EMPTY = 14.65; 
const float DIST_FULL = 2.0;    

/* ================= GLOBALS ================= */
int lastTriggeredMinute = -1;
volatile bool physicalButtonFlag = false; 
unsigned long lastButtonTime = 0; 

// Forward Declarations
bool executeFeed();
bool firebaseLogin(); // <-- THE FIX IS HERE

void IRAM_ATTR handleButtonPress() {
  unsigned long currentTime = millis();
  if (currentTime - lastButtonTime > 1000) {
    physicalButtonFlag = true;
    lastButtonTime = currentTime;
  }
}

bool firebaseLogin() {
  Serial.println("\n[AUTH] Attempting Firebase Login...");
  HTTPClient http;
  String url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + String(API_KEY);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  String payload = "{\"email\":\"" + String(USER_EMAIL) + "\",\"password\":\"" + String(USER_PASSWORD) + "\",\"returnSecureToken\":true}";
  
  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, response);
    idToken = doc["idToken"].as<String>();
    Serial.println("[AUTH] Success: Token acquired.");
    http.end();
    return true;
  } else {
    Serial.print("[AUTH] Error: Login failed with code ");
    Serial.println(httpCode);
    http.end();
    return false;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n====================================");
  Serial.println("      ARROFEEDER SYSTEM BOOT      ");
  Serial.println("====================================");

  pinMode(IN1, OUTPUT); digitalWrite(IN1, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLDOWN);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), handleButtonPress, RISING);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);

  Serial.print("[WIFI] Connecting to "); Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { 
    delay(500); 
    Serial.print("."); 
  }
  Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());

  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
  Serial.println("[TIME] Synchronizing with NTP...");

  while (!firebaseLogin()) { 
    Serial.println("[AUTH] Retry in 5s...");
    delay(5000); 
  }
  Serial.println("====================================\n");
}

void loop() {
  static unsigned long lastCheck = 0;
  static unsigned long lastUltrasonic = 0;

  if (physicalButtonFlag) { 
    physicalButtonFlag = false; 
    Serial.println("\n[INPUT] Physical Button Pressed!");
    executeFeed(); 
  }

  if (WiFi.status() == WL_CONNECTED && millis() - lastCheck > 2000) {
    lastCheck = millis();
    syncWithFirebase();
  } else if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi Connection Lost!");
  }

  if (millis() - lastUltrasonic > 10000) {
    lastUltrasonic = millis();
    readAndUploadUltrasonic();
  }
}

void syncWithFirebase() {
  HTTPClient http;
  String url = "https://studio-9181352265-1f5a4-default-rtdb.asia-southeast1.firebasedatabase.app/petfeeder.json?auth=" + idToken;
  http.begin(url);
  
  int code = http.GET();
  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<1024> doc;
    deserializeJson(doc, payload);

    if (doc["feed_now"] == true) {
      Serial.println("\n[WEB] Remote Feed Triggered via Dashboard!");
      if (executeFeed()) {
        HTTPClient patchHttp;
        patchHttp.begin(url);
        patchHttp.addHeader("Content-Type", "application/json");
        int patchCode = patchHttp.PATCH("{\"feed_now\":false}");
        if(patchCode == 200) {
          Serial.println("[DATABASE] feed_now flag reset to false.");
        } else {
          Serial.print("[ERROR] Failed to reset feed_now flag. Code: "); Serial.println(patchCode);
        }
        patchHttp.end();
      } else {
        Serial.println("[WEB] Feed execution failed. Will retry on next cycle.");
      }
    }

    struct tm ti;
    if (doc["schedule"]["enabled"] == true && getLocalTime(&ti)) {
      if (ti.tm_hour == (int)doc["schedule"]["hour"] && 
          ti.tm_min == (int)doc["schedule"]["minute"] && 
          ti.tm_min != lastTriggeredMinute) {
        
        lastTriggeredMinute = ti.tm_min;
        Serial.print("\n[SCHEDULE] Feeding Arro at ");
        Serial.print(ti.tm_hour); Serial.print(":"); Serial.println(ti.tm_min);
        executeFeed();
      }
    }
  } else if (code == 401) { 
    Serial.println("[AUTH] Token expired. Re-authenticating...");
    firebaseLogin(); 
  } else {
    Serial.print("[SYNC] Database Error. Code: "); Serial.println(code);
  }
  http.end();
}

void readAndUploadUltrasonic() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);
  if (duration == 0) {
    Serial.println("[SENSOR] Error: No pulse detected from HC-SR04.");
    return;
  }
  
  float distanceCm = duration * 0.034 / 2;
  int foodPercent = map(constrain(distanceCm, DIST_FULL, DIST_EMPTY) * 100, DIST_EMPTY * 100, DIST_FULL * 100, 0, 100);

  Serial.print("[SENSOR] Food Level: ");
  Serial.print(foodPercent); Serial.print("% (");
  Serial.print(distanceCm); Serial.println(" cm)");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "https://studio-9181352265-1f5a4-default-rtdb.asia-southeast1.firebasedatabase.app/petfeeder.json?auth=" + idToken;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int patchCode = http.PATCH("{\"food_level\":" + String(foodPercent) + "}");
    if (patchCode != 200) {
      Serial.print("[SENSOR] Upload Error: "); Serial.println(patchCode);
    }
    http.end();
  }
}

bool executeFeed() {
  Serial.println("[MOTOR] SPINNING... Feeding Arro.");
  digitalWrite(IN1, HIGH); 
  delay(100); 
  digitalWrite(IN1, LOW);
  Serial.println("[MOTOR] STOPPED.");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] Cannot update timestamp, WiFi disconnected.");
    return false;
  }

  struct tm ti;
  if (!getLocalTime(&ti, 10000)) { // 10 second timeout
      Serial.println("[ERROR] Cannot update timestamp, failed to get local time.");
      return false;
  }

  HTTPClient putHttp;
  String url = "https://studio-9181352265-1f5a4-default-rtdb.asia-southeast1.firebasedatabase.app/petfeeder/last_feed.json?auth=" + idToken;
  putHttp.begin(url);
  putHttp.addHeader("Content-Type", "application/json");
  
  long long timestamp = (long long)time(nullptr) * 1000;
  int putCode = putHttp.PUT(String(timestamp));
  putHttp.end();

  if (putCode == 200) {
    Serial.println("[DATABASE] last_feed timestamp updated.");
    return true; // Success!
  } else {
    Serial.print("[ERROR] last_feed update failed. Code: "); Serial.println(putCode);
    if (putCode == 401) { firebaseLogin(); } // Re-authenticate if token was the issue
    return false; // Failure!
  }
}
