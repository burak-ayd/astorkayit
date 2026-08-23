# AstorKayit - Proje Özeti

## Proje Amacı

Fotoğraflarla birlikte başlık ve açıklama içeren kayıtlar oluşturmak, arama yapmak ve tarih filtresi uygulamak için bir React Native mobil uygulaması.

## Temel Özellikler

### 1. Kayıt Oluşturma

- Başlık (zorunlu)
- Açıklama (isteğe bağlı)
- Fotoğraflar (en az 1 zorunlu)
- Kameradan fotoğraf çekme
- Galeriden fotoğraf seçme
- Birden fazla fotoğraf desteği

### 2. Kayıt Yönetimi

- Tüm kayıtları liste halinde görüntüleme
- Kayıt detaylarını görüntüleme
- Kayıt silme
- Fotoğrafları fullscreen modda görüntüleme

### 3. Arama Özelliği

- Başlık ve açıklamada arama
- Gerçek zamanlı arama sonuçları
- Arama sonuçlarından detay sayfasına geçiş

### 4. Tarih Filtresi

- Tarih aralığına göre filtreleme
- Belirli bir tarihte eklenen kayıtları filtreleme
- Filtre temizleme

## Teknoloji Stack

- **Framework**: React Native (Expo)
- **Routing**: Expo Router
- **State Management**: Zustand
- **Veri Depolama**: SQLite
- **Kamera**: expo-camera, expo-image-picker
- **Tarih Seçici**: @react-native-community/datetimepicker
- **İkonlar**: @expo/vector-icons

## Veri Yapısı

```javascript
{
  id: string,              // Benzersiz kimlik
  title: string,           // Başlık
  description: string,     // Açıklama
  photos: string[],        // Fotoğraf URI'leri
  metadata: object,        // Ek veriler
  createdAt: number,       // Oluşturma tarihi (timestamp)
  updatedAt: number        // Güncelleme tarihi (timestamp)
}
```

## Kurulum ve Çalıştırma

1. `yarn install` - Bağımlılıkları yükle
2. `yarn start` - Geliştirme sunucusunu başlat
3. `yarn android` - Android emülatörde çalıştır
4. `yarn ios` - iOS simülatörde çalıştır
