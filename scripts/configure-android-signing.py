from pathlib import Path
import os
import sys

path = Path("android/app/build.gradle")
text = path.read_text()
if "signingConfigs.stableUpdate" not in text:
    block = """
if (System.getenv("ANDROID_KEYSTORE_PATH")) {
    android {
        signingConfigs {
            stableUpdate {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
        buildTypes {
            debug { signingConfig signingConfigs.stableUpdate }
        }
    }
}
"""
    path.write_text(text + "\n" + block)
print("Stable Android signing configuration added.")
