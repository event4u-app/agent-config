// Parity fixture: identical pair. Echo argv + stdin, read a fixture file.
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

process.stdout.write(`hello ${process.argv.slice(2).join(" ")}\n`);
let data = "";
try {
    data = readFileSync(0, "utf8");
} catch {
    data = "";
}
if (data !== "") {
    process.stdout.write(`stdin:${data}`);
}
if (existsSync("seed.txt")) {
    process.stdout.write(`seed:${readFileSync("seed.txt", "utf8")}`);
}
