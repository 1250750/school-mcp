import { google, drive_v3 } from "googleapis";

export function createDriveClient(): drive_v3.Drive {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}
