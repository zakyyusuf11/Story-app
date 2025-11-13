# Story App

Aplikasi web untuk berbagi cerita dengan dukungan PWA, Push Notification, dan IndexedDB.

## Fitur

- ✅ Single Page Application (SPA) dengan transisi halaman
- ✅ Menampilkan data dan marker pada peta
- ✅ Fitur tambah data baru
- ✅ Aksesibilitas sesuai standar
- ✅ Push Notification
- ✅ PWA dengan dukungan instalasi dan mode offline
- ✅ IndexedDB untuk penyimpanan lokal (Create, Read, Delete)

## Table of Contents

- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Project Structure](#project-structure)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (disarankan versi 12 atau lebih tinggi)
- [npm](https://www.npmjs.com/) (Node package manager)

### Installation

1. Clone repository ini
   ```shell
   git clone https://github.com/zakyyusuf11/Story-app.git
   cd Story-app
   ```

2. Pasang seluruh dependencies dengan perintah berikut.
   ```shell
   npm install
   ```

## Scripts

- Build for Production:
  ```shell
  npm run build
  ```
  Script ini menjalankan webpack dalam mode production menggunakan konfigurasi `webpack.prod.js` dan menghasilkan sejumlah file build ke direktori `dist`.

- Start Development Server:
  ```shell
  npm run start-dev
  ```
  Script ini menjalankan server pengembangan webpack dengan fitur live reload dan mode development sesuai konfigurasi di `webpack.dev.js`.

- Serve:
  ```shell
  npm run serve
  ```
  Script ini menggunakan [`http-server`](https://www.npmjs.com/package/http-server) untuk menyajikan konten dari direktori `dist`.

## Project Structure

Proyek ini dirancang agar kode tetap modular dan terorganisir.

```text
Story-app/
├── dist/                   # Compiled files for production
├── src/                    # Source project files
│   ├── public/             # Public files (service worker, images, favicon)
│   │   ├── sw.js          # Service Worker untuk PWA
│   │   ├── images/        # Image assets
│   │   └── favicon.png    # Favicon
│   ├── scripts/            # Source JavaScript files
│   │   ├── data/          # Data layer (API, IndexedDB)
│   │   ├── pages/         # Page components
│   │   ├── routes/        # Routing logic
│   │   ├── utils/         # Utility functions
│   │   ├── push-notification.js  # Push notification handler
│   │   └── index.js       # Main JavaScript entry file
│   ├── styles/             # Source CSS files
│   │   └── styles.css      # Main CSS file
│   └── index.html          # Main HTML file
├── manifest.json           # PWA manifest
├── package.json            # Project metadata and dependencies
├── package-lock.json       # Locked dependencies
├── README.md               # Project documentation
├── STUDENT.txt             # Student information
├── webpack.common.js       # Webpack common configuration
├── webpack.dev.js          # Webpack development configuration
└── webpack.prod.js         # Webpack production configuration
```

## Teknologi yang Digunakan

- Webpack - Module bundler
- Babel - JavaScript transpiler
- Service Worker - PWA dan offline support
- IndexedDB - Local storage
- Push API - Push notifications
- Leaflet - Maps integration

## Author

Zaky Yusuf Ajindra
