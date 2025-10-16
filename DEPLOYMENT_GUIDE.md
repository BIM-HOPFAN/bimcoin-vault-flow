# Bimcoin Wallet - Multi-Platform Deployment Guide

This guide covers deploying your Bimcoin wallet to PWA (installable web app), Telegram Mini App, Google Play Store, and Apple App Store.

## 📱 Platform 0: Progressive Web App (PWA) - EASIEST & FASTEST

### What is PWA?
Your app is now a PWA, which means users can install it directly from their browser to their home screen like a native app, without going through app stores.

### Features
✅ Works offline with cached data
✅ Install from browser (no app store needed)
✅ Works on ALL devices (iPhone, Android, Desktop)
✅ Automatic updates when you publish changes
✅ Fast loading with service worker caching
✅ Looks and feels like a native app
✅ Push notifications support (can be added)

### How Users Install

#### On Mobile (iOS/Android):
1. Visit https://bimlight.org in Safari (iOS) or Chrome (Android)
2. Tap the Share/Menu button
3. Select "Add to Home Screen"
4. App appears on home screen like a native app

#### On Desktop:
1. Visit https://bimlight.org in Chrome, Edge, or other supported browsers
2. Look for the install icon (⊕) in the address bar
3. Click "Install"
4. App opens in its own window

### No Submission Required
- No app store review process
- No waiting period
- No annual fees
- Instant updates to all users

---

## 🚀 Platform 1: Telegram Mini App

### Prerequisites
- Telegram Bot created via [@BotFather](https://t.me/botfather)
- Bot token from BotFather

### Setup Steps

1. **Create a Telegram Bot**
   ```
   Open Telegram and message @BotFather
   Send: /newbot
   Follow prompts to create your bot
   Save the bot token you receive
   ```

2. **Configure Mini App**
   ```
   Message @BotFather again
   Send: /newapp
   Select your bot
   Provide app details:
   - Title: Bimcoin
   - Description: Earn BIM on TON Network
   - Photo: Upload your app icon
   - Web App URL: https://bimlight.org
   ```

3. **Set Menu Button (Optional)**
   ```
   Send: /setmenubutton
   Select your bot
   Provide button text: "Open Wallet"
   Provide Web App URL: https://bimlight.org
   ```

4. **Test Your Mini App**
   - Open your bot in Telegram
   - Click the menu button or use the Mini App link
   - The app will open within Telegram with full TON Connect support

### Features Available in Telegram
✅ Full wallet functionality
✅ TON Connect integration
✅ Telegram theme adaptation
✅ Native Telegram UI feel
✅ No app store approval needed
✅ Instant updates

---

## 📱 Platform 2 & 3: Google Play Store & Apple App Store

### Prerequisites
- Mac computer with Xcode (for iOS)
- Android Studio (for Android)
- Google Play Developer account ($25 one-time fee)
- Apple Developer account ($99/year)

### Step 1: Transfer to GitHub
1. Click "Export to GitHub" in Lovable
2. Clone your repository locally:
   ```bash
   git clone [your-repo-url]
   cd [your-repo-name]
   ```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Add Native Platforms

For Android:
```bash
npx cap add android
npx cap update android
```

For iOS:
```bash
npx cap add ios
npx cap update ios
```

### Step 4: Build the Web Assets
```bash
npm run build
```

### Step 5: Sync with Native Projects
```bash
npx cap sync
```

### Step 6: Configure App Icons and Splash Screens

#### For Android:
1. Generate icons using [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/)
2. Place in `android/app/src/main/res/` directories
3. Update `android/app/src/main/AndroidManifest.xml`

#### For iOS:
1. Open Xcode: `npx cap open ios`
2. Select `App` in project navigator
3. Click on `App` under TARGETS
4. Go to "App Icons and Launch Screen"
5. Add your icon assets

### Step 7: Update App Configuration

#### Android (`android/app/build.gradle`):
```gradle
android {
    defaultConfig {
        applicationId "app.lovable.db23b08d08a24e7eb6486f394e9e12c2"
        versionCode 1
        versionName "1.0.0"
    }
}
```

#### iOS (Xcode):
1. Open project: `npx cap open ios`
2. Select your app target
3. Update:
   - Bundle Identifier: `app.lovable.db23b08d08a24e7eb6486f394e9e12c2`
   - Version: 1.0.0
   - Build: 1

### Step 8: Build and Test

#### For Android:
```bash
npx cap run android
```
This opens Android Studio where you can:
- Test on emulator or physical device
- Generate signed APK/AAB for Play Store

#### For iOS:
```bash
npx cap run ios
```
This opens Xcode where you can:
- Test on simulator or physical device
- Archive for App Store submission

### Step 9: Prepare for Store Submission

#### Google Play Store:
1. Build signed AAB (Android App Bundle)
2. Create a Google Play Console account
3. Create new app listing
4. Upload AAB and fill in:
   - App description
   - Screenshots
   - Privacy policy: https://bimlight.org/privacy
   - Content rating
5. Submit for review

#### Apple App Store:
1. Archive app in Xcode
2. Validate the archive
3. Upload to App Store Connect
4. Create new app in App Store Connect
5. Fill in app details:
   - App description
   - Screenshots
   - Privacy policy: https://bimlight.org/privacy
   - App categories
6. Submit for review

### Important Notes for Mobile

⚠️ **Production URL**: Before building for production, update `capacitor.config.ts`:
```typescript
server: {
  url: 'https://bimlight.org',
  cleartext: true
},
```

⚠️ **Testing During Development**: The current config uses the Lovable sandbox URL for hot-reload during development. Change this before building for production.

⚠️ **App Store Guidelines**:
- Google Play: Allow 1-7 days for review
- Apple App Store: Allow 1-3 days for review
- Both may require additional information during review

---

## 🎯 Quick Comparison

| Feature | PWA | Telegram Mini App | Play Store | App Store |
|---------|-----|------------------|------------|-----------|
| Setup Time | Ready now! | 10 minutes | 2-3 days | 2-3 days |
| Cost | Free | Free | $25 one-time | $99/year |
| Review Process | None | None | 1-7 days | 1-3 days |
| Updates | Instant | Instant | Hours | 1-3 days |
| TON Integration | Full | Native | Full | Full |
| Distribution | Direct URL | Bot link | Play Store | App Store |
| Works Offline | ✅ Yes | Limited | ✅ Yes | ✅ Yes |
| Installation | Browser | In Telegram | App Store | App Store |

## 📞 Support

- **PWA**: Already live! Just share your URL
- **Telegram**: Best for quick deployment and testing
- **Native Apps**: Best for official store presence and advanced features

Need help? Check the [Capacitor Documentation](https://capacitorjs.com/docs) or [Telegram Bot API](https://core.telegram.org/bots/webapps).
