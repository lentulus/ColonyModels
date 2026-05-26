import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 8001);

app.listen(PORT, () => {
  console.log(`ColonyModels server listening on http://localhost:${PORT}`);
});
