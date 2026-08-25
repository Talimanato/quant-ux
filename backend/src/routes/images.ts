import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { SQLiteClient } from '../db/SQLiteClient';
import { BlobService } from '../services/BlobService';
import { AppAcl } from '../acl/AppAcl';
import { QuxUser, ROLES, hasRole } from '../acl/ACL';
import * as Util from '../util/Util';

const supportedTypes = new Set(['jpg', 'png', 'jpeg', 'gif', 'svg']);

const upload = multer({
  dest: path.join(process.cwd(), 'tmp', 'uploads'),
  limits: { fileSize: 50000000 }
});

export function createImageRouter(db: SQLiteClient, blob: BlobService, appAcl: AppAcl, maxImageSize: number): Router {
  const router = Router();

  router.get('/images/:appID.json', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canRead(user, appId);
    if (!allowed) {
      return res.status(404).json({ error: 'image.read.denied' });
    }
    const images = db.find('image', { appID: appId });
    return res.json(images);
  });

  router.get('/images/:appID/:image', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const image = req.params.image;

    const app = db.findOne('app', { _id: appId });
    const isPublic = app && app.isPublic;

    if (!isPublic) {
      const allowed = await appAcl.canRead(user, appId);
      if (!allowed) {
        return res.status(404).json({ error: 'image.read.denied' });
      }
    }
    blob.getBlob(appId, image, res);
  });

  router.get('/images/:hash/:appID/:image', async (req: Request, res: Response) => {
    const appId = req.params.appID;
    const hash = req.params.hash;
    const image = req.params.image;

    const inv = db.findOne('invitation', { hash, appID: appId });
    if (!inv) {
      return res.status(404).json({ error: 'invitation.not.found' });
    }

    blob.getBlob(appId, image, res);
  });

  router.post('/images/:appID', upload.array('files', 20), async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) {
      return res.status(405).json({ error: 'image.write.denied' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(405).json({ error: 'image.no.files' });
    }

    const uploads: any[] = [];
    const errors: string[] = [];

    blob.createFolder(appId);

    for (const file of files) {
      const type = Util.getFileType(file.originalname);
      if (!supportedTypes.has(type)) {
        errors.push(`image.type.unsupported: ${file.originalname}`);
        fs.unlinkSync(file.path);
        continue;
      }
      if (file.size > maxImageSize) {
        errors.push(`image.too.big: ${file.originalname}`);
        fs.unlinkSync(file.path);
        continue;
      }

      try {
        const meta = await sharp(file.path).metadata();
        const imageId = Util.getRandomString();
        const imageName = `${imageId}.${type}`;
        blob.setBlob(file.path, appId, imageName);

        const image = {
          _id: Util.getRandomString(),
          appID: appId,
          userID: user.id,
          name: file.originalname,
          url: `${appId}/${imageName}`,
          width: meta.width || 0,
          height: meta.height || 0,
          created: Date.now()
        };

        db.insert('image', image);
        uploads.push({ ...image, id: image._id });
      } catch (err) {
        console.error('Image processing error:', err);
        errors.push(`image.processing.error: ${file.originalname}`);
      } finally {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    const result: any = { uploads };
    if (errors.length > 0) {
      result.errors = errors;
    }
    return res.json(result);
  });

  router.delete('/images/:appID/:imageID/:ass/:file', async (req: Request, res: Response) => {
    const user = req.user as QuxUser;
    const appId = req.params.appID;
    const imageId = req.params.imageID;
    const fileName = req.params.file;

    const allowed = await appAcl.canWrite(user, appId);
    if (!allowed) {
      return res.status(405).json({ error: 'image.delete.denied' });
    }

    db.removeDocuments('image', { _id: imageId });
    blob.deleteBlob(appId, fileName);
    return res.json({ message: 'image.deleted' });
  });

  return router;
}
