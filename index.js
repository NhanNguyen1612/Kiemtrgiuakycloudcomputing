import 'dotenv/config';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Ứng dụng Quản lý Sách đang chạy');
});

app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});