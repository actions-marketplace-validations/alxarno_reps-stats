const ObjectsToCsv = require("objects-to-csv");

export class CSVWriter {
  constructor() {}

  async ToCSV(data: any): Promise<Buffer> {
    const csv = new ObjectsToCsv(data);
    let csvString = await csv.toString(true, true);
    console.log(csvString);
    return Buffer.from(csvString, "utf8");
  }
}
