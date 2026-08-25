import fs from 'fs';
import path from 'path';

export class BlobService {
  constructor(private baseFolder: string) {}

  private getFolder(id: string): string {
    const folder = path.join(this.baseFolder, id);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    return folder;
  }

  createFolder(id: string): string {
    return this.getFolder(id);
  }

  setBlob(sourcePath: string, appId: string, fileName: string): void {
    const folder = this.getFolder(appId);
    const dest = path.join(folder, fileName);
    fs.copyFileSync(sourcePath, dest);
  }

  getBlob(appId: string, fileName: string, res: any): void {
    const folder = this.getFolder(appId);
    const file = path.join(folder, fileName);
    if (!fs.existsSync(file)) {
      res.status(404).send('Not found');
      return;
    }
    res.sendFile(path.resolve(file));
  }

  deleteBlob(appId: string, fileName: string): boolean {
    const folder = this.getFolder(appId);
    const file = path.join(folder, fileName);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  }

  copyBlob(sourceUrl: string, destUrl: string, appId: string, newAppId: string): boolean {
    const source = this.getPathFromUrl(sourceUrl, appId);
    const destFolder = this.getFolder(newAppId);
    const destFile = path.join(destFolder, path.basename(destUrl));
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destFile);
      return true;
    }
    return false;
  }

  private getPathFromUrl(url: string, appId: string): string {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return path.join(this.baseFolder, appId, fileName);
  }
}
