// my-pubs-map — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
import express from "express";
import cors from "cors";
import barsRouter from "./routes/bars";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/api/bars", barsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
