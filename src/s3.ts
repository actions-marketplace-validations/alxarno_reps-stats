import { IDumper } from "./interfaces";
import AWS from "aws-sdk";

export class S3Dumper implements IDumper {
  private s3Client: AWS.S3 | null = null;
  private bucket: string = "";
  private path: string = "";
  constructor(ID: string, SECRET: string, bucket: string, path: string) {
    this.s3Client = new AWS.S3({
      accessKeyId: ID,
      secretAccessKey: SECRET,
    });
    this.bucket = bucket;
    this.path = path;
  }

  async Write(buff: Buffer, name: string) {
    let key = `${this.path}/${name}`;
    console.log(`Putting s3 object in bucket ${this.bucket}, path - ${key}`);
    const putParams = {
      Bucket: this.bucket,
      Key: key,
      Body: buff,
    };

    await new Promise((res, rej) => {
      this.s3Client!.putObject(putParams, function (putErr, putData) {
        if (putErr) {
          console.error(putErr);
          rej();
        } else {
          res(putData);
        }
      });
    });
  }
}
