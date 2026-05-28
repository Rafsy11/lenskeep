export type Language = 'id' | 'en';

export const translations = {
  id: {
    // Header
    'header.title': 'LensKeep',
    'header.subtitle': 'Ekstensi pikiran visual Anda',
    'header.stats_stored': 'screenshot tersimpan',
    'header.files': 'Files',
    'header.folder': 'Folder',
    'header.logout': 'Keluar',
    'header.api_key_tooltip': 'Kelola API Key',
    'header.switch_light': 'Switch to Light Mode',
    'header.switch_dark': 'Switch to Dark Mode',

    // Settings Modal
    'settings.title': 'Gemini API Key',
    'settings.description': 'LensKeep menggunakan API Key pribadi Anda untuk menganalisis screenshot dengan aman di browser Anda. Key Anda disimpan secara lokal di ',
    'settings.description_suffix': ' dan tidak pernah disimpan ke database kami.',
    'settings.get_key': 'Dapatkan API Key gratis Anda di Google AI Studio.',
    'settings.click_here': 'Klik di sini untuk membuat',
    'settings.your_keys': 'Your Gemini API Keys',
    'settings.placeholder': 'AIzaSy...',
    'settings.remove_key': 'Hapus Key',
    'settings.add_key': '+ Tambah API Key',
    'settings.save': 'Simpan API Key',
    'settings.saved_toast': 'API Keys berhasil disimpan!',
    
    // Dropzone
    'dropzone.expand': 'Perbesar Dropzone Upload',
    'dropzone.collapse': 'Perkecil Dropzone',
    'dropzone.drop_here': 'Tarik & Letakkan file/folder ke sini',
    'dropzone.or': 'atau klik tombol di atas untuk memilih',
    'dropzone.add_title': 'Tambah Screen Capture',
    'dropzone.add_desc': 'Tarik file ke sini, atau jatuhkan seluruh direktori untuk memproses folder bersarang',
    'dropzone.choose_files': 'Pilih File',
    'dropzone.choose_folder': 'Pilih Folder',
    'dropzone.supports': 'Mendukung JPEG, PNG, WEBP. Folder akan ditelusuri secara rekursif untuk memuat screenshot bersarang.',

    // Search & Library
    'search.placeholder': 'Cari teks terekstrak, ringkasan otomatis, kategori atau tag...',
    'library.ai_engine': 'MESIN AI',
    'library.filters': 'Filter',
    'library.reset_filters': 'Atur Ulang Filter',
    'library.reset_active': 'Atur Ulang Filter Aktif',
    'library.clear_all': 'Hapus Semua',
    'library.title': 'Pustaka',
    'library.sync_folder': 'Sinkron Folder',
  },
  en: {
    // Header
    'header.title': 'LensKeep',
    'header.subtitle': 'Your visual mind extension',
    'header.stats_stored': 'screenshot stored',
    'header.files': 'Files',
    'header.folder': 'Folder',
    'header.logout': 'Logout',
    'header.api_key_tooltip': 'Manage API Key',
    'header.switch_light': 'Switch to Light Mode',
    'header.switch_dark': 'Switch to Dark Mode',

    // Settings Modal
    'settings.title': 'Gemini API Key',
    'settings.description': 'LensKeep uses your personal API Key to analyze screenshots securely in your browser. Your key is stored locally in ',
    'settings.description_suffix': ' and is never saved to our database.',
    'settings.get_key': 'Get your free API Key at Google AI Studio.',
    'settings.click_here': 'Click here to create',
    'settings.your_keys': 'Your Gemini API Keys',
    'settings.placeholder': 'AIzaSy...',
    'settings.remove_key': 'Remove Key',
    'settings.add_key': '+ Add API Key',
    'settings.save': 'Save API Key',
    'settings.saved_toast': 'API Keys successfully saved!',

    // Dropzone
    'dropzone.expand': 'Expand Upload Dropzone',
    'dropzone.collapse': 'Collapse Dropzone',
    'dropzone.drop_here': 'Drag & Drop files/folders here',
    'dropzone.or': 'or click the buttons above to select',
    'dropzone.add_title': 'Add Screen Captures',
    'dropzone.add_desc': 'Drag files here, or drop entire directories to process nested folders',
    'dropzone.choose_files': 'Choose Files',
    'dropzone.choose_folder': 'Choose Folder',
    'dropzone.supports': 'Supports JPEG, PNG, WEBP. Folders will be traversed recursively to load nested screenshots.',

    // Search & Library
    'search.placeholder': 'Search extracted text, automatic summaries, categories or tags...',
    'library.ai_engine': 'AI ENGINE',
    'library.filters': 'Filters',
    'library.reset_filters': 'Reset Filters',
    'library.reset_active': 'Reset Active Filters',
    'library.clear_all': 'Clear All',
    'library.title': 'Library',
    'library.sync_folder': 'Sync Folder',
  }
};

export type TranslationKey = keyof typeof translations.id;
