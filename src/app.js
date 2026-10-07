import "dotenv/config";
import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { MongoClient } from "mongodb";
import { engine } from "express-handlebars";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./db.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", fileURLToPath(new URL("./views/", import.meta.url)));

if (isProduction) app.set("trust proxy", 1);

async function start() {
  const studentId = process.env.STUDENT_ID;
  const studentName = process.env.STUDENT_NAME;
  const prefix = studentId?.slice(-3);

  if (!prefix || !/^\d{3}$/.test(prefix)) {
    throw new Error("STUDENT_ID phải kết thúc bằng 3 chữ số");
  }
  if (!studentName || !process.env.MONGO_SESSION_URI || !process.env.SESSION_SECRET) {
    throw new Error("Thiếu STUDENT_NAME, MONGO_SESSION_URI hoặc SESSION_SECRET");
  }

  const vatPercent = Number(studentId.at(-1)) + 4;
  const { readBooks, writeBooks } = await connectDatabase();

  const sessionClient = new MongoClient(process.env.MONGO_SESSION_URI);
  await sessionClient.connect();

  const store = MongoStore.create({
    client: sessionClient,
    dbName: `DB_${studentId}`,
    collectionName: "sessions",
    ttl: 24 * 60 * 60,
    autoRemove: "native",
  });

  app.use(session({
    name: "book.sid",
    secret: process.env.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  function prepareBook(input = {}) {
    const productCode =
      typeof input.productCode === "string" ? input.productCode.trim() : "";
    const title =
      typeof input.title === "string" ? input.title.trim() : "";

    const rawPrice = input.price;
    const validPrice =
      typeof rawPrice === "number" ||
      (typeof rawPrice === "string" && rawPrice.trim() !== "");
    const price = validPrice ? Number(rawPrice) : NaN;

    if (!productCode || !title || !Number.isFinite(price) || price < 0) {
      return { error: "Mã sách, tên sách hoặc giá không hợp lệ" };
    }
    if (!productCode.startsWith(prefix)) {
      return { error: `Mã sách phải bắt đầu bằng ${prefix}` };
    }

    return {
      book: {
        productCode,
        title,
        priceBeforeTax: price,
        vatPercent,
        priceAfterTax: Math.round(price * (1 + vatPercent / 100)),
      },
    };
  }

  async function renderHome(req, res, options = {}) {
    const books = await readBooks.find({}).sort({ _id: -1 }).toArray();

    return res.status(options.status || 200).render("home", {
      books,
      error: options.error || null,
      form: options.form || {},
      studentName,
      studentId,
      prefix,
      vatPercent,
      sessionViews: req.session.views || 0,
    });
  }

  app.get("/", async (req, res) => {
    req.session.views = (req.session.views || 0) + 1;
    await renderHome(req, res);
  });

  app.get("/books", async (req, res) => {
    const books = await readBooks.find({}).toArray();
    res.json(books);
  });

  app.post("/books", async (req, res) => {
    const { book, error } = prepareBook(req.body);
    if (error) return res.status(400).json({ error });

    const result = await writeBooks.insertOne(book);
    res.status(201).json({ id: result.insertedId, ...book });
  });

  app.post("/books/new", async (req, res) => {
    const { book, error } = prepareBook(req.body);

    if (error) {
      return renderHome(req, res, {
        status: 400,
        error,
        form: {
          productCode: req.body.productCode,
          title: req.body.title,
          price: req.body.price,
        },
      });
    }

    await writeBooks.insertOne(book);
    res.redirect(303, "/");
  });

  app.use((error, req, res, next) => {
    console.error("Lỗi:", error);
    res.status(500).send("Lỗi máy chủ");
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`Server chạy tại http://localhost:${port}`);
    console.log(`MSSV ${studentId} | Tiền tố ${prefix} | VAT ${vatPercent}%`);
  });
}

start().catch((error) => {
  console.error("Không khởi động được:", error);
  process.exit(1);
});