export default function handler(req, res) {
  res.setHeader("content-type", "text/csv");
  res.end("id,total\n");
}
