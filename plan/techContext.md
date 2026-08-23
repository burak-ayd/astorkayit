# Teknik Bağlam

## Teknoloji Stack

### Core Framework
- **React Native**: 0.81.5
- **Expo**: ~54.0.20
- **React**: 19.1.0
- **Node.js**: Uyumlu sürüm

### Routing & Navigation
- **expo-router**: ~6.0.14
- **@react-navigation/native**: ^7.1.19
- **@react-navigation/native-stack**: ^7.6.2
- **@react-navigation/bottom-tabs**: ^7.7.3
- **react-native-gesture-handler**: ~2.28.0
- **react-native-reanimated**: ~4.1.1
- **react-native-screens**: ~4.16.0
- **react-native-safe-area-context**: ^5.6.2

### State Management
- **zustand**: ^5.0.8

### Veri Depolama
- **@react-native-async-storage/async-storage**: ^1.23.1

### Kamera & Galeri
- **expo-camera**: ~17.0.9
- **expo-image-picker**: ~17.0.8
- **expo-media-library**: ~18.2.0

### Tarih Seçimi
- **@react-native-community/datetimepicker**: ^8.0.1

### İkonlar
- **@expo/vector-icons**: ^15.0.3

### Diğer
- **expo-linking**: ~8.0.8
- **expo-splash-screen**: ~31.0.10
- **expo-status-bar**: ~3.0.8
- **expo-system-ui**: ~6.0.8
- **react-native-worklets**: 0.5.1

## Geliştirme Araçları
- **babel-plugin-module-resolver**: ^5.0.2

## Dosya Formatı
- **JSX** (JavaScript XML)
- **Expo Router** dosya tabanlı routing

## Platform Desteği
- **Android**: Desteklenir
- **iOS**: Desteklenir
- **Web**: Desteklenir (Expo Web)

## Proje Konfigürasyonu

### app.json
- Proje adı: AstorKayit
- Slug: AstorKayit
- Sürüm: 1.0.0
- Yönlendirme: portrait
- New Architecture: Etkin
- React Compiler: Etkin

### babel.config.js
- Module resolver eklentisi yapılandırılmış

### jsconfig.json
- Path aliasing yapılandırılmış

## Kurulum Adımları

### 1. Bağımlılıkları Yükle
```bash
yarn install
# veya
npm install
```

### 2. Geliştirme Sunucusunu Başlat
```bash
yarn start
```

### 3. Cihazda Çalıştır
```bash
# Android
yarn android

# iOS
yarn ios

# Web
yarn web
```

## Önemli Notlar

### Permissions (Android & iOS)
Aşağıdaki izinler gereklidir:
- **CAMERA**: Fotoğraf çekme
- **READ_EXTERNAL_STORAGE**: Galeriden seçme
- **WRITE_EXTERNAL_STORAGE**: Fotoğraf kaydetme

Bu izinler Expo tarafından otomatik olarak yönetilir.

### AsyncStorage Limitler
- Tipik limit: 10MB
- Veri JSON formatında saklanır
- Cihaz kapalı olsa da veriler kalıcıdır

### Resim Depolama
- Resimler URI olarak saklanır
- Expo Image Picker tarafından yönetilen cache
- Uygulama silinirse resimler de silinir

## Debugging

### Console Logging
```javascript
console.log('Mesaj');
console.error('Hata');
```

### React Native Debugger
- Expo DevTools kullanılabilir
- Chrome DevTools entegrasyonu

### Expo CLI
```bash
# Logs görmek için
expo logs

# Cihaz seçmek için
expo start --select
```

## Performance Considerations

1. **Resim Boyutu**: 0.8 quality ile optimize edilmiş
2. **FlatList**: Virtualization ile optimize edilmiş
3. **State Management**: Zustand minimal re-render sağlar
4. **AsyncStorage**: JSON parse/stringify overhead

## Bilinen Sınırlamalar

1. **Resim Sayısı**: Çok fazla resim (100+) performansı etkileyebilir
2. **AsyncStorage Boyutu**: 10MB limitine yaklaşırsa sorun olabilir
3. **Tarih Filtresi**: Büyük veri setlerinde yavaş olabilir

## Gelecek İyileştirmeler

1. **Veritabanı**: SQLite veya Realm kullanımı
2. **Cloud Sync**: Firebase veya Supabase entegrasyonu
3. **Resim Sıkıştırma**: Daha agresif sıkıştırma
4. **Pagination**: Büyük listelerde sayfalama
5. **Offline-First**: Daha gelişmiş offline desteği
