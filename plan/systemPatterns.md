# Sistem Mimarisi ve Tasarım Desenleri

## Mimari Genel Bakış

### Katman Yapısı

```
UI Layer (Screens & Components)
    ↓
State Management (Zustand Store)
    ↓
Data Layer (AsyncStorage)
```

## State Management (Zustand)

### RecordStore

- **Amaç**: Tüm kayıtları merkezi olarak yönetmek
- **Depolama**: AsyncStorage'da JSON olarak saklanır
- **Senkronizasyon**: Otomatik olarak her değişiklikte kaydedilir

### Store Metodları

- `loadRecords()` - AsyncStorage'dan kayıtları yükle
- `addRecord(record)` - Yeni kayıt ekle
- `updateRecord(id, updates)` - Kayıt güncelle
- `deleteRecord(id)` - Kayıt sil
- `searchRecords(query)` - Başlık ve açıklamada arama
- `filterByDateRange(start, end)` - Tarih aralığına göre filtrele
- `filterByDate(date)` - Belirli bir tarihte eklenen kayıtları filtrele
- `getRecordById(id)` - ID'ye göre kayıt getir

## Bileşen Mimarisi

### Ekranlar (Screens)

1. **HomeScreen** (`app/(tabs)/index.jsx`)
    - Tüm kayıtları liste halinde gösterir
    - Üst kısımda başlık/açıklama araması + tarih filtresi
    - Kayıt silme ve detay görüntüleme

2. **AddScreen** (`app/(tabs)/add.jsx`)
    - FAB ile açılan yeni kayıt oluşturma
    - Başlık, açıklama, fotoğraf (kamera + çoklu galeri)

3. **SettingsScreen** (`app/(tabs)/settings.jsx`)
    - İstatistikler (toplam kayıt + depolama)
    - ZIP dışa aktarma (kaydet veya paylaş)
    - Tüm kayıtları toplu sil

4. **DetailScreen** (`app/detail.jsx`)
    - Kayıt detayları + metadata
    - Fotoğrafları fullscreen zoom/pan ile gösterir
    - Kayıt silme

### Bileşenler (Components)

1. **PhotoGrid** - Yatay scroll fotoğraf listesi (editable modda silme butonu)
2. **RecordCard** - Liste görünümü kartı (thumbnail + başlık + açıklama + tarih)
3. **DateRangeFilter** - Tarih aralığı filtresi (modal)
4. **FullscreenPhotoViewer** - Pinch-zoom + pan ile fotoğraf görüntüleme

## Veri Akışı

### Kayıt Oluşturma

```
CreateScreen (Form Input)
    ↓
useRecordStore.addRecord()
    ↓
Zustand Store (records array)
    ↓
AsyncStorage (JSON)
    ↓
HomeScreen (FlatList güncellenir)
```

### Arama

```
SearchScreen (TextInput)
    ↓
useRecordStore.searchRecords(query)
    ↓
Zustand Store (filtreleme)
    ↓
SearchScreen (sonuçları göster)
```

### Tarih Filtresi

```
DateRangeFilter (Tarih Seçimi)
    ↓
useRecordStore.filterByDateRange()
    ↓
Zustand Store (filtreleme)
    ↓
HomeScreen (filtrelenmiş sonuçları göster)
```

## Navigasyon Yapısı

### Expo Router Yapısı

```
app/
├── _layout.jsx (Root Stack)
├── (tabs)/
│   ├── _layout.jsx (Bottom Tabs + FAB)
│   ├── index.jsx (Home - liste + arama + tarih filtresi)
│   ├── add.jsx (FAB ile açılan kayıt oluşturma)
│   └── settings.jsx (Ayarlar)
└── detail.jsx (Stack - kayıt detayı)
```

### Navigasyon Akışı

- **Home** → **Detail** (Stack, `navigate("detail", { recordId })`)
- **Home** (FAB) → **Add** (Tab)
- **Settings** → **Settings** içi işlemler
- **Detail** → **Home** (Geri)

## Veri Depolama

<!-- {
  id: string,              // Benzersiz kimlik
  title: string,           // Başlık
  description: string,     // Açıklama
  photos: string[],        // Fotoğraf URI'leri
  metadata: object,        // Ek veriler
  createdAt: number,       // Oluşturma tarihi (timestamp)
  updatedAt: number        // Güncelleme tarihi (timestamp)
} -->

### SQLite Şeması

```
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  uri TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);
```

## Performans Optimizasyonları

1. **FlatList Optimizasyonu**
    - `keyExtractor` kullanımı
    - `contentContainerStyle` ile padding

2. **Bileşen Memoization**
    - RecordCard bileşeni optimize edilebilir
    - PhotoGrid bileşeni optimize edilebilir

3. **Resim Optimizasyonu**
    - `expo-image-picker` ile 0.9 quality
    - Resimler URI olarak saklanır (dosya sistemi)

## Hata Yönetimi

1. **Kamera Hataları**
    - Try-catch blokları
    - Kullanıcıya hata mesajı gösterilir

2. **SQLite Hataları**
    - Try-catch blokları
    - Console'a log kaydedilir

3. **Validasyon**
    - Başlık zorunlu
    - En az 1 fotoğraf zorunlu
    - Alert ile kullanıcıya bildirilir
