<div align="center">
  <img src="docs/logo-64x64.png" alt="Foxycape PDF" width="64" height="64" />
  <h1>Foxycape PDF</h1>
</div>

Trình đọc PDF cho Obsidian. Đánh dấu, trích dẫn và liên kết sâu đưa về đúng chỗ trong văn bản, mạch ghi chú không bị đứt. Khi đọc một bài báo hoặc tài liệu học, dịch, tra từ, giải thích và hỏi đều nằm trong PDF đang mở.

[English](README.md) | [العربية](README.ar.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Bahasa Indonesia](README.id.md) | [Italiano](README.it.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Nederlands](README.nl.md) | [Polski](README.pl.md) | [Português](README.pt.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md) | [ไทย](README.th.md) | [Türkçe](README.tr.md) | [Українська](README.uk.md) | [Tiếng Việt](README.vi.md) | [中文](README.zh.md) | [繁體中文](README.zh-TW.md)

## Vì sao cần

Đọc PDF trong Obsidian thường làm đứt đường tới ghi chú:

- Phần đánh dấu nằm trong PDF, ghi chú của kho thì ở chỗ khác.
- Muốn lấy hình thì thường chỉ có ảnh chụp mờ, khó quản.
- Đoạn trích hoặc ảnh dán vào hiếm khi chỉ đúng trang hoặc vùng.
- Trong giao diện tối, trang PDF sáng làm chói mắt.
- Đổi trình đọc có thể làm hỏng liên kết trang và vùng chọn đã có.

Trong một bài báo hoặc tài liệu học, một từ lạ, một câu dài hoặc một khái niệm mới làm việc đọc dừng lại. Dịch, từ điển và câu hỏi phải chuyển sang công cụ khác, rồi tự khớp lại số trang.

Foxycape PDF lấp những chỗ hở đó ngay trong Obsidian.

## Tính năng

### Hiểu bài báo hoặc tài liệu học ngay trên trang đang mở

#### Một bài báo tiếng nước ngoài, từ lướt qua đến đọc hiểu

Chọn một đoạn là dịch được, trước hết thấy đại ý. Mặc định là bản dịch Microsoft; lướt đọc không tốn mức dùng AI. Muốn câu chữ sát chuyên môn hơn thì chuyển sang AI, chọn **Ưu tiên tốc độ** hoặc **Ưu tiên chất lượng**, và ngôn ngữ đích.

Nếu trong đoạn đó vẫn có một từ chưa chắc, dùng **Tra từ**. Cách đọc hiện bằng IPA, pinyin hoặc kana, kèm nghĩa của từ trong đoạn này. Nếu chọn cả câu, nghĩa câu đến trước, rồi mới đến những từ khó.

Nếu đoạn vẫn chưa rõ, **Giải thích đoạn này** chỉ mở đoạn đó ra để đọc tiếp. **Ngắn gọn**, một hai câu, đủ để lật trang. Muốn dài hơn thì chọn **Chi tiết**. **Tìm hiểu thêm** đưa đoạn gốc và lời giải thích đã có sang bảng bên **Hỏi AI**.

Bản dịch, lời giải thích và lần tra từ nằm trong danh sách của PDF này. Có thể lọc và nhảy về trang đó. Muốn ghi vào ghi chú thì bật ghi cho từng loại trong phần cài đặt (mặc định tắt). Chúng được nối vào file Markdown cùng tên với PDF.

<!-- GIF: docs/gifs/read-in-place.gif — chọn rồi dịch, tra từ, giải thích -->

#### Đọc một tài liệu dài và hỏi trong lúc đọc

Chọn một đoạn rồi hỏi AI. Câu hỏi mang theo đoạn gốc. Tài liệu dài thì Foxycape hỏi trước có phân tích tài liệu này không. Đồng ý thì câu trả lời dựa trên các đoạn trong tài liệu, trích dẫn mở được trang tương ứng. Không đồng ý thì trả lời theo kiến thức chung. Sau đó vẫn có thể chọn **Phân tích sách này** trong menu.

Từ một trích dẫn quay lại một trang, nếu đoạn đó vẫn chưa rõ, dịch, tra từ và giải thích vẫn dùng tiếp được. Trả lời xong sẽ có câu hỏi liên quan để bấm tiếp. Hội thoại được lưu theo PDF này, lần sau mở ra vẫn tìm được hoặc bắt đầu hội thoại mới.

<!-- GIF: docs/gifs/ask-while-reading.gif — hỏi PDF đang mở và nhảy về trang từ trích dẫn -->

### Mô hình và mức dùng

Giải thích, tra từ, dịch bằng AI và hỏi AI dùng mô hình đang chọn. Mức dùng mô hình chính thức được ghi vào mức dùng AI của giấy phép. Cũng có thể điền **URL cơ sở** và **khóa API** của mình. Bản dịch Microsoft không tính vào mức dùng này. Giấy phép lấy miễn phí. Mức dùng có thể mua, hoặc nhận khi chia sẻ.

### Đánh dấu vào ghi chú

Phần đánh dấu không cần chỉ nằm trong PDF. Một đánh dấu mới có thể tạo hoặc cập nhật ghi chú Markdown cùng tên, thêm đoạn trích kèm liên kết quay lại, và nếu muốn thì mở ghi chú đó ở khung chia. Tắt được trong phần cài đặt.

![](docs/gifs/highlight-notes.gif)
<!-- GIF: docs/gifs/highlight-notes.gif — đánh dấu ghi vào ghi chú cùng tên -->

### Lấy ảnh nhúng nguyên bản

Không cần chấp nhận ảnh chụp mờ. Đưa chuột lên ảnh nhúng (trên điện thoại dùng điều khiển chạm) để xem trước, sao chép hoặc tải bản gốc.

![](docs/gifs/embed-images.gif)
<!-- GIF: docs/gifs/embed-images.gif — đưa chuột: xem trước, sao chép, tải về -->

### Trích dẫn chữ và ảnh, rồi về nguồn

Trích dẫn giữ nguồn, từ ghi chú có thể quay lại PDF:

- Sao chép trích dẫn chữ thành Markdown có liên kết sâu (`#page=` / `#selection=` / `#markId=`).
- Sao chép trích dẫn ảnh. Dán vào Markdown sẽ lưu PNG cạnh PDF và chèn một liên kết.
- Chuột phải vào ảnh trong ghi chú → **Mở trong Foxycape**, về đúng trang và làm nổi vùng gốc.

![](docs/gifs/cite-and-back.gif)
<!-- GIF: docs/gifs/cite-and-back.gif — sao chép trích dẫn → dán → về PDF -->

### Hợp với giao diện Obsidian

Trong kho tối, trang PDF sáng thường chói. Có thể ánh xạ màu xám của nét véc-tơ sang màu chữ và nền của giao diện (BETA): mọi giao diện, chỉ tối, hoặc chỉ sáng. Hình màu và nét véc-tơ màu giữ nguyên.

![](docs/gifs/theme-adapt.gif)

![](docs/gifs/theme-adapt-dark.gif)
<!-- GIF: docs/gifs/theme-adapt.gif — trang PDF theo giao diện -->

### Chụp một vùng

Không cần chuyển sang công cụ chụp của hệ thống, cũng không phải tự ghép trang. Bấm **Chụp màn hình** trên thanh công cụ rồi kéo một vùng trên PDF. Có thể sao chép ảnh, hoặc sao chép trích dẫn ảnh — dán vào ghi chú xong, chuột phải là về đúng chỗ.

Một vùng trên một trang:

![](docs/gifs/screenshot-single.gif)
<!-- GIF: docs/gifs/screenshot-single.gif — vùng trên một trang -->

Vùng vượt qua khe trang thì được ghép thành một ảnh liền:

![](docs/gifs/screenshot-multi.gif)
<!-- GIF: docs/gifs/screenshot-multi.gif — nhiều trang thành một ảnh -->

### Tương thích liên kết của trình đọc có sẵn

Đổi trình đọc không nên làm hỏng liên kết đã viết. Foxycape hiểu `#page=` và `#selection=` của Obsidian, có thể thành trình xem PDF mặc định, dùng lại tab đang mở, và `#markId=` nhảy đúng chỗ đánh dấu.

![](docs/gifs/compat-links.gif)
<!-- GIF: docs/gifs/compat-links.gif — mở liên kết trang hoặc vùng chọn đã có -->

### Kiểu đánh dấu và danh sách

Bút dạ, gạch lượn sóng, gạch chân thẳng, và màu tự chọn. Danh sách lọc, sắp xếp, nhảy tới và xóa.

![](docs/gifs/annotations.gif)
<!-- GIF: docs/gifs/annotations.gif — kiểu và danh sách đánh dấu -->

### Sao chép thông minh — bỏ ngắt dòng mềm

Dàn trang PDF thường cắt câu giữa chừng. Sao chép xong thì đầy ngắt dòng thừa. Cứ chọn và sao chép như thường: Foxycape bỏ những ngắt dòng mềm đó, phần dán thành một đoạn liền. Ngắt đoạn thật vẫn giữ.

![](docs/gifs/smart-copy.gif)
<!-- GIF: docs/gifs/smart-copy.gif — chọn → sao chép → dán không ngắt giữa câu -->

### Di chuyển và tìm

Mục lục, ảnh thu nhỏ, nhảy trang, và tìm trong tài liệu (`Mod+F`), có phân biệt hoa thường, dấu và cả từ. Tìm dựa trên lớp chữ của PDF, không OCR.

![](docs/gifs/navigate-search.gif)
<!-- GIF: docs/gifs/navigate-search.gif — mục lục, ảnh thu nhỏ và tìm -->

### Bố cục đọc

Phóng (tự động / vừa chiều ngang trang / phần trăm), cuộn dọc hoặc ngang, một trang / hai trang / sách, xoay trang, PDF có mật khẩu. Trên máy tính và điện thoại.

![](docs/gifs/layout.gif)

![](docs/gifs/layout-1.gif)
<!-- GIF: docs/gifs/layout.gif — bố cục và phóng -->

### Đặt làm trình đọc PDF mặc định

Trong phần cài đặt, bật **Dùng làm trình xem PDF mặc định** để Obsidian mở PDF bằng Foxycape. Liên kết sâu, đánh dấu và hợp giao diện khi đó mới đủ.

![](docs/gifs/set-default.gif)
<!-- GIF: docs/gifs/set-default.gif — bật trình xem PDF mặc định -->

## Phát triển

```bash
npm install
npm run build      # → dist/main.js, styles.css, manifest.json, versions.json, markdown.js, pdfjs.zip, reader-bundle.zip, locales.zip, pdfjs-assets.zip
npm run dev        # build theo dõi; sau mỗi lần thành công chép vào OBSIDIAN_PLUGIN_DIR
npm test
npm run typecheck
npm run link       # junction dist/ tới .obsidian/plugins/foxycape-pdf của kho
```

Đặt `OBSIDIAN_PLUGIN_DIR` trong `.env` (xem `.env.example`). `npm run dev` chép kết quả vào đó sau mỗi lần build thành công; `npm run link` đọc cùng biến đó, nếu chưa đặt thì dùng đường dẫn kho mặc định. Biến môi trường của tiến trình ưu tiên hơn file.

## Giấy phép

Kho này là **source available** và chịu [Foxycape Plugins License Agreement](LICENSE.md).

- Được dùng, sửa và phân phối lại mã, với một giới hạn: không được biến thành một sản phẩm phổ thông cho Obsidian (hoặc ứng dụng ghi chú tương tự) cạnh tranh với sản phẩm thương mại của Foxycape — kể cả việc đăng công khai miễn phí sau khi bỏ kiểm tra dùng thử hoặc giấy phép.
- Dùng riêng, dùng trong một tổ chức, và việc làm riêng cho một khách hàng vẫn được phép.
- Quyền vượt thỏa thuận này: **company@tiefeiying.com**.

Thành phần của bên thứ ba (ví dụ PDF.js) và gói phát hành riêng (ví dụ `@foxycape/core` theo MIT) giữ giấy phép của chúng.

Toàn văn nằm trong [LICENSE.md](LICENSE.md).
