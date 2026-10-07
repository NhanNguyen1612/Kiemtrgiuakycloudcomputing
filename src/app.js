import "dotenv/config";
import express from "express";
import { connectDatabase } from "./db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <h1>Ứng dụng quản lý sách</h1>
    <p>API xem sách: <a href="/books">/books</a></p>
  `);
});

async function start() {
  const studentId = process.env.STUDENT_ID;
  const prefix = studentId?.slice(-3);

  if (!prefix || !/^\d{3}$/.test(prefix)) {
    throw new Error("STUDENT_ID phải kết thúc bằng 3 chữ số");
  }

  const vatPercent = Number(studentId.at(-1)) + 4;
  const { readBooks, writeBooks } = await connectDatabase();

  // Xem sách: chỉ dùng tài khoản có quyền đọc.
  app.get("/books", async (req, res) => {
    const books = await readBooks.find({}).toArray();
    res.json(books);
  });

  // Thêm sách: chỉ dùng tài khoản có quyền ghi.
  app.post("/books", async (req, res) => {
    const { productCode, title, price } = req.body ?? {};

    if (
      typeof productCode !== "string" ||
      !productCode.trim() ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        error: "Mã sách, tên sách hoặc giá không hợp lệ",
      });
    }

    const cleanCode = productCode.trim();

    if (!cleanCode.startsWith(prefix)) {
      return res.status(400).json({
        error: `Mã sách phải bắt đầu bằng ${prefix}`,
      });
    }

    const priceAfterTax = Math.round(
      price * (1 + vatPercent / 100)
    );

    const book = {
      productCode: cleanCode,
      title: title.trim(),
      priceBeforeTax: price,
      vatPercent,
      priceAfterTax,
    };

    const result = await writeBooks.insertOne(book);

    res.status(201).json({
      id: result.insertedId,
      ...book,
    });
  });

  app.use((error, req, res, next) => {
    console.error("Lỗi xử lý yêu cầu:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
    console.log(`MSSV: ${studentId} | Tiền tố: ${prefix} | VAT: ${vatPercent}%`);
  });
}

start().catch((error) => {
  console.error("Không khởi động được ứng dụng:", error);
  process.exit(1);
});