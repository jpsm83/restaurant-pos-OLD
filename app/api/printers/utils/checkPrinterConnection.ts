import * as net from "net";

export const checkPrinterConnection = (ipAddress: string, port: number) => {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(1000); // Timeout after 1 second
  
      client.connect(port, ipAddress, function () {
        client.destroy(); // Destroy socket after successful connection
        resolve(true);
      });
  
      client.on("error", function (err) {
        reject(err);
      });
  
      client.on("timeout", function () {
        reject(new Error("Connection to printer timed out"));
      });
    });
  };
  