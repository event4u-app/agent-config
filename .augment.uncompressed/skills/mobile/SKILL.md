---
name: mobile
description: "Use when writing mobile applications with React Native or Swift — platform conventions, navigation patterns, and best practices."
---

# mobile

## When to use

Use this skill when working with mobile applications — React Native or native iOS (Swift).

## React Native

### Before writing code

1. **Check React Native version** — `package.json`.
2. **Check navigation** — React Navigation, Expo Router.
3. **Check state management** — Redux, Zustand, Context, React Query.
4. **Check UI library** — NativeBase, React Native Paper, custom components.
5. **Check Expo vs bare** — `app.json` (Expo) or `ios/`+`android/` (bare).

### Component structure

```tsx
import { View, Text, StyleSheet, Pressable } from 'react-native'

interface UserCardProps {
  user: User
  onPress: () => void
}

export function UserCard({ user, onPress }: UserCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 8, backgroundColor: '#fff' },
  name: { fontSize: 16, fontWeight: '600' },
  email: { fontSize: 14, color: '#666' },
})
```

### Core rules

- Use **functional components** with hooks.
- Use **TypeScript** for all new files.
- Use **`StyleSheet.create()`** — not inline styles (performance).
- Use **`Pressable`** over `TouchableOpacity` (more flexible).
- Use **`FlatList`** for lists — not `ScrollView` with `.map()`.
- Handle **platform differences** with `Platform.OS` or `.ios.tsx`/`.android.tsx`.
- Test on **both platforms** — iOS and Android behavior can differ.

### Navigation

```tsx
// React Navigation
import { useNavigation } from '@react-navigation/native'

function HomeScreen() {
  const navigation = useNavigation()
  return (
    <Button onPress={() => navigation.navigate('Profile', { userId: 42 })} />
  )
}
```

### Performance

- Use `React.memo()` for list items.
- Use `useCallback` for event handlers passed to list items.
- Use `getItemLayout` on FlatList when item height is known.
- Avoid re-renders — profile with React DevTools or Flipper.
- Use `InteractionManager.runAfterInteractions()` for heavy work after animations.

## Swift (iOS)

### Before writing code

1. **Check Swift version** — Xcode project settings.
2. **Check UI framework** — SwiftUI or UIKit.
3. **Check architecture** — MVVM, MVC, or other.
4. **Check dependency manager** — SPM, CocoaPods, or Carthage.

### SwiftUI structure

```swift
struct UserCard: View {
    let user: User
    var onTap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(user.name)
                .font(.headline)
            Text(user.email)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .onTapGesture(perform: onTap)
    }
}
```

### Core rules

- Prefer **SwiftUI** for new views (iOS 15+).
- Use **`@State`** for local view state, **`@Binding`** for parent-owned state.
- Use **`@ObservedObject`** / **`@StateObject`** for view models.
- Use **`async/await`** for asynchronous operations.
- Follow **Swift naming conventions** — camelCase, descriptive names.
- Use **`guard`** for early returns.
- Use **value types** (`struct`) over reference types (`class`) when possible.

## Cross-platform rules

- **Offline support** — handle network failures gracefully.
- **Deep linking** — support URL schemes and universal links.
- **Accessibility** — add labels, hints, and traits for VoiceOver/TalkBack.
- **Permissions** — request only when needed, explain why.
- **App size** — minimize bundle size, lazy-load where possible.


## Auto-trigger keywords

- React Native
- Swift
- SwiftUI
- mobile app
- iOS
- Android

## Gotcha

- Don't mix React Native and Swift patterns — choose one per project.
- The model tends to use deprecated React Native APIs — always check the latest docs.
- iOS simulator and Android emulator behave differently — test on both platforms.

## Do NOT

- Do not use `ScrollView` + `.map()` for long lists — use `FlatList` (RN) or `List` (SwiftUI).
- Do not ignore platform differences — test on both iOS and Android.
- Do not store sensitive data in AsyncStorage/UserDefaults — use Keychain/EncryptedStorage.
- Do not block the main thread with heavy computation.
- Do not hardcode dimensions — use responsive layouts.
- Do not skip accessibility labels on interactive elements.
