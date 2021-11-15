import { IDumper } from "./interfaces";
const fs = require("fs");

export class FileDumper implements IDumper {
  constructor() {}

  async Write(buff: Buffer) {
    fs.writeFileSync("./test.csv", buff);
  }
}
