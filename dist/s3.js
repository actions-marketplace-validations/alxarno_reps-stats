"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Dumper = void 0;
const AWS = require("aws-sdk");
class S3Dumper {
    constructor(ID, SECRET, bucket, path) {
        this.s3Client = null;
        this.bucket = "";
        this.path = "";
        this.s3Client = new AWS.S3({
            accessKeyId: ID,
            secretAccessKey: SECRET,
        });
        this.bucket = bucket;
        this.path = path;
    }
    Write(buff, name) {
        return __awaiter(this, void 0, void 0, function* () {
            let key = `${this.path}/${name}`;
            console.log(`Putting s3 object in bucket ${this.bucket}, path - ${key}`);
            const putParams = {
                Bucket: this.bucket,
                Key: key,
                Body: buff,
            };
            yield new Promise((res, rej) => {
                this.s3Client.putObject(putParams, function (putErr, putData) {
                    if (putErr) {
                        console.error(putErr);
                        rej();
                    }
                    else {
                        res(putData);
                    }
                });
            });
        });
    }
}
exports.S3Dumper = S3Dumper;
