import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT ?? 8001);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "colonymodels-server" });
});

app.listen(PORT, () => {
  console.log(`ColonyModels server listening on http://localhost:${PORT}`);
});
