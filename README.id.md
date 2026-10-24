<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Pembaca PDF untuk Obsidian. Sorotan, kutipan, dan tautan dalam membawa kembali ke tempat di teks, dan alur catatan tetap tersambung. Saat membaca makalah atau bahan belajar, terjemahan, cari kata, penjelasan, dan pertanyaan terjadi di PDF yang sudah terbuka.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Mengapa perlu

Membaca PDF di Obsidian sering memutus jalan ke catatan:

- Sorotan tinggal di PDF, catatan di vault ada di tempat lain.
- Gambar yang dibutuhkan biasanya cuplikan buram yang sulit diatur.
- Kutipan atau gambar yang ditempel jarang menunjuk halaman atau wilayah yang tepat.
- Di tema gelap, halaman PDF yang terang menyilaukan.
- Berganti pembaca bisa membuat tautan halaman dan pilihan yang sudah ada tidak berlaku.

Di makalah atau bahan belajar, kata yang asing, kalimat panjang, atau konsep yang belum dikenal menghentikan bacaan. Terjemahan, kamus, dan pertanyaan pindah ke alat lain, lalu nomor halaman harus dicocokkan sendiri.

Foxycape PDF menutup celah itu di dalam Obsidian.

## Kemampuan

### Memahami makalah atau bahan belajar di halaman yang sedang terbuka

#### Makalah bahasa asing, dari menyapu mata sampai benar-benar paham

Pilih satu bagian, langsung bisa diterjemahkan, dan makna besarnya muncul lebih dulu. Bawaan adalah terjemahan Microsoft; menyapu bacaan tidak memakai penggunaan AI. Agar rumusannya lebih dekat ke bidangnya, ganti ke AI, pilih **Utamakan kecepatan** atau **Utamakan kualitas**, dan bahasa tujuan.

Jika di bagian itu masih ada kata yang belum pasti, pakai **Cari kata**. Pelafalan ditampilkan dengan IPA, pinyin, atau kana, bersama makna kata itu di bagian ini. Jika yang dipilih satu kalimat utuh, makna kalimat datang lebih dulu, lalu kata-kata yang sulit.

Jika bagian itu masih belum jelas, **Jelaskan bagian ini** menguraikan hanya bagian tersebut supaya bacaan bisa dilanjutkan. **Singkat**, satu dua kalimat, cukup untuk membalik halaman. Untuk yang lebih panjang, pilih **Rinci**. **Pelajari lebih lanjut** mengirim teks asli dan penjelasan yang sudah ada ke panel samping **Tanya AI**.

Terjemahan, penjelasan, dan cari kata tersimpan di daftar PDF ini. Bisa disaring dan dilompati kembali ke halaman itu. Untuk mencatatnya, nyalakan penulisan tiap jenis di pengaturan (mati secara bawaan). Isinya ditambahkan ke Markdown yang namanya sama dengan PDF.

<!-- GIF: docs/gifs/read-in-place.gif — pilih, lalu terjemahkan, cari kata, jelaskan -->

#### Membaca bahan yang panjang sambil bertanya

Pilih satu bagian lalu tanya AI. Pertanyaan membawa teks itu. Jika dokumennya panjang, Foxycape bertanya dulu apakah dokumen ini perlu dianalisis. Jika setuju, jawaban berpijak pada bagian dalam dokumen, dan kutipan membuka halaman itu. Jika tidak, jawaban memakai pengetahuan umum. Nanti **Analisis buku ini** masih bisa dipilih dari menu.

Setelah kutipan membawa kembali ke suatu halaman dan bagian itu masih belum jelas, terjemahan, cari kata, dan penjelasan tetap bisa dipakai. Setelah jawaban, ada pertanyaan terkait yang bisa ditekan untuk lanjut. Percakapan disimpan bersama PDF ini, kali berikut masih bisa dicari atau dimulai yang baru.

<!-- GIF: docs/gifs/ask-while-reading.gif — tanya PDF yang terbuka dan lompat kembali dari kutipan -->

### Model dan penggunaan

Penjelasan, cari kata, terjemahan AI, dan tanya AI memakai model yang sedang dipilih. Pemakaian model resmi dicatat pada penggunaan AI di lisensi. **URL dasar** dan **kunci API** sendiri juga bisa diisi. Terjemahan Microsoft tidak memakai penggunaan itu. Lisensi bisa diambil gratis. Penggunaan bisa dibeli, atau didapat dengan berbagi.

### Sorotan masuk catatan

Sorotan tidak harus tertinggal di PDF. Sorotan baru bisa membuat atau memperbarui catatan Markdown dengan nama yang sama, menambahkan kutipan beserta tautan kembali, dan bila perlu membuka catatan itu di panel terpisah. Bisa dimatikan di pengaturan.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — sorotan menulis catatan dengan nama yang sama -->

### Mengambil gambar yang tertanam

Tidak perlu puas dengan cuplikan yang buram. Arahkan penunjuk ke gambar yang tertanam (di ponsel pakai kontrol sentuh) untuk pratinjau, salin, atau unduh aslinya.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — arahkan: pratinjau, salin, unduh -->

### Mengutip teks dan gambar, lalu kembali ke sumber

Kutipan membawa asal, dan dari catatan bisa kembali ke PDF:

- Salin kutipan teks sebagai Markdown dengan tautan dalam (`#page=` / `#selection=` / `#markId=`).
- Salin kutipan gambar. Menempelkannya ke Markdown menyimpan PNG di samping PDF dan menyisipkan tautan.
- Klik kanan gambar di catatan → **Buka di Foxycape**, kembali ke halaman dan menandai wilayah asalnya.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — salin kutipan → tempel → kembali ke PDF -->

### Mengikuti tema Obsidian

Di vault gelap, halaman PDF yang terang sering menyilaukan. Warna abu-abu pada vektor bisa dipetakan ke warna depan dan latar tema (BETA): semua tema, hanya gelap, atau hanya terang. Gambar berwarna dan vektor berwarna tetap seperti aslinya.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — halaman PDF mengikuti tema -->

### Cuplikan satu wilayah

Tidak perlu beralih ke alat cuplikan sistem, dan tidak perlu menyambung halaman sendiri. Tekan **Cuplikan** di bilah alat, lalu seret wilayah di PDF. Gambar bisa disalin, atau kutipan gambar disalin — setelah ditempel ke catatan, klik kanan kembali ke tempat asalnya.

Wilayah pada satu halaman:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — wilayah satu halaman -->

Jika wilayah melewati sela halaman, hasilnya disambung menjadi satu gambar yang menyambung:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — beberapa halaman menjadi satu gambar -->

### Cocok dengan tautan pembaca bawaan

Berganti pembaca tidak seharusnya merusak tautan yang sudah ada. Foxycape memahami `#page=` dan `#selection=` dari Obsidian, bisa menjadi penampil PDF bawaan, memakai kembali tab yang sudah terbuka, dan `#markId=` melompat tepat ke sorotan.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — membuka tautan halaman atau pilihan yang sudah ada -->

### Gaya sorotan dan daftarnya

Pena penanda, garis bergelombang, garis bawah lurus, dan warna sendiri. Daftar bisa disaring, diurutkan, dilompati, dan dihapus.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — gaya dan daftar sorotan -->

### Salin cerdas — menghapus pemisah baris lunak

Tata letak PDF sering memotong kalimat di tengah. Setelah disalin, pemisah baris berlebih memenuhi teks. Pilih dan salin seperti biasa: Foxycape menghapus pemisah lunak itu, sehingga tempelan menjadi paragraf yang menyambung. Pemisah paragraf yang sungguhan tetap ada.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — pilih → salin → tempel tanpa pemisah di tengah kalimat -->

### Navigasi dan cari

Daftar isi, gambar mini, lompat halaman, dan cari di dalam dokumen (`Mod+F`), dengan huruf besar-kecil, tanda diakritik, dan seluruh kata. Pencarian memakai lapisan teks PDF, tanpa OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — daftar isi, gambar mini, dan cari -->

### Tata letak baca

Perbesar (otomatis / lebar halaman / persen), gulir tegak atau mendatar, satu halaman / dua halaman / buku, putar halaman, dan PDF dengan kata sandi. Di desktop dan di ponsel.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — tata letak dan perbesar -->

### Jadikan pembaca PDF bawaan

Di pengaturan, nyalakan **Gunakan sebagai penampil PDF default** supaya Obsidian membuka PDF dengan Foxycape. Tautan dalam, sorotan, dan penyesuaian tema jadi lengkap.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — menyalakan penampil PDF bawaan di pengaturan -->

## Pengembangan

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # build yang dipantau; setelah berhasil menyalin ke OBSIDIAN_PLUGIN_DIR
npm test
npm run typecheck
npm run link       # junction dist/ ke .obsidian/plugins/foxycape-pdf di vault
```

Atur `OBSIDIAN_PLUGIN_DIR` di `.env` (lihat `.env.example`). `npm run dev` menyalin hasil ke sana setiap build berhasil; `npm run link` membaca variabel yang sama, dan jika belum diatur tetap memakai jalur vault bawaan. Variabel lingkungan proses lebih diutamakan daripada berkas.

## Lisensi

Repositori ini **source available** dan tunduk pada [Foxycape Plugins License Agreement](LICENSE.md).

- Kode boleh dipakai, diubah, dan disebarluaskan kembali, dengan batas: tidak boleh dijadikan produk umum untuk Obsidian (atau aplikasi catatan sejenis) yang bersaing dengan produk komersial Foxycape — termasuk unggahan publik gratis yang kontrol uji coba atau lisensinya dilepas.
- Pemakaian pribadi, pemakaian di dalam satu organisasi, dan pekerjaan khusus untuk satu klien tetap diperbolehkan.
- Untuk hak di luar perjanjian itu, hubungi **company@tiefeiying.com**.

Komponen pihak ketiga (misalnya PDF.js) dan paket yang diterbitkan terpisah (misalnya `@foxycape/core` di bawah MIT) tetap mengikuti lisensinya sendiri.

Teks lengkap ada di [LICENSE.md](LICENSE.md).
